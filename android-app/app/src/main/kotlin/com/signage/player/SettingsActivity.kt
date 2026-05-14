package com.signage.player

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class SettingsActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_CLEAR_FIELDS = "clear_fields"
        private const val PREFS_NAME = "player"
        private const val KEY_PLAYER_URL = "player_url"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_PIN = "pin"
        private const val KEY_PIN_CHANGED = "pin_changed"
        private const val DEFAULT_PIN = "1234"
    }

    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val clearFields = intent.getBooleanExtra(EXTRA_CLEAR_FIELDS, false)
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val serverEdit = findViewById<EditText>(R.id.editServerUrl)
        val screenEdit = findViewById<EditText>(R.id.editScreenId)
        if (clearFields) {
            serverEdit.setText("")
            screenEdit.setText("")
        } else {
            serverEdit.setText(prefs.getString(KEY_SERVER_URL, getString(R.string.hint_server_url)))
            val savedUrl = prefs.getString(KEY_PLAYER_URL, null)
            if (!savedUrl.isNullOrBlank()) {
                val id = savedUrl.substringAfter("id=").substringBefore("&").ifEmpty { null }
                if (id != null) screenEdit.setText(id)
            }
        }

        findViewById<Button>(R.id.btnCheckConnection).setOnClickListener { checkConnection() }
        findViewById<Button>(R.id.btnChangePin).setOnClickListener { showChangePinDialog() }
        findViewById<Button>(R.id.btnSaveAndLaunch).setOnClickListener { saveAndLaunch() }

        findViewById<android.widget.TextView>(R.id.settingsVersionFooter).text =
            getString(R.string.app_name) + " " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")"
    }

    private fun checkConnection() {
        val serverUrl = findViewById<EditText>(R.id.editServerUrl).text.toString().trim().trimEnd('/')
        if (serverUrl.isBlank()) {
            Toast.makeText(this, getString(R.string.msg_server_url_required), Toast.LENGTH_SHORT).show()
            return
        }
        val urlToCheck = "$serverUrl/player/index.html"
        executor.execute {
            val start = System.currentTimeMillis()
            var conn: HttpURLConnection? = null
            try {
                conn = URL(urlToCheck).openConnection() as HttpURLConnection
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                conn.requestMethod = "GET"
                conn.connect()
                val code = conn.responseCode
                val timeMs = System.currentTimeMillis() - start
                handler.post {
                    if (isFinishing || isDestroyed) return@post
                    Toast.makeText(
                        this@SettingsActivity,
                        getString(R.string.connection_ok, code, timeMs),
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                handler.post {
                    if (isFinishing || isDestroyed) return@post
                    Toast.makeText(
                        this@SettingsActivity,
                        getString(R.string.connection_error, e.message ?: getString(R.string.connection_error_unknown)),
                        Toast.LENGTH_LONG
                    ).show()
                }
            } finally {
                conn?.disconnect()
            }
        }
    }

    private fun showChangePinDialog() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val currentPin = prefs.getString(KEY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN
        val editCurrent = EditText(this).apply {
            hint = getString(R.string.hint_current_pin)
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.change_pin)
            .setView(editCurrent)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                if (editCurrent.text.toString() == currentPin) {
                    showNewPinDialog()
                } else {
                    Toast.makeText(this, R.string.pin_incorrect, Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun showNewPinDialog() {
        val editNew = EditText(this).apply {
            hint = getString(R.string.new_pin_hint)
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.change_pin)
            .setView(editNew)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                val newPin = editNew.text.toString()
                if (newPin.length >= 4) {
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                        .putString(KEY_PIN, newPin)
                        .putBoolean(KEY_PIN_CHANGED, true)
                        .apply()
                    Toast.makeText(this, getString(R.string.msg_pin_changed), Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, R.string.pin_too_short, Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun saveAndLaunch() {
        val serverUrl = findViewById<EditText>(R.id.editServerUrl).text.toString().trim().trimEnd('/')
        val screenId = findViewById<EditText>(R.id.editScreenId).text.toString().trim()
        if (serverUrl.isEmpty()) {
            Toast.makeText(this, getString(R.string.msg_server_url_required), Toast.LENGTH_SHORT).show()
            return
        }
        if (!isValidUrl(serverUrl)) {
            Toast.makeText(this, getString(R.string.msg_invalid_url), Toast.LENGTH_SHORT).show()
            return
        }
        if (screenId.isBlank()) {
            Toast.makeText(this, getString(R.string.msg_screen_id_required), Toast.LENGTH_SHORT).show()
            return
        }
        val playerUrl = "$serverUrl/player/index.html?id=$screenId"
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_PLAYER_URL, playerUrl)
            .putString(KEY_SERVER_URL, serverUrl)
            .apply()
        startActivity(android.content.Intent(this, MainActivity::class.java).apply {
            flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
        })
        finish()
    }

    private fun isValidUrl(url: String): Boolean {
        return try {
            val parsed = URL(url)
            parsed.protocol == "http" || parsed.protocol == "https"
        } catch (e: Exception) {
            false
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // shutdownNow interrupts in-flight checkConnection threads — the
        // alternative shutdown() lets them keep running and post Toast on a
        // dead activity (despite the isFinishing guards, race is possible).
        executor.shutdownNow()
    }
}
