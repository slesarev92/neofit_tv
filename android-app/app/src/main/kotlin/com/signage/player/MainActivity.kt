package com.signage.player

import android.annotation.SuppressLint
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat

@SuppressLint("SetJavaScriptEnabled")
class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "player"
        private const val KEY_PLAYER_URL = "player_url"
        private const val KEY_PIN = "pin"
        private const val KEY_PIN_CHANGED = "pin_changed"
        private const val DEFAULT_PIN = "1234"
        private const val LONG_PRESS_MS = 5000L
        private const val KEY_LAST_VERSION = "last_version_code"
    }

    private var webView: WebView? = null
    private var reloadPending = false
    private var longPressRunnable: Runnable? = null
    private val handler = Handler(Looper.getMainLooper())
    private var retryCountdownRunnable: Runnable? = null
    private var reloadAfterErrorRunnable: Runnable? = null
    private var errorCountdownSeconds = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        handleFirstRunOrUpdate(prefs)
        val playerUrl = prefs.getString(KEY_PLAYER_URL, null)?.trim()

        if (playerUrl.isNullOrEmpty()) {
            startActivity(Intent(this, BindingActivity::class.java))
            finish()
            return
        }

        try {
            setContentView(R.layout.activity_main)
            val wv = findViewById<WebView>(R.id.webView)
            webView = wv
            setupWebView(wv)

            val loadingOverlay = findViewById<View>(R.id.loadingOverlay)
            val errorOverlay = findViewById<View>(R.id.errorOverlay)
            val loadingText = findViewById<android.widget.TextView>(R.id.loadingText)
            val errorCountdownText = findViewById<android.widget.TextView>(R.id.errorCountdownText)
            findViewById<Button>(R.id.btnErrorRetry).setOnClickListener {
                cancelErrorCountdown()
                errorOverlay.visibility = View.GONE
                loadingOverlay.visibility = View.VISIBLE
                loadingOverlay.alpha = 1f
                reloadPending = false
                webView?.reload()
            }
            findViewById<Button>(R.id.btnErrorSettings).setOnClickListener {
                showPinDialog()
            }

            wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                cancelErrorCountdown()
                loadingOverlay.animate().alpha(0f).withEndAction {
                    loadingOverlay.visibility = View.GONE
                }.start()
                errorOverlay.visibility = View.GONE
                reloadPending = false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (!request.isForMainFrame || reloadPending) return
                reloadPending = true
                loadingText.setText(R.string.msg_no_connection)
                loadingOverlay.visibility = View.GONE
                errorOverlay.visibility = View.VISIBLE
                errorCountdownSeconds = 10
                errorCountdownText.text = getString(R.string.msg_retry_in_seconds, errorCountdownSeconds)
                cancelErrorCountdown()
                retryCountdownRunnable = object : Runnable {
                    override fun run() {
                        if (errorCountdownSeconds <= 0) return
                        errorCountdownSeconds--
                        if (errorCountdownSeconds > 0) {
                            errorCountdownText.text = getString(R.string.msg_retry_in_seconds, errorCountdownSeconds)
                            handler.postDelayed(this, 1000)
                        }
                    }
                }
                handler.postDelayed(retryCountdownRunnable!!, 1000)
                reloadAfterErrorRunnable = Runnable {
                    reloadAfterErrorRunnable = null
                    retryCountdownRunnable?.let { handler.removeCallbacks(it) }
                    retryCountdownRunnable = null
                    errorOverlay.visibility = View.GONE
                    loadingOverlay.visibility = View.VISIBLE
                    loadingOverlay.alpha = 1f
                    loadingText.setText(R.string.msg_loading)
                    reloadPending = false
                    view.reload()
                }
                handler.postDelayed(reloadAfterErrorRunnable!!, 10_000)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean = false
        }

            wv.loadUrl(playerUrl)
            setupLongPressForSettings(wv)

            onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() { /* киоск: игнорируем Back */ }
            })
        } catch (e: Throwable) {
            android.util.Log.e("MainActivity", "Startup failed", e)
            App.logCrash(applicationContext, e)
            setContentView(R.layout.activity_main_error)
            findViewById<Button>(R.id.btnOpenSettingsFallback).setOnClickListener {
                startActivity(Intent(this, SettingsActivity::class.java))
                finish()
            }
        }
    }

    private fun handleFirstRunOrUpdate(prefs: SharedPreferences) {
        val currentVersion = BuildConfig.VERSION_CODE
        val lastVersion = prefs.getInt(KEY_LAST_VERSION, -1)
        if (currentVersion > lastVersion) {
            prefs.edit().putInt(KEY_LAST_VERSION, currentVersion).apply()
        }
    }

    private fun setupWebView(wv: WebView) {
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
        }
    }

    private fun hideSystemUI() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.insetsController?.let {
                    it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                    it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                )
            }
        } catch (e: Exception) {
            android.util.Log.w("MainActivity", "hideSystemUI", e)
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUI()
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelErrorCountdown()
        longPressRunnable?.let { handler.removeCallbacks(it) }
        longPressRunnable = null
        webView?.apply {
            stopLoading()
            clearHistory()
            removeAllViews()
            destroy()
        }
        webView = null
    }

    private fun cancelErrorCountdown() {
        retryCountdownRunnable?.let { handler.removeCallbacks(it) }
        retryCountdownRunnable = null
        reloadAfterErrorRunnable?.let { handler.removeCallbacks(it) }
        reloadAfterErrorRunnable = null
    }

    private fun setupLongPressForSettings(wv: WebView) {
        var longPressTriggered = false
        longPressRunnable = Runnable {
            longPressTriggered = true
            showPinDialog()
        }

        wv.setOnTouchListener { _, event ->
            if (event.action == android.view.MotionEvent.ACTION_DOWN) {
                longPressTriggered = false
                handler.postDelayed(longPressRunnable!!, LONG_PRESS_MS)
            } else if (
                event.action == android.view.MotionEvent.ACTION_UP ||
                event.action == android.view.MotionEvent.ACTION_CANCEL
            ) {
                handler.removeCallbacks(longPressRunnable!!)
            }
            false
        }
    }

    private fun showPinDialog() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val pinChanged = prefs.getBoolean(KEY_PIN_CHANGED, false)
        val currentPin = prefs.getString(KEY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN

        val edit = android.widget.EditText(this).apply {
            hint = getString(R.string.pin_hint)
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.enter_pin)
            .setView(edit)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                val entered = edit.text.toString()
                if (entered == currentPin) {
                    if (!pinChanged) {
                        showChangePinDialogThenOpenSettings()
                    } else {
                        startActivity(Intent(this, SettingsActivity::class.java))
                    }
                } else {
                    Toast.makeText(this, R.string.pin_incorrect, Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun showChangePinDialogThenOpenSettings() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val edit = android.widget.EditText(this).apply {
            hint = getString(R.string.new_pin_hint)
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.change_pin_first_run)
            .setView(edit)
            .setPositiveButton(android.R.string.ok) { _, _ ->
                val newPin = edit.text.toString()
                if (newPin.length >= 4) {
                    prefs.edit()
                        .putString(KEY_PIN, newPin)
                        .putBoolean(KEY_PIN_CHANGED, true)
                        .apply()
                    startActivity(Intent(this, SettingsActivity::class.java))
                } else {
                    Toast.makeText(this, R.string.pin_too_short, Toast.LENGTH_SHORT).show()
                }
            }
            .setCancelable(false)
            .show()
    }
}
