package com.signage.player

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import java.io.File
import java.util.concurrent.Executors

/**
 * Native video playback via ExoPlayer + SurfaceView.
 * Exposes @JavascriptInterface methods for player.js.
 * Uses SimpleCache for disk-based offline caching (no blob URLs, no RAM allocation).
 */
@OptIn(UnstableApi::class)
class VideoPlayerManager(
    private val activity: MainActivity,
    private val webView: WebView,
    private val playerView: PlayerView
) {
    companion object {
        private const val TAG = "VideoPlayerManager"
        private const val CACHE_DIR_NAME = "video-cache"
        private const val DEFAULT_CACHE_BYTES = 2L * 1024 * 1024 * 1024 // 2 GB
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val preloadExecutor = Executors.newSingleThreadExecutor()

    private val cache: SimpleCache
    private val player: ExoPlayer
    private val cacheDataSourceFactory: CacheDataSource.Factory

    private val httpDataSourceFactory = DefaultHttpDataSource.Factory()
        .setConnectTimeoutMs(15_000)
        .setReadTimeoutMs(15_000)

    private var currentUrl: String? = null
    private var preloadingUrl: String? = null
    private var activeCacheWriter: CacheWriter? = null
    private var released = false

    init {
        // Disk cache — LRU eviction, survives app restarts
        val cacheDir = File(activity.cacheDir, CACHE_DIR_NAME)
        val evictor = LeastRecentlyUsedCacheEvictor(DEFAULT_CACHE_BYTES)
        val dbProvider = StandaloneDatabaseProvider(activity)
        cache = SimpleCache(cacheDir, evictor, dbProvider)

        // CacheDataSource: reads from disk if cached, otherwise downloads + caches
        cacheDataSourceFactory = CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(httpDataSourceFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        // ExoPlayer with cache-backed media source
        player = ExoPlayer.Builder(activity)
            .setMediaSourceFactory(DefaultMediaSourceFactory(cacheDataSourceFactory))
            .build()

        player.repeatMode = Player.REPEAT_MODE_OFF
        player.playWhenReady = true
        player.volume = 0f // signage — no audio (videos encoded with -an)

        playerView.player = player

        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED && !released) {
                    val url = currentUrl
                    mainHandler.post {
                        if (released) return@post
                        hidePlayer()
                        callJs("window.onExoVideoEnded && window.onExoVideoEnded()")
                        Log.d(TAG, "Video ended: $url")
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                if (released) return
                val url = currentUrl ?: ""
                Log.e(TAG, "Playback error: ${error.message}, url=$url")
                mainHandler.post {
                    if (released) return@post
                    hidePlayer()
                    val escaped = url.replace("\\", "\\\\").replace("'", "\\'")
                    callJs("window.onExoVideoError && window.onExoVideoError('$escaped')")
                }
            }
        })
    }

    // =========================================================
    //  JavascriptInterface — called from WebView JS thread
    // =========================================================

    @JavascriptInterface
    fun playVideo(url: String) {
        mainHandler.post {
            if (released) return@post
            currentUrl = url
            playerView.visibility = View.VISIBLE
            player.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
            player.prepare()
            player.play()
            Log.d(TAG, "playVideo: $url")
        }
    }

    @JavascriptInterface
    fun stopVideo() {
        mainHandler.post {
            if (released) return@post
            player.stop()
            player.clearMediaItems()
            hidePlayer()
            currentUrl = null
        }
    }

    /**
     * Background preload: downloads video to SimpleCache on disk via CacheWriter.
     * Does NOT create a second MediaCodec instance — only disk I/O.
     */
    @JavascriptInterface
    fun preloadVideo(url: String) {
        synchronized(this) {
            if (released || url == preloadingUrl) return
            cancelPreloadLocked()
            preloadingUrl = url
        }
        preloadExecutor.execute {
            try {
                val dataSpec = DataSpec(Uri.parse(url))
                val dataSource = CacheDataSource(cache, httpDataSourceFactory.createDataSource())
                val writer = CacheWriter(dataSource, dataSpec, null, null)
                synchronized(this) { activeCacheWriter = writer }
                writer.cache() // blocking — downloads full file to disk
                Log.d(TAG, "Preload complete: $url")
            } catch (e: Exception) {
                if (e !is InterruptedException) {
                    Log.w(TAG, "Preload failed: $url — ${e.message}")
                }
            } finally {
                synchronized(this) {
                    activeCacheWriter = null
                    preloadingUrl = null
                }
            }
        }
    }

    // =========================================================
    //  Lifecycle — called from MainActivity.onDestroy()
    // =========================================================

    fun release() {
        released = true
        synchronized(this) { cancelPreloadLocked() }
        preloadExecutor.shutdownNow()
        player.release()
        cache.release()
        currentUrl = null
        Log.d(TAG, "Released")
    }

    // =========================================================
    //  Internal
    // =========================================================

    private fun hidePlayer() {
        playerView.visibility = View.GONE
    }

    private fun callJs(script: String) {
        if (!released && !activity.isFinishing) {
            webView.evaluateJavascript(script, null)
        }
    }

    /** Must be called under synchronized(this) */
    private fun cancelPreloadLocked() {
        activeCacheWriter?.cancel()
        activeCacheWriter = null
        preloadingUrl = null
    }
}
