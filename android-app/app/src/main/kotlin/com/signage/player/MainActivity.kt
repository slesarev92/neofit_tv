package com.signage.player

import android.annotation.SuppressLint
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

@SuppressLint("SetJavaScriptEnabled")
class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "player"
        private const val KEY_PLAYER_URL = "player_url"
        private const val KEY_PIN = "pin"
        private const val KEY_PIN_CHANGED = "pin_changed"
        private const val DEFAULT_PIN = "1234"
        private const val LONG_PRESS_MS = 5000
    }

    private lateinit var webView: WebView
    private var reloadPending = false
    private var longPressRunnable: Runnable? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        setupWebView()

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val playerUrl = prefs.getString(KEY_PLAYER_URL, null)?.trim()

        if (playerUrl.isNullOrEmpty()) {
            startActivity(android.content.Intent(this, SettingsActivity::class.java))
            finish()
            return
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame && !reloadPending) {
                    reloadPending = true
                    handler.postDelayed({
                        reloadPending = false
                        view.reload()
                    }, 10_000)
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean = false
        }

        webView.loadUrl(playerUrl)
        setupLongPressForSettings()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { /* киоск: игнорируем Back */ }
        })
    }

    private fun setupWebView() {
        webView.settings.apply {
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
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUI()
    }

    private fun setupLongPressForSettings() {
        var longPressTriggered = false
        longPressRunnable = Runnable {
            longPressTriggered = true
            showPinDialog()
        }

        webView.setOnTouchListener { _, event ->
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
                        startActivity(android.content.Intent(this, SettingsActivity::class.java))
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
                    startActivity(android.content.Intent(this, SettingsActivity::class.java))
                } else {
                    Toast.makeText(this, R.string.pin_too_short, Toast.LENGTH_SHORT).show()
                    showChangePinDialogThenOpenSettings()
                }
            }
            .setCancelable(false)
            .show()
    }
}
