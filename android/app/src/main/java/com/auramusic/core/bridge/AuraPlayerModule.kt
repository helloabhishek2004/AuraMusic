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
import com.auramusic.core.stream.AndroidVrStreamResolver
import com.auramusic.core.youtube.AuraYouTubeEngine
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

class AuraPlayerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraPlayerModule"

    private val visitorDataManager = VisitorDataManager()
    private val poTokenManager by lazy { PoTokenManager(reactApplicationContext) }
    private val streamResolver by lazy { AndroidVrStreamResolver(visitorDataManager, poTokenManager) }
    private val player by lazy { AuraPlayer(reactApplicationContext, streamResolver) }
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

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}

