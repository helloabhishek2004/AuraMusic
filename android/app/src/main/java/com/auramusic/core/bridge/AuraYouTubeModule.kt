package com.auramusic.core.bridge

import com.auramusic.core.youtube.AuraYouTubeEngine
import com.facebook.react.bridge.*
import kotlinx.coroutines.*

/**
 * React Native bridge for YouTube search and metadata.
 * Returns clean domain objects — no raw YouTube JSON crosses the bridge.
 */
class AuraYouTubeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraYouTubeModule"

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val engine = AuraYouTubeEngine()

    @ReactMethod
    fun search(query: String, promise: Promise) {
        scope.launch {
            try {
                val result = engine.search(query)
                val array = Arguments.createArray()
                for (track in result.tracks) {
                    val map = Arguments.createMap().apply {
                        putString("id", track.id)
                        putString("title", track.title)
                        putString("artist", track.artist)
                        putString("album", track.album)
                        putInt("duration", track.duration)
                        putString("artworkUrl", track.artworkUrl)
                    }
                    array.pushMap(map)
                }
                promise.resolve(array)
            } catch (e: Exception) {
                promise.reject("SEARCH_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getTrack(videoId: String, promise: Promise) {
        // For now, return a minimal Track object from search
        // Future: implement dedicated /player endpoint parsing for richer metadata
        scope.launch {
            try {
                val result = engine.search(videoId)
                if (result.tracks.isNotEmpty()) {
                    val track = result.tracks[0]
                    val map = Arguments.createMap().apply {
                        putString("id", track.id)
                        putString("title", track.title)
                        putString("artist", track.artist)
                        putString("album", track.album)
                        putInt("duration", track.duration)
                        putString("artworkUrl", track.artworkUrl)
                    }
                    promise.resolve(map)
                } else {
                    promise.reject("NOT_FOUND", "Track not found")
                }
            } catch (e: Exception) {
                promise.reject("TRACK_ERROR", e.message, e)
            }
        }
    }
}
