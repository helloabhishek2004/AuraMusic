package com.auramusic.core.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String? = null,
    val mood: String? = null,
    val coverArt: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val lastPlayedAt: Long? = null,
    val pinned: Boolean = false,
    val liked: Boolean = false,
    val gradientPrimary: String? = null,
    val gradientSecondary: String? = null
)
