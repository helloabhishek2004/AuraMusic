package com.auramusic.core.download

import android.content.Context
import android.graphics.BitmapFactory
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.db.TrackEntity
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/**
 * AuraMusic Production-Grade Download Hydration & Healing Engine
 *
 * Ensures that every downloaded track has:
 * 1. An intact TrackEntity in Room with real title and artist (not "Unknown" or videoId).
 * 2. A verified local artwork file at `filesDir/artwork/<trackId>.jpg`.
 * 3. Proper reconciliation between Media3 DownloadIndex and Room database.
 *
 * Runs:
 * - On app startup (debounced)
 * - On network reconnect (debounced)
 * - Periodically every 15 minutes
 * - On-demand via JS bridge `hydrateDownloads()`
 */
@OptIn(UnstableApi::class)
class DownloadHydrationManager private constructor(private val context: Context) {

    companion object {
        private const val TAG = "DownloadHydration"
        private const val PERIODIC_INTERVAL_MS = 15 * 60 * 1000L // 15 minutes

        @Volatile
        private var instance: DownloadHydrationManager? = null

        fun getInstance(context: Context): DownloadHydrationManager {
            return instance ?: synchronized(this) {
                instance ?: DownloadHydrationManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val isHydrating = AtomicBoolean(false)
    private var isStarted = false

    data class HydrationReport(
        val totalChecked: Int,
        val artworkHydrated: Int,
        val metadataHydrated: Int,
        val repairedTracks: Int
    )

    fun start() {
        if (isStarted) return
        isStarted = true
        Log.i(TAG, "[Hydration] Starting DownloadHydrationManager lifecycle")

        // 1. Register network callback to hydrate when internet reconnects
        registerNetworkCallback()

        // 2. Start periodic loop and initial startup run
        scope.launch {
            delay(5_000L) // Wait 5s for app UI to stabilize
            try {
                hydrateAll()
            } catch (e: Exception) {
                Log.w(TAG, "[Hydration] Initial startup hydration error: ${e.message}")
            }

            while (isActive) {
                delay(PERIODIC_INTERVAL_MS)
                try {
                    hydrateAll()
                } catch (e: Exception) {
                    Log.w(TAG, "[Hydration] Periodic hydration error: ${e.message}")
                }
            }
        }
    }

    private fun registerNetworkCallback() {
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
                private var lastTriggerTime = 0L

                override fun onAvailable(network: Network) {
                    val now = System.currentTimeMillis()
                    if (now - lastTriggerTime < 10_000L) {
                        // Debounce duplicate triggers within 10 seconds
                        return
                    }
                    lastTriggerTime = now
                    Log.i(TAG, "[Hydration] Internet connection restored — scheduling hydration pass")
                    scope.launch {
                        delay(3_000L) // Settle connection
                        try {
                            hydrateAll()
                        } catch (e: Exception) {
                            Log.w(TAG, "[Hydration] Network reconnect hydration error: ${e.message}")
                        }
                    }
                }
            })
        } catch (e: Exception) {
            Log.w(TAG, "[Hydration] Could not register network callback: ${e.message}")
        }
    }

    fun isNetworkConnected(): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
            val activeNet = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(activeNet) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (_: Exception) {
            false
        }
    }

    suspend fun hydrateAll(): HydrationReport = withContext(Dispatchers.IO) {
        if (!isHydrating.compareAndSet(false, true)) {
            Log.d(TAG, "[Hydration] Hydration pass already in progress — skipping")
            return@withContext HydrationReport(0, 0, 0, 0)
        }

        try {
            Log.i(TAG, "[Hydration] === HYDRATION PASS START ===")
            val db = AuraDatabase.getInstance(context)
            val downloadUtil = DownloadUtil.getInstance(context)
            val isOnline = isNetworkConnected()

            var artworkHydrated = 0
            var metadataHydrated = 0
            var repairedTracks = 0

            // ── Step 1: Reconcile Media3 completed downloads against Room ──
            val completedDownloadIds = mutableSetOf<String>()
            try {
                val cursor = downloadUtil.downloadManager.downloadIndex.getDownloads()
                while (cursor.moveToNext()) {
                    val download = cursor.download
                    if (download.state == Download.STATE_COMPLETED) {
                        completedDownloadIds.add(download.request.id)
                        
                        // Check if Room has a record
                        val existing = db.trackDao().getById(download.request.id)
                        if (existing == null || !existing.isDownloaded) {
                            // Extract metadata from download.request.data if available
                            val rawData = try { String(download.request.data, Charsets.UTF_8) } catch (_: Exception) { "" }
                            var title = "Unknown Title"
                            var artist = "Unknown Artist"
                            var album: String? = null
                            var duration = 0
                            var artworkUrl: String? = null
                            var albumId: String? = null
                            var artistId: String? = null

                            if (rawData.startsWith("{")) {
                                try {
                                    val j = JSONObject(rawData)
                                    title = j.optString("title", title)
                                    artist = j.optString("artist", artist)
                                    album = j.optString("album").takeIf { it.isNotEmpty() }
                                    albumId = j.optString("albumId").takeIf { it.isNotEmpty() }
                                    artistId = j.optString("artistId").takeIf { it.isNotEmpty() }
                                    duration = j.optInt("duration", 0)
                                    artworkUrl = j.optString("artworkUrl").takeIf { it.isNotEmpty() }
                                } catch (_: Exception) {}
                            } else if (rawData.isNotEmpty()) {
                                title = rawData
                            }

                            val entity = TrackEntity(
                                id = download.request.id,
                                title = title,
                                artist = artist,
                                album = album,
                                albumId = albumId,
                                artistId = artistId,
                                duration = duration,
                                artworkUrl = artworkUrl ?: "https://i.ytimg.com/vi/${download.request.id}/hqdefault.jpg",
                                isDownloaded = true,
                                downloadedAt = download.updateTimeMs,
                                contentLength = if (download.contentLength > 0) download.contentLength else download.bytesDownloaded
                            )
                            db.trackDao().upsert(entity)
                            repairedTracks++
                            Log.i(TAG, "[Hydration] Repaired missing Room record for trackId=${download.request.id} title='$title'")
                        }
                    }
                }
                cursor.close()
            } catch (e: Exception) {
                Log.w(TAG, "[Hydration] Error scanning Media3 downloads: ${e.message}")
            }

            // ── Step 2: Inspect all Room downloaded tracks ──
            val downloadedTracks = db.trackDao().getDownloadedTracks()
            Log.i(TAG, "[Hydration] Inspecting ${downloadedTracks.size} downloaded tracks in Room (online=$isOnline)")

            for (track in downloadedTracks) {
                var currentTrack = track

                // A. Check & Heal Metadata (Title, Artist, Artwork URL)
                val isTitleUnknown = currentTrack.title.isBlank() ||
                        currentTrack.title == currentTrack.id ||
                        currentTrack.title.equals("Unknown Title", ignoreCase = true) ||
                        currentTrack.title.equals("Unknown", ignoreCase = true)
                val isArtistUnknown = currentTrack.artist.isBlank() ||
                        currentTrack.artist.equals("Unknown Artist", ignoreCase = true) ||
                        currentTrack.artist.equals("Unknown", ignoreCase = true)
                val needsMetadata = isTitleUnknown || isArtistUnknown || currentTrack.artworkUrl.isNullOrBlank()

                if (needsMetadata && isOnline) {
                    val oembed = fetchYouTubeOEmbed(currentTrack.id)
                    if (oembed != null) {
                        val oembedTitle = oembed.optString("title").trim()
                        val oembedAuthor = oembed.optString("author_name")
                            .replace(Regex(" - Topic$"), "")
                            .trim()
                        val oembedThumb = oembed.optString("thumbnail_url").trim()

                        val newTitle = if (isTitleUnknown) {
                            if (oembedTitle.isNotEmpty()) oembedTitle else currentTrack.title
                        } else currentTrack.title

                        val newArtist = if (isArtistUnknown) {
                            if (oembedAuthor.isNotEmpty()) oembedAuthor else currentTrack.artist
                        } else currentTrack.artist

                        val newArt = if (currentTrack.artworkUrl.isNullOrBlank()) {
                            if (oembedThumb.isNotEmpty()) oembedThumb else "https://i.ytimg.com/vi/${currentTrack.id}/hqdefault.jpg"
                        } else currentTrack.artworkUrl

                        val newAlbum = if (currentTrack.album.isNullOrBlank() ||
                                currentTrack.album.equals("Unknown Album", ignoreCase = true) ||
                                currentTrack.album.equals("Single — Unknown", ignoreCase = true)) {
                            if (newArtist.isNotBlank() && !newArtist.equals("Unknown", ignoreCase = true)) {
                                "Single — $newArtist"
                            } else currentTrack.album
                        } else currentTrack.album

                        if (newTitle != currentTrack.title || newArtist != currentTrack.artist || newArt != currentTrack.artworkUrl || newAlbum != currentTrack.album) {
                            currentTrack = currentTrack.copy(
                                title = newTitle,
                                artist = newArtist,
                                artworkUrl = newArt,
                                album = newAlbum
                            )
                            db.trackDao().upsert(currentTrack)
                            metadataHydrated++
                            Log.i(TAG, "[Hydration] METADATA_HYDRATED trackId=${currentTrack.id} title='$newTitle' artist='$newArtist' album='$newAlbum'")
                        }
                    }
                    delay(200L) // Throttling
                } else if (currentTrack.album.isNullOrBlank() || currentTrack.album.equals("Unknown Album", ignoreCase = true) || currentTrack.album.equals("Single — Unknown", ignoreCase = true)) {
                    // Even if online metadata not needed/offline, heal missing album if empty
                    if (currentTrack.artist.isNotBlank() && !currentTrack.artist.equals("Unknown", ignoreCase = true)) {
                        val fallbackAlbum = "Single — ${currentTrack.artist}"
                        currentTrack = currentTrack.copy(album = fallbackAlbum)
                        db.trackDao().upsert(currentTrack)
                        metadataHydrated++
                        Log.i(TAG, "[Hydration] ALBUM_HYDRATED trackId=${currentTrack.id} album='$fallbackAlbum'")
                    }
                }

                // B. Check & Heal Local Artwork File
                val localArtwork = downloadUtil.getLocalArtworkFile(currentTrack.id)
                val needsArtwork = localArtwork == null || !isValidImageFile(localArtwork)

                if (needsArtwork && isOnline) {
                    val artSaved = downloadAndVerifyArtwork(currentTrack.id, currentTrack.artworkUrl)
                    if (artSaved) {
                        artworkHydrated++
                    }
                    delay(200L) // Throttling
                }
            }

            Log.i(TAG, "[Hydration] === HYDRATION PASS COMPLETE === checked=${downloadedTracks.size} artworkHydrated=$artworkHydrated metadataHydrated=$metadataHydrated repaired=$repairedTracks")
            return@withContext HydrationReport(
                totalChecked = downloadedTracks.size,
                artworkHydrated = artworkHydrated,
                metadataHydrated = metadataHydrated,
                repairedTracks = repairedTracks
            )
        } finally {
            isHydrating.set(false)
        }
    }

    private fun fetchYouTubeOEmbed(videoId: String): JSONObject? {
        return try {
            val url = URL("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$videoId&format=json")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 8_000
            conn.readTimeout = 8_000
            conn.setRequestProperty("User-Agent", "Mozilla/5.0")
            conn.instanceFollowRedirects = true
            conn.connect()
            if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                JSONObject(body)
            } else {
                conn.disconnect()
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "[Hydration] oEmbed error for $videoId: ${e.message}")
            null
        }
    }

    private fun isValidImageFile(file: File): Boolean {
        if (!file.exists() || file.length() <= 512) return false
        return try {
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, opts)
            opts.outWidth > 0 && opts.outHeight > 0
        } catch (_: Exception) {
            false
        }
    }

    private suspend fun downloadAndVerifyArtwork(trackId: String, artworkUrl: String?): Boolean = withContext(Dispatchers.IO) {
        val artworkDir = File(context.filesDir, "artwork")
        if (!artworkDir.exists()) artworkDir.mkdirs()
        val destFile = File(artworkDir, "$trackId.jpg")

        if (isValidImageFile(destFile)) {
            return@withContext true
        }

        val candidates = mutableListOf<String>()
        if (!artworkUrl.isNullOrBlank()) {
            candidates.add(artworkUrl)
        }
        candidates.add("https://i.ytimg.com/vi/$trackId/maxresdefault.jpg")
        candidates.add("https://i.ytimg.com/vi/$trackId/hqdefault.jpg")
        candidates.add("https://i.ytimg.com/vi/$trackId/mqdefault.jpg")

        for (candidate in candidates) {
            try {
                val url = URL(candidate)
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 8_000
                conn.readTimeout = 8_000
                conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                conn.instanceFollowRedirects = true
                conn.connect()

                if (conn.responseCode in 200..299) {
                    val tempFile = File(artworkDir, "$trackId.tmp")
                    conn.inputStream.use { input ->
                        tempFile.outputStream().use { output -> input.copyTo(output) }
                    }
                    conn.disconnect()

                    if (isValidImageFile(tempFile)) {
                        if (destFile.exists()) destFile.delete()
                        if (tempFile.renameTo(destFile)) {
                            Log.i(TAG, "[Hydration] ARTWORK_SAVED trackId=$trackId path=${destFile.absolutePath} bytes=${destFile.length()}")
                            return@withContext true
                        }
                    }
                    tempFile.delete()
                } else {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                Log.d(TAG, "[Hydration] Candidate failed for $trackId url=$candidate: ${e.message}")
            }
        }
        return@withContext false
    }
}
