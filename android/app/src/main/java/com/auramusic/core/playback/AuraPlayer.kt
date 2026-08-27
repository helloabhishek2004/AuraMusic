package com.auramusic.core.playback

import android.content.Context
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.auramusic.core.stream.AndroidVrStreamResolver
import kotlinx.coroutines.*
import java.util.concurrent.CopyOnWriteArrayList

typealias PlaybackStateListener = (AuraPlaybackState) -> Unit
typealias PlaybackEventListener = (PlaybackEvent, String?) -> Unit

/**
 * Production Media3-based player.
 * Resolves streams internally via AndroidVrStreamResolver — React Native only provides videoIds.
 * Operates independently of React Native UI lifecycle.
 */
class AuraPlayer(
    private val context: Context,
    private val streamResolver: AndroidVrStreamResolver
) {
    private var exoPlayer: ExoPlayer? = null
    private val stateListeners = CopyOnWriteArrayList<PlaybackStateListener>()
    private val eventListeners = CopyOnWriteArrayList<PlaybackEventListener>()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Queue management
    private val queue = mutableListOf<String>() // videoIds
    private var currentIndex = -1

    private var currentState = AuraPlaybackState()
    private var progressJob: Job? = null

    private var retryCount = 0
    private val MAX_RETRIES = 2

    fun initialize() {
        if (exoPlayer != null) return

        val okHttpClient = okhttp3.OkHttpClient.Builder()
            .followRedirects(true)
            .followSslRedirects(true)
            .retryOnConnectionFailure(true)
            .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .build()

        val userAgent = "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
        val httpDataSourceFactory = androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(okHttpClient)
            .setUserAgent(userAgent)
        val dataSourceFactory = androidx.media3.datasource.DefaultDataSource.Factory(context, httpDataSourceFactory)

        exoPlayer = ExoPlayer.Builder(context)
            .setMediaSourceFactory(androidx.media3.exoplayer.source.DefaultMediaSourceFactory(dataSourceFactory))
            .build()
            
        exoPlayer?.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_READY -> updateState(currentState.copy(isBuffering = false))
                    Player.STATE_BUFFERING -> updateState(currentState.copy(isBuffering = true))
                    Player.STATE_ENDED -> {
                        notifyEvent(PlaybackEvent.PLAY_COMPLETED, currentState.currentTrackId)
                        skipNext()
                    }
                    Player.STATE_IDLE -> {}
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                updateState(currentState.copy(isPlaying = isPlaying))
                if (isPlaying) startProgressUpdates() else stopProgressUpdates()
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                val trackId = currentState.currentTrackId
                android.util.Log.e("NativeCore", "[PlaybackTrace] ExoPlayer error on track $trackId: ${error.message}", error)
                if (retryCount < MAX_RETRIES && trackId != null) {
                    retryCount++
                    android.util.Log.w("NativeCore", "[PlaybackTrace] Retrying playback for $trackId (attempt $retryCount/$MAX_RETRIES)")
                    playTrackInternal(trackId, isRetry = true)
                } else {
                    android.util.Log.e("NativeCore", "[PlaybackTrace] Playback permanently failed for $trackId after $retryCount retries")
                    updateState(currentState.copy(isBuffering = false, error = error.message))
                    notifyEvent(PlaybackEvent.ERROR, trackId)
                    retryCount = 0
                }
            }
        })
    }

    fun playTrack(videoId: String, localUrl: String? = null) {
        val idx = queue.indexOf(videoId)
        if (idx != -1) currentIndex = idx
        playTrackInternal(videoId, localUrl, isRetry = false)
    }

    private fun playTrackInternal(videoId: String, localUrl: String? = null, isRetry: Boolean = false) {
        if (!isRetry) {
            retryCount = 0
        }
        scope.launch {
            try {
                initialize()
                updateState(currentState.copy(
                    isBuffering = true,
                    currentTrackId = videoId,
                    error = null
                ))

                val finalUrl = if (localUrl != null) {
                    localUrl
                } else {
                    val result = withContext(Dispatchers.IO) {
                        streamResolver.resolve(videoId)
                    }
                    result.url
                }

                exoPlayer?.apply {
                    android.util.Log.i("NativeCore", "[PlaybackTrace] Preparing ExoPlayer with URL: $finalUrl")
                    setMediaItem(MediaItem.fromUri(finalUrl))
                    prepare()
                    play()
                }

                if (!isRetry) {
                    notifyEvent(PlaybackEvent.PLAY_STARTED, videoId)
                }
            } catch (e: Exception) {
                android.util.Log.e("NativeCore", "[PlaybackTrace] playTrack error: ${e.message}", e)
                updateState(currentState.copy(isBuffering = false, error = e.message))
                notifyEvent(PlaybackEvent.ERROR, videoId)
            }
        }
    }

    fun pause() {
        exoPlayer?.pause()
        notifyEvent(PlaybackEvent.PLAY_PAUSED, currentState.currentTrackId)
    }

    fun resume() {
        exoPlayer?.play()
        notifyEvent(PlaybackEvent.PLAY_RESUMED, currentState.currentTrackId)
    }

    fun seekTo(positionMs: Long) {
        exoPlayer?.seekTo(positionMs)
        notifyEvent(PlaybackEvent.SEEKED, currentState.currentTrackId)
    }

    fun stop() {
        exoPlayer?.stop()
        stopProgressUpdates()
        updateState(AuraPlaybackState())
    }

    fun setQueue(videoIds: List<String>) {
        queue.clear()
        queue.addAll(videoIds)
        currentIndex = -1
    }

    fun skipNext() {
        if (queue.isEmpty()) return
        currentIndex = (currentIndex + 1).coerceAtMost(queue.size - 1)
        if (currentIndex < queue.size) {
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            playTrack(queue[currentIndex])
        }
    }

    fun skipPrevious() {
        if (queue.isEmpty()) return
        // If more than 3 seconds into the track, restart it
        if ((exoPlayer?.currentPosition ?: 0) > 3000) {
            seekTo(0)
            return
        }
        currentIndex = (currentIndex - 1).coerceAtLeast(0)
        notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
        playTrack(queue[currentIndex])
    }

    fun getState(): AuraPlaybackState = currentState

    fun addStateListener(listener: PlaybackStateListener) { stateListeners.add(listener) }
    fun removeStateListener(listener: PlaybackStateListener) { stateListeners.remove(listener) }
    fun addEventListener(listener: PlaybackEventListener) { eventListeners.add(listener) }
    fun removeEventListener(listener: PlaybackEventListener) { eventListeners.remove(listener) }

    fun release() {
        stopProgressUpdates()
        scope.cancel()
        exoPlayer?.release()
        exoPlayer = null
    }

    private fun updateState(newState: AuraPlaybackState) {
        currentState = newState
        stateListeners.forEach { it(newState) }
    }

    private fun notifyEvent(event: PlaybackEvent, trackId: String?) {
        eventListeners.forEach { it(event, trackId) }
    }

    private fun startProgressUpdates() {
        stopProgressUpdates()
        progressJob = scope.launch {
            while (isActive) {
                val player = exoPlayer ?: break
                updateState(currentState.copy(
                    positionMs = player.currentPosition,
                    durationMs = player.duration.coerceAtLeast(0)
                ))
                delay(1000) // ~1 update per second as spec requires
            }
        }
    }

    private fun stopProgressUpdates() {
        progressJob?.cancel()
        progressJob = null
    }
}

