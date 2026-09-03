package com.auramusic.core.bridge

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.auramusic.core.botguard.PoTokenManager
import com.auramusic.core.botguard.VisitorDataManager
import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.history.PlaybackHistoryManager
import com.auramusic.core.playback.AuraPlayer
import com.auramusic.core.playback.AuraPlaybackState
import com.auramusic.core.playback.PlaybackEvent
import com.auramusic.core.playback.TrackMetadata
import com.auramusic.core.stream.AndroidVrStreamResolver
import com.auramusic.core.stream.InnerTubeStreamResolver
import com.auramusic.core.stream.UnifiedStreamResolver
import com.auramusic.core.youtube.AuraYouTubeEngine
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

class AuraPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraPlayerModule"

    private val visitorDataManager = VisitorDataManager()
    private val poTokenManager by lazy { PoTokenManager(reactApplicationContext) }
    private val androidVrResolver by lazy { AndroidVrStreamResolver(visitorDataManager, poTokenManager) }
    private val innerTubeResolver by lazy { InnerTubeStreamResolver(reactApplicationContext) }
    private val streamResolver by lazy { UnifiedStreamResolver(reactApplicationContext, innerTubeResolver, androidVrResolver) }
    private val player by lazy { AuraPlayer.getInstance(reactApplicationContext, streamResolver) }
    private val database by lazy { AuraDatabase.getInstance(reactApplicationContext) }
    private val historyManager by lazy { PlaybackHistoryManager(database) }

    private val moduleScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    init {
        // Prewarm BotGuard VM in the background as soon as module is created (app launch)
        moduleScope.launch {
            try {
                poTokenManager.prewarm()
            } catch (e: Exception) {
                // Silent
            }
        }
    }

    private var isListening = false
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun ensureListeners() {
        if (isListening) return
        isListening = true

        player.addStateListener { state ->
            sendEvent("onPlaybackStateChanged", Arguments.createMap().apply {
                putBoolean("isPlaying", state.isPlaying)
                putString("currentTrackId", state.currentTrackId)
                putDouble("positionMs", state.positionMs.toDouble())
                putDouble("durationMs", state.durationMs.toDouble())
                putBoolean("isBuffering", state.isBuffering)
                putString("error", state.error)
            })
        }

        player.addEventListener { event, trackId ->
            historyManager.onPlaybackEvent(event, trackId)
            sendEvent("onTrackChanged", Arguments.createMap().apply {
                putString("event", event.name)
                putString("trackId", trackId)
            })
        }
    }

    @ReactMethod
    fun playTrack(videoId: String, localUrl: String? = null) {
        mainHandler.post {
            ensureListeners()
            player.playTrack(videoId, localUrl)
        }
    }

    @ReactMethod
    fun pause() {
        mainHandler.post { player.pause() }
    }

    @ReactMethod
    fun resume() {
        mainHandler.post { player.resume() }
    }

    @ReactMethod
    fun seekTo(positionMs: Double) {
        mainHandler.post { player.seekTo(positionMs.toLong()) }
    }

    @ReactMethod
    fun skipNext() {
        mainHandler.post { player.skipNext() }
    }

    @ReactMethod
    fun skipPrevious() {
        mainHandler.post { player.skipPrevious() }
    }
    
    @ReactMethod
    fun saveTrackMetadata(id: String, title: String, artist: String, album: String?, duration: Int, artworkUrl: String?) {
        historyManager.saveTrackMetadata(id, title, artist, album, duration, artworkUrl)
        mainHandler.post {
            player.saveTrackMetadata(id, title, artist, album, duration, artworkUrl)
        }
    }

    @ReactMethod
    fun saveTracksMetadata(tracks: ReadableArray) {
        val metaList = mutableListOf<TrackMetadata>()
        for (i in 0 until tracks.size()) {
            val map = tracks.getMap(i) ?: continue
            val id = if (map.hasKey("id")) map.getString("id") ?: "" else ""
            if (id.isEmpty()) continue
            val title = if (map.hasKey("title")) map.getString("title") ?: id else id
            val artist = if (map.hasKey("artist")) map.getString("artist") ?: "Unknown Artist" else "Unknown Artist"
            val album = if (map.hasKey("album")) map.getString("album") else null
            val duration = if (map.hasKey("duration")) map.getInt("duration") else 240
            val artworkUrl = if (map.hasKey("artworkUrl")) map.getString("artworkUrl") else (if (map.hasKey("art")) map.getString("art") else null)

            historyManager.saveTrackMetadata(id, title, artist, album, duration, artworkUrl)
            metaList.add(TrackMetadata(id, title, artist, album, duration, artworkUrl))
        }
        if (metaList.isNotEmpty()) {
            mainHandler.post {
                player.saveTracksMetadata(metaList)
            }
        }
    }

    @ReactMethod
    fun setQueue(trackIds: ReadableArray) {
        val ids = mutableListOf<String>()
        for (i in 0 until trackIds.size()) {
            trackIds.getString(i)?.let { ids.add(it) }
        }
        mainHandler.post { player.setQueue(ids) }
    }

    @ReactMethod
    fun setRepeatMode(mode: String) {
        mainHandler.post { player.setRepeatMode(mode) }
    }

    @ReactMethod
    fun setVolume(volume: Double) {
        mainHandler.post { player.setVolume(volume.toFloat()) }
    }

    @ReactMethod
    fun stop() {
        mainHandler.post { player.stop() }
    }

    @ReactMethod
    fun getState(promise: Promise) {
        mainHandler.post {
            val state = player.getState()
            val map = Arguments.createMap().apply {
                putBoolean("isPlaying", state.isPlaying)
                putString("currentTrackId", state.currentTrackId)
                putDouble("positionMs", state.positionMs.toDouble())
                putDouble("durationMs", state.durationMs.toDouble())
                putBoolean("isBuffering", state.isBuffering)
                putString("error", state.error)
            }
            promise.resolve(map)
        }
    }

    @ReactMethod
    fun clearNativeCache(promise: Promise) {
        moduleScope.launch(Dispatchers.IO) {
            try {
                val deletedBytes = AuraPlayer.clearMediaCache(reactApplicationContext)
                withContext(Dispatchers.Main) {
                    val map = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putDouble("deletedBytes", deletedBytes.toDouble())
                    }
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CLEAR_CACHE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun setStreamingQuality(quality: String, promise: Promise) {
        mainHandler.post {
            try {
                player.setStreamingQuality(quality)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("SET_QUALITY_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun setCacheLimit(bytes: Double, promise: Promise) {
        try {
            AuraPlayer.setCacheLimit(reactApplicationContext, bytes.toLong())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_CACHE_LIMIT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getAudioSessionId(promise: Promise) {
        mainHandler.post {
            try {
                val sessionId = player.getAudioSessionId()
                promise.resolve(sessionId)
            } catch (e: Exception) {
                promise.reject("GET_SESSION_ERROR", e.message, e)
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}

