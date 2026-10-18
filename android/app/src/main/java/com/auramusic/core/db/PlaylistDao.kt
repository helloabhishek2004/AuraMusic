package com.auramusic.core.db

import androidx.room.*

data class PlaylistTrackWithDetails(
    @Embedded val crossRef: PlaylistTrackCrossRef,
    @Relation(
        parentColumn = "trackId",
        entityColumn = "id"
    )
    val track: TrackEntity?
)

@Dao
interface PlaylistDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPlaylist(playlist: PlaylistEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPlaylists(playlists: List<PlaylistEntity>)

    @Query("DELETE FROM playlists")
    suspend fun clearAllPlaylists()

    @Query("SELECT * FROM playlists WHERE id = :id")
    suspend fun getPlaylistById(id: String): PlaylistEntity?

    @Query("SELECT * FROM playlists ORDER BY pinned DESC, updatedAt DESC")
    suspend fun getAllPlaylists(): List<PlaylistEntity>

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deletePlaylist(id: String)

    @Query("UPDATE playlists SET title = :newName, updatedAt = :updatedAt WHERE id = :id")
    suspend fun renamePlaylist(id: String, newName: String, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE playlists SET updatedAt = :updatedAt WHERE id = :id")
    suspend fun touchPlaylist(id: String, updatedAt: Long = System.currentTimeMillis())

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylistTrack(crossRef: PlaylistTrackCrossRef)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylistTracks(crossRefs: List<PlaylistTrackCrossRef>)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId AND trackId = :trackId")
    suspend fun removeTrackFromPlaylist(playlistId: String, trackId: String)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun clearPlaylistTracks(playlistId: String)

    @Query("SELECT * FROM playlist_tracks WHERE playlistId = :playlistId ORDER BY position ASC")
    suspend fun getTracksForPlaylist(playlistId: String): List<PlaylistTrackCrossRef>

    @Transaction
    @Query("SELECT * FROM playlist_tracks WHERE playlistId = :playlistId ORDER BY position ASC")
    suspend fun getPlaylistTracksWithDetails(playlistId: String): List<PlaylistTrackWithDetails>

    @Query("SELECT COUNT(*) FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun getTrackCount(playlistId: String): Int

    @Query("SELECT MAX(position) FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun getMaxPosition(playlistId: String): Int?

    @Transaction
    suspend fun addTrackWithSnapshot(
        trackDao: TrackDao,
        track: TrackEntity,
        playlistId: String
    ): Boolean {
        val existing = trackDao.getById(track.id)
        if (existing == null) {
            trackDao.upsert(track)
        }
        
        val currentTracks = getTracksForPlaylist(playlistId)
        if (currentTracks.any { it.trackId == track.id }) {
            return false
        }

        val nextPos = (currentTracks.maxOfOrNull { it.position } ?: -1) + 1
        insertPlaylistTrack(PlaylistTrackCrossRef(playlistId, track.id, nextPos))
        touchPlaylist(playlistId)
        return true
    }

    @Transaction
    suspend fun addTracksWithSnapshots(
        trackDao: TrackDao,
        tracks: List<TrackEntity>,
        playlistId: String
    ): Int {
        val currentTracks = getTracksForPlaylist(playlistId)
        val existingTrackIds = currentTracks.map { it.trackId }.toSet()
        var currentMaxPos = currentTracks.maxOfOrNull { it.position } ?: -1

        val toInsert = mutableListOf<PlaylistTrackCrossRef>()
        var addedCount = 0

        for (track in tracks) {
            val existing = trackDao.getById(track.id)
            if (existing == null) {
                trackDao.upsert(track)
            }

            if (!existingTrackIds.contains(track.id)) {
                currentMaxPos++
                toInsert.add(PlaylistTrackCrossRef(playlistId, track.id, currentMaxPos))
                addedCount++
            }
        }

        if (toInsert.isNotEmpty()) {
            insertPlaylistTracks(toInsert)
            touchPlaylist(playlistId)
        }
        return addedCount
    }

    @Transaction
    suspend fun reorderTracks(playlistId: String, orderedTrackIds: List<String>) {
        clearPlaylistTracks(playlistId)
        val crossRefs = orderedTrackIds.mapIndexed { index, trackId ->
            PlaylistTrackCrossRef(
                playlistId = playlistId,
                trackId = trackId,
                position = index,
                addedAt = System.currentTimeMillis()
            )
        }
        insertPlaylistTracks(crossRefs)
        touchPlaylist(playlistId)
    }

    @Transaction
    suspend fun removeTrack(playlistId: String, trackId: String) {
        removeTrackFromPlaylist(playlistId, trackId)
        val remaining = getTracksForPlaylist(playlistId)
        val updated = remaining.mapIndexed { index, ref ->
            ref.copy(position = index)
        }
        clearPlaylistTracks(playlistId)
        insertPlaylistTracks(updated)
        touchPlaylist(playlistId)
    }
}
