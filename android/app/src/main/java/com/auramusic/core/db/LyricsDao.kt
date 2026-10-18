package com.auramusic.core.db

import androidx.room.*

@Dao
interface LyricsDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(lyrics: LyricsEntity)

    @Query("SELECT * FROM lyrics WHERE trackKey = :trackKey")
    suspend fun getByTrackKey(trackKey: String): LyricsEntity?

    @Query("DELETE FROM lyrics WHERE trackKey = :trackKey")
    suspend fun delete(trackKey: String)

    @Query("DELETE FROM lyrics")
    suspend fun clearAll()
}
