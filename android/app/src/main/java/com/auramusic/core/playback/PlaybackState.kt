package com.auramusic.core.playback

enum class PlaybackEvent {
    PLAY_STARTED,
    PLAY_PAUSED,
    PLAY_RESUMED,
    PLAY_COMPLETED,
    PLAY_SKIPPED,
    SEEKED,
    ERROR,
    QUEUE_NEARING_END
}

data class AuraPlaybackState(
    val isPlaying: Boolean = false,
    val currentTrackId: String? = null,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val isBuffering: Boolean = false,
    val error: String? = null,
    val currentMediaIndex: Int = -1
)
