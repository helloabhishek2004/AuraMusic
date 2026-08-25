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
        exoPlayer = ExoPlayer.Builder(context).build()
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
                // If HTTP 403 or similar, attempt re-resolution
                if (retryCount < MAX_RETRIES && trackId != null) {
                    retryCount++
                    playTrack(trackId)
                } else {
                    updateState(currentState.copy(isBuffering = false, error = error.message))
                    notifyEvent(PlaybackEvent.ERROR, trackId)
                    retryCount = 0
                }
            }
        })
    }

    fun playTrack(videoId: String) {
        scope.launch {
            try {
                initialize()
                updateState(currentState.copy(
                    isBuffering = true,
                    currentTrackId = videoId,
                    error = null
                ))

                val result = withContext(Dispatchers.IO) {
                    streamResolver.resolve(videoId)
                }

                exoPlayer?.apply {
                    setMediaItem(MediaItem.fromUri(result.url))
                    prepare()
                    play()
                }

                retryCount = 0
                notifyEvent(PlaybackEvent.PLAY_STARTED, videoId)
            } catch (e: Exception) {
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
