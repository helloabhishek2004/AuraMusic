package com.auramusic.core.bridge

import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.history.PlaybackHistoryManager
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

/**
 * React Native bridge for playback history.
 */
class AuraHistoryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraHistoryModule"

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val database by lazy { AuraDatabase.getInstance(reactApplicationContext) }
    private val historyManager by lazy { PlaybackHistoryManager(database) }

    @ReactMethod
    fun getHistory(promise: Promise) {
        scope.launch {
            try {
                val entries = withContext(Dispatchers.IO) {
                    historyManager.getHistory()
                }
                val array = Arguments.createArray()
                for (entry in entries) {
                    val map = Arguments.createMap().apply {
                        putString("id", entry.id)
                        putString("trackId", entry.trackId)
                        putDouble("timestamp", entry.timestamp.toDouble())
                        putDouble("listenDuration", entry.listenDuration.toDouble())
                        putBoolean("completed", entry.completed)
                        putBoolean("skipped", entry.skipped)
                    }
                    array.pushMap(map)
                }
                promise.resolve(array)
            } catch (e: Exception) {
                promise.reject("HISTORY_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun clearHistory(promise: Promise) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    historyManager.clearHistory()
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("CLEAR_ERROR", e.message, e)
            }
        }
    }
}
