package com.auramusic.core.lyrics.models

/**
 * Single line of lyrics with millisecond timestamp.
 * For plain (unsynced) lyrics, time is 0.
 */
data class LyricsLine(
    val time: Long,
    val text: String
)

/**
 * Result returned by lyrics providers, repository, and bridge module.
 */
data class LyricsResult(
    val trackId: String,
    val title: String,
    val artist: String,
    val synced: Boolean,
    val confidence: Double,
    val lyrics: List<LyricsLine>,
    val rawLyrics: String,
    val source: String,
    val unavailable: Boolean = false
)
