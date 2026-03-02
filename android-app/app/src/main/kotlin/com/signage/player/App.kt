package com.signage.player

import android.app.Application
import android.content.Context
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class App : Application() {

    override fun onCreate() {
        super.onCreate()
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val stack = StringWriter().use { sw ->
                PrintWriter(sw).use { throwable.printStackTrace(it) }
                sw.toString()
            }
            val msg = throwable.message ?: "Unknown"
            Log.e(DEBUG_TAG, "UncaughtException: $msg", throwable)
            writeCrashLog("$msg\n\n$stack")
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    private fun writeCrashLog(content: String) {
        try {
            val dir = filesDir
            val file = File(dir, CRASH_LOG_FILE)
            val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
            file.appendText("--- $time ---\n$content\n\n")
        } catch (e: Exception) {
            Log.e(DEBUG_TAG, "Failed to write crash log", e)
        }
    }

    companion object {
        private const val DEBUG_TAG = "SignageDebug"
        /** Имя файла с логом краша (путь: getFilesDir()/crash_log.txt, достать: adb pull /data/data/com.signage.player/files/crash_log.txt) */
        const val CRASH_LOG_FILE = "crash_log.txt"

        /** Записать лог краша в файл (для вызова из Activity при перехвате исключения). */
        @JvmStatic
        fun logCrash(context: Context, throwable: Throwable) {
            val stack = Log.getStackTraceString(throwable)
            val msg = throwable.message ?: "Unknown"
            Log.e(DEBUG_TAG, "Caught: $msg", throwable)
            try {
                val dir = context.filesDir
                val file = File(dir, CRASH_LOG_FILE)
                val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
                file.appendText("--- $time (caught) ---\n$msg\n\n$stack\n\n")
            } catch (e: Exception) {
                Log.e(DEBUG_TAG, "Failed to write crash log", e)
            }
        }
    }
}
