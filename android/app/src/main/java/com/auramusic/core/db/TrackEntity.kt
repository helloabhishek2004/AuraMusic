package com.auramusic.core.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String?,
    val duration: Int,
    val artworkUrl: String?,
    val createdAt: Long = System.currentTimeMillis(),
    val lastPlayedAt: Long? = null,
    val playCount: Int = 0,
    val isDownloaded: Boolean = false,
    val downloadedAt: Long? = null,
    val contentLength: Long? = null,
    val loudnessDb: Double? = null
)
