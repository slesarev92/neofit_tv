# NeoFit TV — ProGuard / R8 rules

# Keep WebView JS interface (if used in future)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebViewClient and WebChromeClient subclasses
-keep class * extends android.webkit.WebViewClient
-keep class * extends android.webkit.WebChromeClient

# Keep Application class (crash handler)
-keep class com.signage.player.App { *; }

# Keep activities referenced in AndroidManifest
-keep class com.signage.player.MainActivity { *; }
-keep class com.signage.player.BindingActivity { *; }
-keep class com.signage.player.SettingsActivity { *; }

# Keep BroadcastReceivers
-keep class com.signage.player.BootReceiver { *; }

# Keep Service
-keep class com.signage.player.LaunchService { *; }

# Kotlin metadata (needed for reflection in some libraries)
-keep class kotlin.Metadata { *; }

# ZXing
-keep class com.google.zxing.** { *; }
-keep class com.journeyapps.barcodescanner.** { *; }

# Media3 / ExoPlayer
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# VideoPlayerManager — JavascriptInterface bridge
-keep class com.signage.player.VideoPlayerManager { *; }
