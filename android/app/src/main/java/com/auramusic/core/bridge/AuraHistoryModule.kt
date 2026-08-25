package com.auramusic.core.bridge

import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.history.PlaybackHistoryManager
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

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
                    historyManager.getHistoryWithTracks()
                }
                val array = Arguments.createArray()
                for (entry in entries) {
                    val map = Arguments.createMap().apply {
                        putString("id", entry.history.id)
                        putString("trackId", entry.history.trackId)
                        putDouble("timestamp", entry.history.timestamp.toDouble())
                        putDouble("listenDuration", entry.history.listenDuration.toDouble())
                        putBoolean("completed", entry.history.completed)
                        putBoolean("skipped", entry.history.skipped)

                        if (entry.track != null) {
                            putString("title", entry.track.title)
                            putString("artist", entry.track.artist)
                            putString("album", entry.track.album)
                            putString("artworkUrl", entry.track.artworkUrl)
                            putInt("duration", entry.track.duration)
                        }
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
