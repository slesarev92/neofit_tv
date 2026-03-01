package com.signage.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.storage.StorageManager
import android.util.Log
import android.widget.Toast
import java.io.File
import java.util.Properties

class UsbReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MEDIA_MOUNTED) return

        val possiblePaths = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            getRemovableVolumeRoots(context)
        } else {
            emptyList()
        }

        val pathFromIntent = intent.data?.path
        val fallbackPaths = listOfNotNull(
            pathFromIntent,
            "/mnt/usb",
            "/mnt/usb_storage",
            "/mnt/media_rw",
            "/storage/usb",
            "/storage/usbdisk"
        ).distinct()

        val allPaths = (possiblePaths + fallbackPaths).distinct()
        val configFile = allPaths
            .map { File("$it/signage.txt") }
            .firstOrNull { it.exists() && it.canRead() }

        if (configFile == null) {
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(context, context.getString(R.string.msg_usb_file_not_found), Toast.LENGTH_LONG).show()
            }
            return
        }

        try {
            val content = configFile.readText().trim()
            if (content.isEmpty()) {
                showError(context, R.string.msg_usb_invalid_format)
                return
            }

            val prefs = context.getSharedPreferences("player", Context.MODE_PRIVATE)

            // Формат Properties: player_url= или server_url= + screen_id=
            val props = Properties()
            configFile.inputStream().use { props.load(it) }

            props.getProperty("player_url")?.let { url ->
                val trimmed = url.trim()
                if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                    prefs.edit().putString("player_url", trimmed).apply()
                    notifyAndReload(context, trimmed)
                    return
                }
            }

            val serverUrl = props.getProperty("server_url")
                ?: prefs.getString("server_url", context.getString(R.string.hint_server_url))
                ?: context.getString(R.string.hint_server_url)
            val screenId = props.getProperty("screen_id")
            if (screenId != null && screenId.isNotBlank()) {
                val url = "${serverUrl.trimEnd('/')}/player/index.html?id=${screenId.trim()}"
                prefs.edit()
                    .putString("player_url", url)
                    .putString("server_url", serverUrl.trimEnd('/'))
                    .apply()
                notifyAndReload(context, url)
                return
            }

            // Формат «одна строка = полный URL»
            val firstUrlLine = content.lines()
                .map { it.trim() }
                .firstOrNull { it.startsWith("http://") || it.startsWith("https://") }
            if (firstUrlLine != null) {
                prefs.edit().putString("player_url", firstUrlLine).apply()
                notifyAndReload(context, firstUrlLine)
                return
            }

            showError(context, R.string.msg_usb_invalid_format)
        } catch (e: Exception) {
            Log.e("UsbReceiver", "Ошибка чтения signage.txt", e)
            showError(context, R.string.msg_usb_invalid_format)
        }
    }

    /**
     * На API 24+ возвращает корни съёмных томов через StorageManager.
     * На старых API или при ошибке — пустой список (используется fallback по путям).
     */
    private fun getRemovableVolumeRoots(context: Context): List<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return emptyList()
        return try {
            val sm = context.getSystemService(Context.STORAGE_SERVICE) as? StorageManager ?: return emptyList()
            sm.storageVolumes
                ?.filter { it.isRemovable }
                ?.mapNotNull { vol ->
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) vol.directory?.absolutePath
                    else vol.path?.absolutePath
                }
                ?.filter { it.isNotEmpty() }
                ?: emptyList()
        } catch (e: Exception) {
            Log.w("UsbReceiver", "StorageManager volumes", e)
            emptyList()
        }
    }

    private fun showError(context: Context, stringResId: Int) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(context, context.getString(stringResId), Toast.LENGTH_LONG).show()
        }
    }

    private fun notifyAndReload(context: Context, url: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(context, context.getString(R.string.msg_usb_config_applied), Toast.LENGTH_LONG).show()
        }
        context.startActivity(Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        })
    }
}
