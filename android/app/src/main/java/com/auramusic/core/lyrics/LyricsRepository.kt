package com.auramusic.core.lyrics

import android.util.Log
import android.util.LruCache
import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.db.LyricsEntity
import com.auramusic.core.lyrics.models.LyricsResult
import com.auramusic.core.lyrics.parser.LyricsParser
import com.auramusic.core.lyrics.provider.KuGouLyricsProvider
import com.auramusic.core.lyrics.provider.LrcLibLyricsProvider
import com.auramusic.core.lyrics.provider.LyricsProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

class LyricsRepository(
    private val database: AuraDatabase,
    private val providers: List<LyricsProvider> = listOf(
        LrcLibLyricsProvider(),
        KuGouLyricsProvider()
    )
) {
    private val TAG = "Lyrics"
    private val NEGATIVE_CACHE_TTL_MS = 60 * 60 * 1000L // 1 hour for unavailable

    // Memory LRU Cache
    private val memCache = LruCache<String, LyricsResult>(100)
    
    // Negative cache for tracks that have no lyrics
    private val negativeCache = ConcurrentHashMap<String, Long>()

    // Request generation counter to prevent race conditions on rapid skip
    private val activeGenerations = ConcurrentHashMap<String, Long>()
    private val globalGeneration = AtomicLong(0)

    private fun canonicalKey(trackId: String, title: String, artist: String): String {
        val normTitle = title.trim().lowercase()
        val normArtist = artist.trim().lowercase()
        return if (trackId.isNotEmpty()) trackId else "$normArtist|$normTitle"
    }

    suspend fun getLyrics(
        trackId: String,
        title: String,
        artist: String,
        durationSeconds: Int = -1,
        album: String? = null
    ): LyricsResult = withContext(Dispatchers.IO) {
        val key = canonicalKey(trackId, title, artist)
        val generation = globalGeneration.incrementAndGet()
        activeGenerations[key] = generation

        Log.i(TAG, "[Lyrics] request trackId=$trackId title='$title' artist='$artist' duration=${durationSeconds}s gen=$generation")

        // 1. Check Memory Cache
        val memResult = memCache.get(key)
        if (memResult != null) {
            Log.i(TAG, "[Lyrics] cache hit memory trackId=$trackId synced=${memResult.synced}")
            return@withContext memResult
        }

        // 2. Check Negative Memory Cache (skip network spam for songs with no lyrics)
        val negTime = negativeCache[key]
        if (negTime != null && System.currentTimeMillis() - negTime < NEGATIVE_CACHE_TTL_MS) {
            Log.i(TAG, "[Lyrics] cache hit (negative) trackId=$trackId")
            return@withContext LyricsResult(
                trackId = trackId,
                title = title,
                artist = artist,
                synced = false,
                confidence = 0.0,
                lyrics = emptyList(),
                rawLyrics = "",
                source = "none",
                unavailable = true
            )
        }

        // 3. Check Room DB Cache
        try {
            val dbEntity = database.lyricsDao().getByTrackKey(key)
            if (dbEntity != null) {
                if (dbEntity.unavailable) {
                    if (System.currentTimeMillis() - dbEntity.cachedAt < NEGATIVE_CACHE_TTL_MS) {
                        Log.i(TAG, "[Lyrics] cache hit room (negative) trackId=$trackId")
                        negativeCache[key] = dbEntity.cachedAt
                        return@withContext LyricsResult(
                            trackId = trackId,
                            title = title,
                            artist = artist,
                            synced = false,
                            confidence = 0.0,
                            lyrics = emptyList(),
                            rawLyrics = "",
                            source = "none",
                            unavailable = true
                        )
                    }
                } else {
                    val (isSynced, lines) = LyricsParser.parse(dbEntity.rawLyrics)
                    val result = LyricsResult(
                        trackId = trackId,
                        title = dbEntity.title,
                        artist = dbEntity.artist,
                        synced = isSynced,
                        confidence = dbEntity.confidence,
                        lyrics = lines,
                        rawLyrics = dbEntity.rawLyrics,
                        source = dbEntity.source
                    )
                    Log.i(TAG, "[Lyrics] cache hit room trackId=$trackId source=${dbEntity.source} synced=$isSynced")
                    memCache.put(key, result)
                    return@withContext result
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[Lyrics] Room read error: ${e.message}")
        }

        Log.i(TAG, "[Lyrics] cache miss trackId=$trackId -> fetching from online providers")

        // 4. Sequential Provider Fetch (LRCLIB -> KuGou)
        for (provider in providers) {
            // Check if generation is still active (user didn't skip to another track)
            if (activeGenerations[key] != generation) {
                Log.w(TAG, "[Lyrics] request cancelled trackId=$trackId (stale gen $generation vs ${activeGenerations[key]})")
                return@withContext LyricsResult(
                    trackId = trackId,
                    title = title,
                    artist = artist,
                    synced = false,
                    confidence = 0.0,
                    lyrics = emptyList(),
                    rawLyrics = "",
                    source = "cancelled",
                    unavailable = true
                )
            }

            try {
                Log.i(TAG, "[Lyrics] trying provider=${provider.name}")
                val result = provider.getLyrics(trackId, title, artist, durationSeconds, album)
                if (result != null && result.lyrics.isNotEmpty()) {
                    Log.i(TAG, "[Lyrics] provider=${provider.name} SUCCESS synced=${result.synced} lines=${result.lyrics.size}")

                    // Cache in memory
                    memCache.put(key, result)

                    // Cache in Room DB
                    try {
                        database.lyricsDao().insert(
                            LyricsEntity(
                                trackKey = key,
                                title = result.title,
                                artist = result.artist,
                                album = album,
                                duration = durationSeconds,
                                rawLyrics = result.rawLyrics,
                                synced = result.synced,
                                source = result.source,
                                confidence = result.confidence,
                                unavailable = false
                            )
                        )
                        Log.i(TAG, "[Lyrics] cache write room trackId=$trackId key=$key")
                    } catch (e: Exception) {
                        Log.w(TAG, "[Lyrics] Room write error: ${e.message}")
                    }

                    return@withContext result
                }
            } catch (e: Exception) {
                Log.w(TAG, "[Lyrics] provider=${provider.name} failed: ${e.message}")
            }
        }

        // 5. No provider found lyrics -> Cache negative result
        Log.i(TAG, "[Lyrics] no match found from all providers for trackId=$trackId")
        negativeCache[key] = System.currentTimeMillis()
        try {
            database.lyricsDao().insert(
                LyricsEntity(
                    trackKey = key,
                    title = title,
                    artist = artist,
                    album = album,
                    duration = durationSeconds,
                    rawLyrics = "",
                    synced = false,
                    source = "none",
                    confidence = 0.0,
                    unavailable = true
                )
            )
        } catch (_: Exception) {}

        return@withContext LyricsResult(
            trackId = trackId,
            title = title,
            artist = artist,
            synced = false,
            confidence = 0.0,
            lyrics = emptyList(),
            rawLyrics = "",
            source = "none",
            unavailable = true
        )
    }

    fun clearCache() {
        memCache.evictAll()
        negativeCache.clear()
    }
}
