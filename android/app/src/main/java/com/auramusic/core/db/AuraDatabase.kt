package com.auramusic.core.db

import android.content.Context
import androidx.room.*

data class HistoryWithTrack(
    @Embedded val history: HistoryEntity,
    @Relation(
        parentColumn = "trackId",
        entityColumn = "id"
    )
    val track: TrackEntity?
)

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

    @Query("UPDATE tracks SET isDownloaded = :isDownloaded, downloadedAt = :downloadedAt, contentLength = :contentLength WHERE id = :id")
    suspend fun updateDownloadStatus(id: String, isDownloaded: Boolean, downloadedAt: Long?, contentLength: Long?)

    @Query("SELECT * FROM tracks WHERE isDownloaded = 1 ORDER BY downloadedAt DESC")
    suspend fun getDownloadedTracks(): List<TrackEntity>

    @Query("SELECT EXISTS(SELECT 1 FROM tracks WHERE id = :id AND isDownloaded = 1)")
    suspend fun isDownloaded(id: String): Boolean
}

@Dao
interface HistoryDao {
    @Insert
    suspend fun insert(entry: HistoryEntity)

    @Transaction
    @Query("SELECT * FROM history ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecentWithTracks(limit: Int = 100): List<HistoryWithTrack>

    @Query("DELETE FROM history")
    suspend fun clearAll()

    @Query("SELECT COUNT(*) FROM history WHERE trackId = :trackId")
    suspend fun getPlayCount(trackId: String): Int
}

@Database(
    entities = [TrackEntity::class, HistoryEntity::class, LyricsEntity::class, PlaylistEntity::class, PlaylistTrackCrossRef::class],
    version = 4,
    exportSchema = false
)
abstract class AuraDatabase : RoomDatabase() {
    abstract fun trackDao(): TrackDao
    abstract fun historyDao(): HistoryDao
    abstract fun lyricsDao(): LyricsDao
    abstract fun playlistDao(): PlaylistDao

    companion object {
        @Volatile
        private var INSTANCE: AuraDatabase? = null

        val MIGRATION_1_2 = object : androidx.room.migration.Migration(1, 2) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `lyrics` (
                        `trackKey` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `artist` TEXT NOT NULL,
                        `album` TEXT,
                        `duration` INTEGER NOT NULL,
                        `rawLyrics` TEXT NOT NULL,
                        `synced` INTEGER NOT NULL,
                        `source` TEXT NOT NULL,
                        `confidence` REAL NOT NULL,
                        `unavailable` INTEGER NOT NULL,
                        `cachedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`trackKey`)
                    )
                    """.trimIndent()
                )
            }
        }

        val MIGRATION_2_3 = object : androidx.room.migration.Migration(2, 3) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `tracks` ADD COLUMN `isDownloaded` INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE `tracks` ADD COLUMN `downloadedAt` INTEGER")
                db.execSQL("ALTER TABLE `tracks` ADD COLUMN `contentLength` INTEGER")
            }
        }

        val MIGRATION_3_4 = object : androidx.room.migration.Migration(3, 4) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `playlists` (
                        `id` TEXT NOT NULL,
                        `title` TEXT NOT NULL,
                        `description` TEXT,
                        `mood` TEXT,
                        `coverArt` TEXT,
                        `createdAt` INTEGER NOT NULL,
                        `updatedAt` INTEGER NOT NULL,
                        `lastPlayedAt` INTEGER,
                        `pinned` INTEGER NOT NULL DEFAULT 0,
                        `liked` INTEGER NOT NULL DEFAULT 0,
                        `gradientPrimary` TEXT,
                        `gradientSecondary` TEXT,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent()
                )
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `playlist_tracks` (
                        `playlistId` TEXT NOT NULL,
                        `trackId` TEXT NOT NULL,
                        `position` INTEGER NOT NULL,
                        `addedAt` INTEGER NOT NULL,
                        PRIMARY KEY(`playlistId`, `trackId`),
                        FOREIGN KEY(`playlistId`) REFERENCES `playlists`(`id`) ON DELETE CASCADE
                    )
                    """.trimIndent()
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_playlist_tracks_playlistId` ON `playlist_tracks` (`playlistId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_playlist_tracks_trackId` ON `playlist_tracks` (`trackId`)")
            }
        }

        fun getInstance(context: Context): AuraDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AuraDatabase::class.java,
                    "aura_music.db"
                )
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
                .build().also { INSTANCE = it }
            }
        }
    }
}

