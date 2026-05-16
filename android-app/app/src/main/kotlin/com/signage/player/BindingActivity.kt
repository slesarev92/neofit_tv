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
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.google.zxing.qrcode.QRCodeWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

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

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchQrScanner() else Toast.makeText(this, getString(R.string.qr_scan_camera_permission), Toast.LENGTH_SHORT).show()
    }

    private val scanQrLauncher = registerForActivityResult(ScanContract()) { result ->
        result.contents?.let { applyScannedUrl(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            setContentView(R.layout.activity_binding)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.insetsController?.hide(android.view.WindowInsets.Type.statusBars())
            }

            val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            setupClubPicker(prefs.getString(KEY_SERVER_URL, null))

            findViewById<Button>(R.id.bindingGetCode)?.setOnClickListener { fetchCode() }
            findViewById<Button>(R.id.bindingScanQr)?.setOnClickListener {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissionLauncher.launch(android.Manifest.permission.CAMERA)
                } else {
                    launchQrScanner()
                }
            }
            findViewById<Button>(R.id.bindingManual)?.setOnClickListener {
                startActivity(Intent(this, SettingsActivity::class.java).apply {
                    putExtra(EXTRA_CLEAR_FIELDS, true)
                })
                finish()
            }

            findViewById<TextView>(R.id.bindingVersionFooter)?.text =
                getString(R.string.app_name) + " " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")"

            handler.postDelayed({
                if (isFinishing) return@postDelayed
                if (isUrlFieldValid()) fetchCode()
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

    private fun isUrlFieldValid(): Boolean {
        val edit = findViewById<EditText>(R.id.bindingServerUrl) ?: return false
        val url = edit.text?.toString()?.trim()?.trimEnd('/') ?: ""
        return url.isNotEmpty() && (url.startsWith("http://") || url.startsWith("https://"))
    }

    /**
     * Wires the club Spinner: known clubs from clubs.xml + a trailing "Other
     * (manual)" entry. Selecting a known club writes its URL into the hidden
     * bindingServerUrl EditText so existing fetch/poll code keeps working
     * unchanged. Selecting "Other" reveals the EditText for free-text entry.
     *
     * Restore logic: if [savedUrl] matches a known club, that club is
     * preselected. Otherwise — "Other" is selected and the EditText is
     * populated with the saved URL (covers dev/staging URLs and any pre-
     * existing installs from before the picker existed).
     */
    private fun setupClubPicker(savedUrl: String?) {
        val spinner = findViewById<Spinner>(R.id.bindingClubSpinner) ?: return
        val manualLabel = findViewById<TextView>(R.id.bindingManualUrlLabel)
        val manualEdit = findViewById<EditText>(R.id.bindingServerUrl)

        val clubs = Clubs.list(this)
        val manualLabelText = getString(R.string.club_manual)
        val items = clubs.map { it.name } + manualLabelText

        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, items).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }

        val matched = Clubs.findByUrl(this, savedUrl)
        // Default index priority:
        //  1) saved URL matches a known club → that club
        //  2) no saved URL (fresh install) → flavor-specific default
        //     (Labgym APK preselects Labgym, Soham preselects Soham, etc.)
        //  3) saved URL non-blank but unknown (dev/staging/custom) → "Other"
        val defaultClub = Clubs.findByUrl(this, BuildConfig.DEFAULT_SERVER_URL)
        val startIndex = when {
            matched != null -> clubs.indexOf(matched)
            savedUrl.isNullOrBlank() && defaultClub != null -> clubs.indexOf(defaultClub)
            savedUrl.isNullOrBlank() -> 0
            else -> items.size - 1
        }
        spinner.setSelection(startIndex, false)

        // Initial visibility for manual field, before the listener fires.
        val startIsManual = startIndex == items.size - 1
        manualLabel?.visibility = if (startIsManual) View.VISIBLE else View.GONE
        manualEdit?.visibility = if (startIsManual) View.VISIBLE else View.GONE
        when {
            startIsManual && !savedUrl.isNullOrBlank() -> manualEdit?.setText(savedUrl)
            matched != null -> manualEdit?.setText(matched.url)
            startIndex < clubs.size -> manualEdit?.setText(clubs[startIndex].url)
        }

        spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (position < clubs.size) {
                    // Known club picked: hide manual field, store URL in the
                    // (hidden) EditText so the rest of the activity reads it
                    // from a single source.
                    manualLabel?.visibility = View.GONE
                    manualEdit?.visibility = View.GONE
                    manualEdit?.setText(clubs[position].url)
                } else {
                    // "Other" selected.
                    manualLabel?.visibility = View.VISIBLE
                    manualEdit?.visibility = View.VISIBLE
                    if (manualEdit?.text?.isBlank() == true) {
                        manualEdit.hint = getString(R.string.hint_server_url)
                    }
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) { /* no-op */ }
        }
    }

    private fun launchQrScanner() {
        scanQrLauncher.launch(
            ScanOptions().apply {
                setDesiredBarcodeFormats(listOf(ScanOptions.QR_CODE))
            }
        )
    }

    private fun applyScannedUrl(contents: String) {
        val s = contents.trim()
        if (!s.startsWith("http://") && !s.startsWith("https://")) return
        val base = if (s.contains("/player/index.html?id=")) {
            s.substringBefore("/player/index.html").trimEnd('/')
        } else {
            s.trimEnd('/')
        }
        // Route through the picker so a scanned URL that matches a known club
        // selects that club; otherwise it lands in the manual EditText.
        selectByUrl(base)
        if (isUrlFieldValid()) fetchCode()
    }

    /**
     * Picks the right Spinner row for [url]: known club → that row, unknown →
     * "Other" row and write [url] into the manual EditText. Used by both the
     * QR scanner callback and any future code paths that receive a URL from
     * outside the picker.
     */
    private fun selectByUrl(url: String) {
        val spinner = findViewById<Spinner>(R.id.bindingClubSpinner) ?: return
        val edit = findViewById<EditText>(R.id.bindingServerUrl)
        val clubs = Clubs.list(this)
        val matched = Clubs.findByUrl(this, url)
        if (matched != null) {
            spinner.setSelection(clubs.indexOf(matched), true)
        } else {
            // "Other" is the last entry.
            spinner.setSelection(clubs.size, true)
            edit?.setText(url)
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
        val baseUrl = findViewById<EditText>(R.id.bindingServerUrl)?.text?.toString()?.trim()?.trimEnd('/') ?: ""
        if (baseUrl.isEmpty()) {
            Toast.makeText(this, getString(R.string.msg_server_url_required), Toast.LENGTH_SHORT).show()
            return
        }
        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            Toast.makeText(this, getString(R.string.msg_invalid_url), Toast.LENGTH_SHORT).show()
            return
        }
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
        Toast.makeText(this, getString(R.string.binding_error), Toast.LENGTH_LONG).show()
    }

    private fun showBindingErrorNetwork(e: Exception) {
        Toast.makeText(this, getString(R.string.binding_error_network), Toast.LENGTH_LONG).show()
    }

    private fun showBindingErrorServer(httpCode: Int) {
        Toast.makeText(this, getString(R.string.binding_error_server, httpCode), Toast.LENGTH_LONG).show()
    }

    private fun showBindingErrorParse() {
        Toast.makeText(this, getString(R.string.binding_error_parse), Toast.LENGTH_LONG).show()
    }
}
