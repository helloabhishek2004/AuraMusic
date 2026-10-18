package com.auramusic.core.bridge

import android.util.Log
import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.lyrics.LyricsRepository
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

class AuraLyricsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraLyricsModule"

    private val database by lazy { AuraDatabase.getInstance(reactContext) }
    private val repository by lazy { LyricsRepository(database) }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @ReactMethod
    fun fetchLyrics(
        trackId: String,
        title: String,
        artist: String,
        duration: Double,
        album: String?,
        promise: Promise
    ) {
        scope.launch {
            try {
                val durationSec = if (duration > 0) duration.toInt() else -1
                val result = repository.getLyrics(
                    trackId = trackId,
                    title = title,
                    artist = artist,
                    durationSeconds = durationSec,
                    album = album
                )

                val responseMap = Arguments.createMap().apply {
                    putString("trackId", result.trackId)
                    putString("title", result.title)
                    putString("artist", result.artist)
                    putBoolean("synced", result.synced)
                    putDouble("confidence", result.confidence)
                    putString("source", result.source)
                    putBoolean("unavailable", result.unavailable)

                    val linesArray = Arguments.createArray()
                    for (line in result.lyrics) {
                        val lineMap = Arguments.createMap().apply {
                            putDouble("time", line.time.toDouble())
                            putString("text", line.text)
                        }
                        linesArray.pushMap(lineMap)
                    }
                    putArray("lyrics", linesArray)
                }

                promise.resolve(responseMap)
            } catch (e: Exception) {
                Log.e("Lyrics", "[Lyrics] fetchLyrics bridge error: ${e.message}")
                promise.reject("LYRICS_ERROR", e.message ?: "Failed to fetch lyrics", e)
            }
        }
    }

    @ReactMethod
    fun clearCache(promise: Promise) {
        scope.launch {
            try {
                repository.clearCache()
                database.lyricsDao().clearAll()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CLEAR_ERROR", e.message)
            }
        }
    }
}
