package com.auramusic.core.lyrics.provider

import com.auramusic.core.lyrics.models.LyricsResult

interface LyricsProvider {
    val name: String
    
    suspend fun getLyrics(
        trackId: String,
        title: String,
        artist: String,
        durationSeconds: Int = -1,
        album: String? = null
    ): LyricsResult?
}
