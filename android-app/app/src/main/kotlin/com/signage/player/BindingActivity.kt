package com.signage.player

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Pairing screen. The server URL is fixed per APK flavor via
 * BuildConfig.DEFAULT_SERVER_URL — no on-device picker, no manual entry, no
 * QR scan: each club gets its own APK. The "Ручная настройка" button is
 * kept only as an escape hatch into SettingsActivity (PIN change and check
 * connection) if pairing can't complete for any reason.
 */
class BindingActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "BindingActivity"
        private const val PREFS_NAME = "player"
        private const val KEY_PLAYER_URL = "player_url"
        private const val KEY_SERVER_URL = "server_url"
        private const val POLL_INTERVAL_MS = 3000L
        private const val COUNTDOWN_UPDATE_MS = 1000L
        const val EXTRA_CLEAR_FIELDS = "clear_fields"
    }

    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private var pollRunnable: Runnable? = null
    private var countdownRunnable: Runnable? = null
    private var expiresAtMs = 0L
    @Volatile private var isDestroyed = false

    private val serverUrl: String
        get() = BuildConfig.DEFAULT_SERVER_URL.trimEnd('/')

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            setContentView(R.layout.activity_binding)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.insetsController?.hide(android.view.WindowInsets.Type.statusBars())
            }

            findViewById<Button>(R.id.bindingGetCode)?.setOnClickListener { fetchCode() }
            findViewById<Button>(R.id.bindingManual)?.setOnClickListener {
                startActivity(Intent(this, SettingsActivity::class.java).apply {
                    putExtra(EXTRA_CLEAR_FIELDS, true)
                })
                finish()
            }

            findViewById<TextView>(R.id.bindingVersionFooter)?.text =
                getString(R.string.app_name) + " " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")"

            // Server URL is fixed — request the pairing code immediately.
            handler.postDelayed({
                if (!isFinishing) fetchCode()
            }, 400)
        } catch (e: Throwable) {
            Log.e(TAG, "Binding screen init failed", e)
            setContentView(R.layout.activity_binding_error)
            findViewById<Button>(R.id.btnOpenSettingsFallback)?.setOnClickListener {
                startActivity(Intent(this, SettingsActivity::class.java).apply {
                    putExtra(EXTRA_CLEAR_FIELDS, true)
                })
                finish()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isDestroyed = true
        pollRunnable?.let { handler.removeCallbacks(it) }
        countdownRunnable?.let { handler.removeCallbacks(it) }
        // shutdownNow interrupts in-flight HTTP threads — shutdown() lets them
        // keep polling /api/pair/:code against a dead activity.
        executor.shutdownNow()
    }

    private fun fetchCode() {
        val baseUrl = serverUrl
        findViewById<Button>(R.id.bindingGetCode)?.isEnabled = false
        executor.execute {
            var conn: HttpURLConnection? = null
            try {
                conn = URL("$baseUrl/api/pair/init").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                conn.connect()
                val code = conn.responseCode
                val body = conn.inputStream?.bufferedReader()?.readText()
                    ?: conn.errorStream?.bufferedReader()?.readText() ?: ""
                handler.post {
                    if (isFinishing) return@post
                    if (code in 200..299) {
                        parseInitResponse(body, baseUrl)
                    } else {
                        Log.e(TAG, "pair/init HTTP $code: ${body.take(300)}")
                        showBindingErrorServer(code)
                    }
                    findViewById<Button>(R.id.bindingGetCode)?.isEnabled = true
                }
            } catch (e: Exception) {
                Log.e(TAG, "pair/init request failed", e)
                handler.post {
                    if (!isFinishing) {
                        showBindingErrorNetwork(e)
                        findViewById<Button>(R.id.bindingGetCode)?.isEnabled = true
                    }
                }
            } finally {
                conn?.disconnect()
            }
        }
    }

    private fun parseInitResponse(json: String, baseUrl: String) {
        try {
            val obj = org.json.JSONObject(json)
            val code = obj.optString("code")
            val expiresIn = obj.optInt("expiresIn", 600)
            if (code.isBlank()) {
                Log.e(TAG, "pair/init response: code is empty, body=${json.take(200)}")
                showBindingError()
                return
            }
            expiresAtMs = System.currentTimeMillis() + expiresIn * 1000L
            val pairUrl = "$baseUrl/pair?code=$code"
            handler.post {
                if (isFinishing) return@post
                showCodeAndQr(code, pairUrl)
                startCountdown()
                startPolling(baseUrl, code)
            }
        } catch (e: Exception) {
            Log.e(TAG, "parseInitResponse failed", e)
            showBindingErrorParse()
        }
    }

    private fun showCodeAndQr(code: String, pairUrl: String) {
        findViewById<ImageView>(R.id.bindingQr)?.apply {
            setImageBitmap(qrBitmap(pairUrl, 400))
            visibility = View.VISIBLE
        }
        findViewById<TextView>(R.id.bindingCodeText)?.apply {
            text = code
            visibility = View.VISIBLE
        }
        findViewById<TextView>(R.id.bindingCountdown)?.visibility = View.VISIBLE
        findViewById<TextView>(R.id.bindingInstruction)?.visibility = View.VISIBLE
    }

    private fun qrBitmap(content: String, sizePx: Int): Bitmap {
        val hints = java.util.EnumMap<EncodeHintType, Any>(EncodeHintType::class.java).apply {
            put(EncodeHintType.CHARACTER_SET, "UTF-8")
            put(EncodeHintType.MARGIN, 1)
        }
        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
        val width = bitMatrix.width
        val height = bitMatrix.height
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
        for (x in 0 until width) {
            for (y in 0 until height) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) Color.BLACK else Color.WHITE)
            }
        }
        return bitmap
    }

    private fun startCountdown() {
        countdownRunnable?.let { handler.removeCallbacks(it) }
        val countdownView = findViewById<TextView>(R.id.bindingCountdown) ?: return
        countdownRunnable = object : Runnable {
            override fun run() {
                val remaining = (expiresAtMs - System.currentTimeMillis()) / 1000
                if (remaining <= 0) {
                    countdownView.text = getString(R.string.binding_code_expired)
                    pollRunnable?.let { handler.removeCallbacks(it) }
                    pollRunnable = null
                    return
                }
                val min = (remaining / 60).toInt()
                countdownView.text = getString(R.string.binding_code_valid, min)
                handler.postDelayed(this, COUNTDOWN_UPDATE_MS)
            }
        }
        handler.post(countdownRunnable!!)
    }

    private fun startPolling(baseUrl: String, code: String) {
        pollRunnable?.let { handler.removeCallbacks(it) }
        pollRunnable = object : Runnable {
            override fun run() {
                executor.execute {
                    var conn: HttpURLConnection? = null
                    try {
                        conn = URL("$baseUrl/api/pair/$code").openConnection() as HttpURLConnection
                        conn.requestMethod = "GET"
                        conn.connectTimeout = 8_000
                        conn.readTimeout = 8_000
                        conn.connect()
                        val body = conn.inputStream?.bufferedReader()?.readText() ?: ""
                        val obj = org.json.JSONObject(body)
                        val status = obj.optString("status")
                        if (status == "paired") {
                            val screenId = obj.optString("screenId")
                            if (screenId.isNotBlank()) {
                                handler.post {
                                    onPaired(baseUrl, screenId)
                                }
                                return@execute
                            }
                        }
                    } catch (_: Exception) { } finally {
                        conn?.disconnect()
                    }
                    if (!isDestroyed) {
                        handler.postDelayed(pollRunnable!!, POLL_INTERVAL_MS)
                    }
                }
            }
        }
        handler.postDelayed(pollRunnable!!, POLL_INTERVAL_MS)
    }

    private fun onPaired(baseUrl: String, screenId: String) {
        pollRunnable?.let { handler.removeCallbacks(it) }
        countdownRunnable?.let { handler.removeCallbacks(it) }
        val serverUrl = baseUrl.trimEnd('/')
        val playerUrl = "$serverUrl/player/index.html?id=$screenId"
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putString(KEY_PLAYER_URL, playerUrl)
            .putString(KEY_SERVER_URL, serverUrl)
            .apply()
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        })
        finish()
    }

    private fun showBindingError() {
        android.widget.Toast.makeText(this, getString(R.string.binding_error), android.widget.Toast.LENGTH_LONG).show()
    }

    private fun showBindingErrorNetwork(e: Exception) {
        android.widget.Toast.makeText(this, getString(R.string.binding_error_network), android.widget.Toast.LENGTH_LONG).show()
    }

    private fun showBindingErrorServer(httpCode: Int) {
        android.widget.Toast.makeText(this, getString(R.string.binding_error_server, httpCode), android.widget.Toast.LENGTH_LONG).show()
    }

    private fun showBindingErrorParse() {
        android.widget.Toast.makeText(this, getString(R.string.binding_error_parse), android.widget.Toast.LENGTH_LONG).show()
    }
}
