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

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        findViewById<EditText>(R.id.editServerUrl).setText(
            prefs.getString(KEY_SERVER_URL, "http://s9a.ru")
        )
        val savedUrl = prefs.getString(KEY_PLAYER_URL, null)
        if (!savedUrl.isNullOrBlank()) {
            val id = savedUrl.substringAfter("id=").substringBefore("&").ifEmpty { null }
            if (id != null) findViewById<EditText>(R.id.editScreenId).setText(id)
        }

        findViewById<Button>(R.id.btnCheckConnection).setOnClickListener { checkConnection() }
        findViewById<Button>(R.id.btnChangePin).setOnClickListener { showChangePinDialog() }
        findViewById<Button>(R.id.btnSaveAndLaunch).setOnClickListener { saveAndLaunch() }
    }

    private fun checkConnection() {
        val serverUrl = findViewById<EditText>(R.id.editServerUrl).text.toString().trim().trimEnd('/')
        if (serverUrl.isBlank()) {
            Toast.makeText(this, getString(R.string.server_url).plus(" не указан"), Toast.LENGTH_SHORT).show()
            return
        }
        val urlToCheck = "$serverUrl/player/index.html"
        executor.execute {
            try {
                val start = System.currentTimeMillis()
                val conn = URL(urlToCheck).openConnection() as HttpURLConnection
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                conn.requestMethod = "GET"
                conn.connect()
                val code = conn.responseCode
                conn.disconnect()
                val timeMs = System.currentTimeMillis() - start
                handler.post {
                    Toast.makeText(
                        this@SettingsActivity,
                        getString(R.string.connection_ok, code, timeMs),
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                handler.post {
                    Toast.makeText(
                        this@SettingsActivity,
                        getString(R.string.connection_error, e.message ?: "Unknown"),
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun showChangePinDialog() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val currentPin = prefs.getString(KEY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN
        val editCurrent = EditText(this).apply {
            hint = "Текущий PIN"
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
                    Toast.makeText(this, "PIN изменён", Toast.LENGTH_SHORT).show()
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
        if (screenId.isBlank()) {
            Toast.makeText(this, getString(R.string.screen_id).plus(" не указан"), Toast.LENGTH_SHORT).show()
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
}
