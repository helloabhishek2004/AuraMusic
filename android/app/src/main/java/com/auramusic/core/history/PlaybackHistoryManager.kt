package com.auramusic.core.history

import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.db.HistoryEntity
import com.auramusic.core.db.TrackEntity
import com.auramusic.core.playback.PlaybackEvent
import com.auramusic.core.youtube.models.Track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Records playback events into the local Room database.
 * Operates independently of React Native lifecycle —
 * the native player can record history even if RN is not running.
 */
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

    /**
     * Persists track metadata so history entries can be joined later.
     */
    fun saveTrackMetadata(track: Track) {
        scope.launch {
            val existing = database.trackDao().getById(track.id)
            database.trackDao().upsert(
                TrackEntity(
                    id = track.id,
                    title = track.title,
                    artist = track.artist,
                    album = track.album,
                    duration = track.duration,
                    artworkUrl = track.artworkUrl,
                    createdAt = existing?.createdAt ?: System.currentTimeMillis(),
                    lastPlayedAt = existing?.lastPlayedAt,
                    playCount = existing?.playCount ?: 0
                )
            )
        }
    }

    suspend fun getHistory(limit: Int = 100): List<HistoryEntity> {
        return database.historyDao().getRecent(limit)
    }

    suspend fun clearHistory() {
        database.historyDao().clearAll()
    }
}
