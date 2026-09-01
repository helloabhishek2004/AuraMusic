package com.auramusic.core.history

import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.db.HistoryEntity
import com.auramusic.core.db.HistoryWithTrack
import com.auramusic.core.db.TrackEntity
import com.auramusic.core.playback.PlaybackEvent
import com.auramusic.core.youtube.models.Track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class PlaybackHistoryManager(private val database: AuraDatabase) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var currentListenStart: Long = 0

    fun onPlaybackEvent(event: PlaybackEvent, trackId: String?) {
        if (trackId == null) return
        scope.launch {
            when (event) {
                PlaybackEvent.PLAY_STARTED -> {
                    currentListenStart = System.currentTimeMillis()
                    database.trackDao().recordPlay(trackId)
                }
                PlaybackEvent.PLAY_COMPLETED -> {
                    val duration = System.currentTimeMillis() - currentListenStart
                    database.historyDao().insert(
                        HistoryEntity(
                            trackId = trackId,
                            listenDuration = duration,
                            completed = true,
                            skipped = false
                        )
                    )
                }
                PlaybackEvent.PLAY_SKIPPED -> {
                    val duration = System.currentTimeMillis() - currentListenStart
                    database.historyDao().insert(
                        HistoryEntity(
                            trackId = trackId,
                            listenDuration = duration,
                            completed = false,
                            skipped = true
                        )
                    )
                }
                else -> { /* PAUSED, RESUMED, SEEKED, ERROR: no history write */ }
            }
        }
    }

    fun saveTrackMetadata(id: String, title: String, artist: String, album: String?, duration: Int, artworkUrl: String?) {
        scope.launch {
            val existing = database.trackDao().getById(id)
            database.trackDao().upsert(
                TrackEntity(
                    id = id,
                    title = title,
                    artist = artist,
                    album = album,
                    duration = duration,
                    artworkUrl = artworkUrl,
                    createdAt = existing?.createdAt ?: System.currentTimeMillis(),
                    lastPlayedAt = existing?.lastPlayedAt,
                    playCount = existing?.playCount ?: 0,
                    isDownloaded = existing?.isDownloaded ?: false,
                    downloadedAt = existing?.downloadedAt,
                    contentLength = existing?.contentLength
                )
            )
        }
    }

    suspend fun getHistoryWithTracks(limit: Int = 100): List<HistoryWithTrack> {
        return database.historyDao().getRecentWithTracks(limit)
    }

    suspend fun clearHistory() {
        database.historyDao().clearAll()
    }
}
