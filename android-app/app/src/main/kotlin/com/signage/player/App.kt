package com.signage.player

import android.app.Application
import android.util.Log

class App : Application() {

    override fun onCreate() {
        super.onCreate()
        // #region agent log
        Log.e(DEBUG_TAG, "runId=start hypothesisId=A location=App.onCreate message=Application onCreate")
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(DEBUG_TAG, "runId=crash hypothesisId=E location=UncaughtException message=${throwable.message} data=${Log.getStackTraceString(throwable)}")
            defaultHandler?.uncaughtException(thread, throwable)
        }
        // #endregion
    }

    companion object {
        private const val DEBUG_TAG = "SignageDebug"
    }
}
