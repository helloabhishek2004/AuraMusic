package com.auramusic.core.db

import android.content.Context
import androidx.room.*

@Dao
interface TrackDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(track: TrackEntity)

    @Query("SELECT * FROM tracks WHERE id = :id")
    suspend fun getById(id: String): TrackEntity?

    @Query("SELECT * FROM tracks ORDER BY lastPlayedAt DESC LIMIT :limit")
    suspend fun getRecentlyPlayed(limit: Int = 50): List<TrackEntity>

    @Query("UPDATE tracks SET lastPlayedAt = :time, playCount = playCount + 1 WHERE id = :id")
    suspend fun recordPlay(id: String, time: Long = System.currentTimeMillis())
}

@Dao
interface HistoryDao {
    @Insert
    suspend fun insert(entry: HistoryEntity)

    @Query("SELECT * FROM history ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecent(limit: Int = 100): List<HistoryEntity>

    @Query("DELETE FROM history")
    suspend fun clearAll()

    @Query("SELECT COUNT(*) FROM history WHERE trackId = :trackId")
    suspend fun getPlayCount(trackId: String): Int
}

@Database(
    entities = [TrackEntity::class, HistoryEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AuraDatabase : RoomDatabase() {
    abstract fun trackDao(): TrackDao
    abstract fun historyDao(): HistoryDao

    companion object {
        @Volatile
        private var INSTANCE: AuraDatabase? = null

        fun getInstance(context: Context): AuraDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AuraDatabase::class.java,
                    "aura_music.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
