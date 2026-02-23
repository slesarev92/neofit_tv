package com.signage.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import java.io.File
import java.util.Properties

class UsbReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MEDIA_MOUNTED) return
        val path = intent.data?.path ?: return
        val file = File("$path/signage.txt")
        if (!file.exists()) return

        try {
            val props = Properties()
            file.inputStream().use { props.load(it) }
            val prefs = context.getSharedPreferences("player", Context.MODE_PRIVATE)

            // Формат 3 — прямой URL
            props.getProperty("player_url")?.let { url ->
                val trimmed = url.trim()
                prefs.edit().putString("player_url", trimmed).apply()
                notifyAndReload(context, trimmed)
                return
            }

            // Форматы 1 и 2
            val serverUrl = props.getProperty("server_url")
                ?: prefs.getString("server_url", "http://s9a.ru") ?: "http://s9a.ru"
            val screenId = props.getProperty("screen_id")
            if (screenId != null) {
                val url = "${serverUrl.trimEnd('/')}/player/index.html?id=${screenId.trim()}"
                prefs.edit()
                    .putString("player_url", url)
                    .putString("server_url", serverUrl.trimEnd('/'))
                    .apply()
                notifyAndReload(context, url)
            }
        } catch (e: Exception) {
            Log.e("UsbReceiver", "Ошибка чтения signage.txt", e)
        }
    }

    private fun notifyAndReload(context: Context, url: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(context, "Конфиг с флешки:\n$url", Toast.LENGTH_LONG).show()
        }
        context.startActivity(Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        })
    }
}
