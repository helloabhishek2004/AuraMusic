package com.auramusic.core.db

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "history")
data class HistoryEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val trackId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val listenDuration: Long = 0,
    val completed: Boolean = false,
    val skipped: Boolean = false
)
