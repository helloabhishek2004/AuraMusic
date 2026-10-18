package com.auramusic.core.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "lyrics")
data class LyricsEntity(
    @PrimaryKey val trackKey: String, // videoId or canonical "artist|title"
    val title: String,
    val artist: String,
    val album: String?,
    val duration: Int,
    val rawLyrics: String,
    val synced: Boolean,
    val source: String,
    val confidence: Double,
    val unavailable: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)
