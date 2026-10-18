package com.auramusic.core.download

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.NotificationUtil
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.DatabaseProvider
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import com.anonymous.AuraMusic.MainActivity
import com.anonymous.AuraMusic.R
import com.auramusic.core.botguard.PoTokenManager
import com.auramusic.core.botguard.VisitorDataManager
import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.db.TrackEntity
import com.auramusic.core.playback.AuraPlayer
import com.auramusic.core.stream.AndroidVrStreamResolver
import com.auramusic.core.stream.InnerTubeStreamResolver
import com.auramusic.core.stream.UnifiedStreamResolver
import kotlinx.coroutines.*
import okhttp3.Dns
import okhttp3.OkHttpClient
import java.io.File
import java.io.IOException
import java.net.Inet4Address
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit

private const val TAG = "DownloadTrace"

@OptIn(UnstableApi::class)
class DownloadUtil private constructor(private val context: Context) {

    interface DownloadProgressListener {
        fun onDownloadProgress(trackId: String, bytesDownloaded: Long, totalBytes: Long, percentage: Float)
        fun onDownloadStateChanged(trackId: String, state: Int, error: String?)
    }

    private data class CachedStreamUrl(
        val url: String,
        val format: String,
        val client: String,
        val expiresAtMs: Long,
        val quality: String? = null
    )

    private val songUrlCache = ConcurrentHashMap<String, CachedStreamUrl>()
    private val listeners = CopyOnWriteArrayList<DownloadProgressListener>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val databaseProvider: DatabaseProvider by lazy {
        StandaloneDatabaseProvider(context)
    }

    val downloadCache: SimpleCache by lazy {
        val downloadDir = File(context.filesDir, "download")
        if (!downloadDir.exists()) {
            downloadDir.mkdirs()
        }
        SimpleCache(downloadDir, NoOpCacheEvictor(), databaseProvider)
    }

    val playerCache: SimpleCache by lazy {
        AuraPlayer.getMediaCache(context)
    }

    private val streamHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .followRedirects(true)
            .followSslRedirects(true)
            .retryOnConnectionFailure(true)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .dns(object : Dns {
                override fun lookup(hostname: String): List<InetAddress> {
                    val all = InetAddress.getAllByName(hostname)
                    val ipv4 = all.filterIsInstance<Inet4Address>()
                    return if (ipv4.isNotEmpty()) ipv4 else all.toList()
                }
            })
            .addNetworkInterceptor { chain ->
                val original = chain.request()
                val host = original.url.host
                val isCdn = host?.contains("googlevideo.com") == true
                val requestBuilder = original.newBuilder()
                if (isCdn) {
                    val rangeHeader = original.header("Range") ?: "NONE"
                    Log.d(TAG, "[DownloadTrace][CDN] Request host=$host range=$rangeHeader")
                    requestBuilder.header("Origin", "https://www.youtube.com")
                    requestBuilder.header("Referer", "https://www.youtube.com/")
                }
                val request = requestBuilder.build()
                val response = chain.proceed(request)
                if (isCdn) {
                    val contentRange = response.header("Content-Range") ?: "NONE"
                    val contentLength = response.header("Content-Length") ?: "0"
                    Log.d(TAG, "[DownloadTrace][CDN] Response code=${response.code} contentRange=$contentRange contentLength=$contentLength")
                }
                response
            }
            .build()
    }

    private val streamResolver: UnifiedStreamResolver by lazy {
        val visitorDataManager = VisitorDataManager()
        val poTokenManager = PoTokenManager(context)
        val androidVrResolver = AndroidVrStreamResolver(visitorDataManager, poTokenManager)
        val innerTubeResolver = InnerTubeStreamResolver(context)
        UnifiedStreamResolver(context, innerTubeResolver, androidVrResolver)
    }

    private val dataSourceFactory: DataSource.Factory by lazy {
        val userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        val upstreamFactory = OkHttpDataSource.Factory(streamHttpClient).setUserAgent(userAgent)

        val playerCacheDataSourceFactory = CacheDataSource.Factory()
            .setCache(playerCache)
            .setUpstreamDataSourceFactory(upstreamFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        ResolvingDataSource.Factory(playerCacheDataSourceFactory) { dataSpec ->
            val mediaId = dataSpec.key ?: error("No media id on DataSpec key")
            val length = if (dataSpec.length >= 0) dataSpec.length else 1

            // 1. Instant Cache Reuse: If track already cached in playerCache, return dataSpec immediately
            if (playerCache.isCached(mediaId, dataSpec.position, length)) {
                Log.i(TAG, "[DownloadTrace][CacheHit] Reusing player cache for trackId=$mediaId pos=${dataSpec.position} len=$length")
                return@Factory dataSpec
            }

            // 2. Check in-memory stream URL cache
            val now = System.currentTimeMillis()
            val downloadCacheKey = "$mediaId:${currentDownloadQuality.lowercase()}"
            (songUrlCache[downloadCacheKey] ?: songUrlCache[mediaId])?.let { cached ->
                if (now < cached.expiresAtMs) {
                    Log.i(TAG, "[DownloadTrace][CacheHit] Using cached stream URL for trackId=$mediaId quality=${cached.quality} client=${cached.client}")
                    return@Factory dataSpec.buildUpon().setUri(Uri.parse(cached.url)).build()
                } else {
                    Log.w(TAG, "[DownloadTrace][URL_INVALIDATED] Cached URL expired for trackId=$mediaId")
                    songUrlCache.remove(downloadCacheKey)
                    songUrlCache.remove(mediaId)
                }
            }

            // 3. Resolve stream on-device via UnifiedStreamResolver (InnerTube -> AndroidVR)
            Log.i(TAG, "[DownloadTrace][Resolver] Resolving stream on-device for trackId=$mediaId quality=$currentDownloadQuality")
            val resolved = runBlocking(Dispatchers.IO) {
                streamResolver.resolve(mediaId, currentDownloadQuality)
            }

            if (resolved.url.isEmpty()) {
                Log.e(TAG, "[DownloadTrace][Failed] Stream resolution returned empty URL for trackId=$mediaId")
                throw IOException("Stream resolution returned empty URL for trackId=$mediaId")
            }

            // Cache URL for 5 hours
            songUrlCache[downloadCacheKey] = CachedStreamUrl(
                url = resolved.url,
                format = resolved.format,
                client = "InnerTube/Unified",
                expiresAtMs = now + (5 * 3600 * 1000L),
                quality = currentDownloadQuality
            )

            Log.i(TAG, "[DownloadTrace][Resolved] Resolved stream on-device for trackId=$mediaId format=${resolved.format} bitrate=${resolved.bitrate}")
            dataSpec.buildUpon().setUri(Uri.parse(resolved.url)).build()
        }
    }

    val downloadNotificationHelper: DownloadNotificationHelper by lazy {
        DownloadNotificationHelper(context, AuraDownloadService.CHANNEL_ID)
    }

    val downloadManager: DownloadManager by lazy {
        DownloadManager(
            context,
            databaseProvider,
            downloadCache,
            dataSourceFactory,
            Executor(Runnable::run)
        ).apply {
            maxParallelDownloads = 3
            addListener(object : DownloadManager.Listener {
                override fun onDownloadChanged(
                    downloadManager: DownloadManager,
                    download: Download,
                    finalException: Exception?
                ) {
                    val trackId = download.request.id
                    val bytesDownloaded = download.bytesDownloaded
                    val contentLength = download.contentLength
                    val percent = if (download.percentDownloaded != androidx.media3.common.C.PERCENTAGE_UNSET.toFloat()) {
                        download.percentDownloaded
                    } else if (contentLength > 0) {
                        (bytesDownloaded * 100f / contentLength).coerceIn(0f, 100f)
                    } else {
                        0f
                    }

                    Log.d(TAG, "[DownloadTrace][Progress] trackId=$trackId state=${download.state} bytes=$bytesDownloaded total=$contentLength percent=$percent%")

                    if (download.state == Download.STATE_FAILED && finalException.isExpiredStreamError()) {
                        Log.w(TAG, "[DownloadTrace][Retry] Invalidating stream URL for trackId=$trackId due to 403/410/416 expired stream error")
                        invalidateStreamUrl(trackId)
                    }

                    notifyListeners(trackId, download.state, bytesDownloaded, contentLength, percent, finalException?.message)

                    scope.launch {
                        val db = AuraDatabase.getInstance(context)
                        when (download.state) {
                            Download.STATE_COMPLETED -> {
                                Log.i(TAG, "[DownloadTrace][Completed] Download complete for trackId=$trackId bytes=$bytesDownloaded")
                                val lengthToSave = if (contentLength > 0) contentLength else bytesDownloaded

                                val rawData = try { String(download.request.data, Charsets.UTF_8) } catch (_: Exception) { "" }
                                var title = "Unknown Title"
                                var artist = "Unknown Artist"
                                var album: String? = null
                                var albumId: String? = null
                                var artistId: String? = null
                                var duration = 0
                                var artworkUrl: String? = null

                                if (rawData.startsWith("{")) {
                                    try {
                                        val j = org.json.JSONObject(rawData)
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

                                var entity = try { db.trackDao().getById(trackId) } catch (_: Exception) { null }
                                if (entity == null) {
                                    entity = TrackEntity(
                                        id = trackId,
                                        title = title,
                                        artist = artist,
                                        album = album,
                                        albumId = albumId,
                                        artistId = artistId,
                                        duration = duration,
                                        artworkUrl = artworkUrl ?: "https://i.ytimg.com/vi/$trackId/hqdefault.jpg",
                                        isDownloaded = true,
                                        downloadedAt = System.currentTimeMillis(),
                                        contentLength = lengthToSave
                                    )
                                    db.trackDao().upsert(entity)
                                    Log.i(TAG, "[DownloadTrace][Completed] Created missing TrackEntity for trackId=$trackId title='$title' album='$album' albumId='$albumId'")
                                } else {
                                    val updated = entity.copy(
                                        isDownloaded = true,
                                        downloadedAt = System.currentTimeMillis(),
                                        contentLength = lengthToSave,
                                        album = if (entity.album.isNullOrBlank() || entity.album == "Unknown Album") (album ?: entity.album) else entity.album,
                                        albumId = entity.albumId ?: albumId,
                                        artistId = entity.artistId ?: artistId,
                                        artworkUrl = entity.artworkUrl ?: artworkUrl
                                    )
                                    db.trackDao().upsert(updated)
                                    entity = updated
                                }

                                downloadArtworkAsync(trackId, entity.artworkUrl)
                                showDownloadCompletedNotification(trackId, entity.title, entity.artist)
                            }
                            Download.STATE_FAILED -> {
                                Log.w(TAG, "[DownloadTrace][Failed] Download failed for trackId=$trackId: ${finalException?.message}")
                                db.trackDao().updateDownloadStatus(trackId, false, null, null)

                                val rawData = try { String(download.request.data, Charsets.UTF_8) } catch (_: Exception) { "" }
                                var title = "Track"
                                if (rawData.startsWith("{")) {
                                    try {
                                        val j = org.json.JSONObject(rawData)
                                        title = j.optString("title", title)
                                    } catch (_: Exception) {}
                                } else if (rawData.isNotEmpty()) {
                                    title = rawData
                                }
                                showDownloadFailedNotification(trackId, title)
                            }
                            Download.STATE_REMOVING -> {
                                Log.w(TAG, "[DownloadTrace][Removing] Download removed for trackId=$trackId")
                                db.trackDao().updateDownloadStatus(trackId, false, null, null)
                            }
                            else -> {}
                        }
                    }
                }

                override fun onDownloadRemoved(downloadManager: DownloadManager, download: Download) {
                    val trackId = download.request.id
                    Log.i(TAG, "[DownloadTrace] Download removed for trackId=$trackId")
                    songUrlCache.remove(trackId)
                    notifyListeners(trackId, Download.STATE_REMOVING, 0, 0, 0f, null)
                    scope.launch {
                        val db = AuraDatabase.getInstance(context)
                        db.trackDao().updateDownloadStatus(trackId, false, null, null)
                    }
                }
            })
        }
    }

    private var currentDownloadQuality: String = "high"

    fun setDownloadQuality(quality: String) {
        currentDownloadQuality = quality
        Log.i(TAG, "[QualityTrace] Download quality updated to $quality")
    }

    fun getDownloadQuality(): String = currentDownloadQuality

    fun setWifiOnly(wifiOnly: Boolean) {
        val requirements = if (wifiOnly) {
            androidx.media3.exoplayer.scheduler.Requirements(androidx.media3.exoplayer.scheduler.Requirements.NETWORK_UNMETERED)
        } else {
            androidx.media3.exoplayer.scheduler.Requirements(0)
        }
        downloadManager.requirements = requirements
        Log.i(TAG, "[NetworkTrace] DownloadManager requirements updated: wifiOnly=$wifiOnly (requirements=$requirements)")
    }

    fun addListener(listener: DownloadProgressListener) {
        listeners.add(listener)
    }

    fun removeListener(listener: DownloadProgressListener) {
        listeners.remove(listener)
    }

    private fun notifyListeners(
        trackId: String,
        state: Int,
        bytesDownloaded: Long,
        totalBytes: Long,
        percent: Float,
        error: String?
    ) {
        listeners.forEach { listener ->
            listener.onDownloadProgress(trackId, bytesDownloaded, totalBytes, percent)
            listener.onDownloadStateChanged(trackId, state, error)
        }
    }

    fun startDownload(track: TrackEntity) {
        Log.i(TAG, "[DownloadTrace] START trackId=${track.id} title=${track.title}")
        scope.launch {
            val db = AuraDatabase.getInstance(context)
            db.trackDao().upsert(track)
            
            // Asynchronously pre-resolve and cache the stream URL so ResolvingDataSource hits cache
            try {
                val quality = currentDownloadQuality
                val cachedUrl = getCachedStreamUrl(track.id, quality)
                if (cachedUrl == null) {
                    Log.i(TAG, "[DownloadTrace][PreResolve] Pre-resolving stream for trackId=${track.id} quality=$quality")
                    val resolved = streamResolver.resolve(track.id, quality)
                    if (resolved.url.isNotEmpty()) {
                        cacheStreamUrl(track.id, resolved.url, resolved.format, quality)
                        Log.i(TAG, "[DownloadTrace][PreResolve] Successfully pre-cached stream for trackId=${track.id}")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "[DownloadTrace][PreResolve] Pre-resolution failed for trackId=${track.id}: ${e.message}")
            }
        }

        val json = org.json.JSONObject().apply {
            put("id", track.id)
            put("title", track.title)
            put("artist", track.artist)
            put("album", track.album ?: "")
            put("albumId", track.albumId ?: "")
            put("artistId", track.artistId ?: "")
            put("duration", track.duration)
            put("artworkUrl", track.artworkUrl ?: "")
        }.toString()

        val downloadRequest = DownloadRequest.Builder(track.id, Uri.parse("auramusic://track/${track.id}"))
            .setCustomCacheKey(track.id)
            .setData(json.toByteArray(Charsets.UTF_8))
            .build()

        DownloadService.sendAddDownload(
            context,
            AuraDownloadService::class.java,
            downloadRequest,
            false
        )
    }

    // == FIX #4: Local Artwork Support ==

    /**
     * Returns the local artwork file for [trackId] if it exists, is non-empty,
     * and is a valid image file, otherwise returns null.
     */
    fun getLocalArtworkFile(trackId: String): java.io.File? {
        val artworkDir = java.io.File(context.filesDir, "artwork")
        val file = java.io.File(artworkDir, "$trackId.jpg")
        if (!file.exists() || file.length() <= 512) return null
        return try {
            val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
            android.graphics.BitmapFactory.decodeFile(file.absolutePath, opts)
            if (opts.outWidth > 0 && opts.outHeight > 0) file else null
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Downloads artwork for [trackId] asynchronously.
     * Tries [artworkUrl], then falls back to YouTube thumbnail URLs.
     * Validates image before persisting to: filesDir/artwork/<trackId>.jpg
     */
    fun downloadArtworkAsync(trackId: String, artworkUrl: String?) {
        scope.launch(Dispatchers.IO) {
            try {
                val artworkDir = java.io.File(context.filesDir, "artwork")
                if (!artworkDir.exists()) artworkDir.mkdirs()
                val destFile = java.io.File(artworkDir, "$trackId.jpg")

                if (destFile.exists() && destFile.length() > 512) {
                    val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    android.graphics.BitmapFactory.decodeFile(destFile.absolutePath, opts)
                    if (opts.outWidth > 0 && opts.outHeight > 0) {
                        Log.d(TAG, "[ArtworkTrace] Valid artwork already exists for trackId=$trackId — skipping download")
                        return@launch
                    }
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
                        val url = java.net.URL(candidate)
                        val connection = url.openConnection() as java.net.HttpURLConnection
                        connection.connectTimeout = 10_000
                        connection.readTimeout = 10_000
                        connection.setRequestProperty("User-Agent", "Mozilla/5.0")
                        connection.instanceFollowRedirects = true
                        connection.connect()

                        if (connection.responseCode in 200..299) {
                            val tempFile = java.io.File(artworkDir, "$trackId.tmp")
                            connection.inputStream.use { input ->
                                tempFile.outputStream().use { output -> input.copyTo(output) }
                            }
                            connection.disconnect()

                            if (tempFile.length() > 512) {
                                val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
                                android.graphics.BitmapFactory.decodeFile(tempFile.absolutePath, opts)
                                if (opts.outWidth > 0 && opts.outHeight > 0) {
                                    if (destFile.exists()) destFile.delete()
                                    if (tempFile.renameTo(destFile)) {
                                        Log.i(TAG, "[ArtworkTrace] ARTWORK_SAVED trackId=$trackId path=${destFile.absolutePath} bytes=${destFile.length()}")
                                        break
                                    }
                                }
                            }
                            tempFile.delete()
                        } else {
                            connection.disconnect()
                        }
                    } catch (e: Exception) {
                        Log.d(TAG, "[ArtworkTrace] Candidate failed for $trackId url=$candidate: ${e.message}")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "[ArtworkTrace] Artwork download failed for trackId=$trackId: ${e.message}")
            }
        }
    }

    /**
     * Deletes the local artwork file for [trackId] if it exists.
     * Called when a downloaded track is removed.
     */
    fun deleteLocalArtwork(trackId: String) {
        try {
            val artworkDir = java.io.File(context.filesDir, "artwork")
            val file = java.io.File(artworkDir, "$trackId.jpg")
            if (file.exists()) {
                val deleted = file.delete()
                Log.i(TAG, "[ArtworkTrace] ARTWORK_DELETED trackId=$trackId deleted=$deleted")
            }
        } catch (e: Exception) {
            Log.w(TAG, "[ArtworkTrace] Failed to delete local artwork for trackId=$trackId: ${e.message}")
        }
    }
    // == END FIX #4 ==

    private fun showDownloadCompletedNotification(trackId: String, title: String, artist: String?) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

            // Ensure channel exists
            NotificationUtil.createNotificationChannel(
                context,
                AuraDownloadService.CHANNEL_ID,
                R.string.download_channel_name,
                R.string.download_channel_description,
                NotificationUtil.IMPORTANCE_LOW
            )

            val contentIntent = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val message = if (!artist.isNullOrBlank() && artist != "Unknown Artist") {
                "$title • $artist"
            } else {
                title
            }

            val notification = downloadNotificationHelper.buildDownloadCompletedNotification(
                context,
                R.drawable.ic_notification,
                contentIntent,
                message
            )

            // Make completed notification dismissable on tap
            notification.flags = notification.flags or android.app.Notification.FLAG_AUTO_CANCEL

            val notificationId = TERMINAL_NOTIFICATION_ID_OFFSET + (trackId.hashCode() and 0x7FFFFFFF % 10000)
            notificationManager.notify(notificationId, notification)
            Log.d(TAG, "[DownloadTrace][Notification] Posted completed notification for trackId=$trackId id=$notificationId")
        } catch (e: Exception) {
            Log.w(TAG, "[DownloadTrace][Notification] Failed to show completed notification: ${e.message}")
        }
    }

    private fun showDownloadFailedNotification(trackId: String, title: String) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

            // Ensure channel exists
            NotificationUtil.createNotificationChannel(
                context,
                AuraDownloadService.CHANNEL_ID,
                R.string.download_channel_name,
                R.string.download_channel_description,
                NotificationUtil.IMPORTANCE_LOW
            )

            val contentIntent = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = downloadNotificationHelper.buildDownloadFailedNotification(
                context,
                R.drawable.ic_notification,
                contentIntent,
                title
            )

            // Make failed notification dismissable on tap
            notification.flags = notification.flags or android.app.Notification.FLAG_AUTO_CANCEL

            val notificationId = TERMINAL_NOTIFICATION_ID_OFFSET + (trackId.hashCode() and 0x7FFFFFFF % 10000)
            notificationManager.notify(notificationId, notification)
            Log.d(TAG, "[DownloadTrace][Notification] Posted failed notification for trackId=$trackId id=$notificationId")
        } catch (e: Exception) {
            Log.w(TAG, "[DownloadTrace][Notification] Failed to show failed notification: ${e.message}")
        }
    }


    fun removeDownload(trackId: String) {
        Log.i(TAG, "[DownloadTrace] REMOVE trackId=$trackId")
        // == FIX #4: Clean up local artwork when download is removed ==
        deleteLocalArtwork(trackId)
        // == END FIX #4 ==
        DownloadService.sendRemoveDownload(
            context,
            AuraDownloadService::class.java,
            trackId,
            false
        )
    }

    fun pauseDownload(trackId: String) {
        DownloadService.sendSetStopReason(
            context,
            AuraDownloadService::class.java,
            trackId,
            Download.STOP_REASON_NONE + 1,
            false
        )
    }

    fun resumeDownload(trackId: String) {
        DownloadService.sendSetStopReason(
            context,
            AuraDownloadService::class.java,
            trackId,
            Download.STOP_REASON_NONE,
            false
        )
    }

    fun getDownload(trackId: String): Download? {
        return downloadManager.downloadIndex.getDownload(trackId)
    }

    fun isTrackDownloaded(trackId: String): Boolean {
        val download = getDownload(trackId)
        return download?.state == Download.STATE_COMPLETED
    }

    data class DownloadReconcileResult(
        val checkedCount: Int,
        val repairedCount: Int,
        val missingTrackIds: List<String>,
        val orphanedDownloadCount: Int
    )

    suspend fun reconcileDownloads(): DownloadReconcileResult = withContext(Dispatchers.IO) {
        val db = AuraDatabase.getInstance(context)
        val downloadedTracks = db.trackDao().getDownloadedTracks()
        var repaired = 0
        val missingIds = mutableListOf<String>()
        var orphanedCount = 0

        Log.i("AuraRestore", "[AuraRestore] Download reconciliation started. Inspecting ${downloadedTracks.size} Room records.")

        for (track in downloadedTracks) {
            val spans = try {
                downloadCache.getCachedSpans(track.id)
            } catch (_: Exception) {
                null
            }
            val hasSpans = spans != null && !spans.isEmpty()

            val legacyFile = File(context.filesDir, "aura/audio/${track.id}.mp3")
            val legacyFileM4a = File(context.filesDir, "aura/audio/${track.id}.m4a")
            val hasLegacyFile = legacyFile.exists() || legacyFileM4a.exists()

            if (!hasSpans && !hasLegacyFile) {
                Log.w("AuraRestore", "[AuraRestore] Reconciling missing download: trackId=${track.id} (audio missing)")
                db.trackDao().updateDownloadStatus(track.id, false, null, null)
                missingIds.add(track.id)
                repaired++

                try {
                    val media3Download = downloadManager.downloadIndex.getDownload(track.id)
                    if (media3Download != null) {
                        downloadManager.removeDownload(track.id)
                        orphanedCount++
                    }
                } catch (_: Exception) {}
            }
        }

        Log.i(
            "AuraRestore",
            "[AuraRestore] Download reconciliation complete: checked=${downloadedTracks.size}, repaired=$repaired, orphaned=$orphanedCount"
        )

        DownloadReconcileResult(
            checkedCount = downloadedTracks.size,
            repairedCount = repaired,
            missingTrackIds = missingIds,
            orphanedDownloadCount = orphanedCount
        )
    }

    fun cacheStreamUrl(videoId: String, url: String, format: String, quality: String? = null) {
        val now = System.currentTimeMillis()
        val cached = CachedStreamUrl(
            url = url,
            format = format,
            client = "UnifiedStreamResolver",
            expiresAtMs = now + (5 * 3600 * 1000L),
            quality = quality
        )
        val qKey = quality?.lowercase()
        if (qKey != null) {
            songUrlCache["$videoId:$qKey"] = cached
        }
        songUrlCache[videoId] = cached
        Log.i(TAG, "[DownloadTrace][URL_CACHED] Pre-cached stream URL for trackId=$videoId quality=$quality format=$format")
    }

    fun invalidateStreamUrl(videoId: String) {
        songUrlCache.remove(videoId)
        songUrlCache.keys.filter { it.startsWith("$videoId:") }.forEach {
            songUrlCache.remove(it)
        }
        Log.i(TAG, "[DownloadTrace][URL_INVALIDATED] Explicitly invalidated stream URLs for trackId=$videoId")
    }

    fun getCachedStreamUrl(videoId: String, quality: String? = null): String? {
        val qKey = quality?.lowercase()
        val key = if (qKey != null) "$videoId:$qKey" else videoId
        val cached = songUrlCache[key] ?: if (quality == null) songUrlCache[videoId] else null
        if (cached != null) {
            if (System.currentTimeMillis() < cached.expiresAtMs) {
                // If a specific quality was requested and cached item has quality metadata, ensure they match
                if (quality != null && cached.quality != null && !cached.quality.equals(quality, ignoreCase = true)) {
                    Log.w(TAG, "[QualityTrace] Cached stream quality mismatch: requested=$quality cached=${cached.quality}, bypassing cache")
                    return null
                }
                return cached.url
            }
            songUrlCache.remove(key)
        }
        return null
    }

    private fun Throwable?.isExpiredStreamError(): Boolean {
        var current = this
        while (current != null) {
            if (current is HttpDataSource.InvalidResponseCodeException &&
                (current.responseCode == 403 || current.responseCode == 410 || current.responseCode == 416)
            ) {
                return true
            }
            current = current.cause
        }
        return false
    }

    companion object {
        const val TERMINAL_NOTIFICATION_ID_OFFSET = 3000

        @Volatile
        private var INSTANCE: DownloadUtil? = null

        fun getInstance(context: Context): DownloadUtil {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: DownloadUtil(context.applicationContext).also { INSTANCE = it }
            }
        }

        fun getDownloadCache(context: Context): SimpleCache {
            return getInstance(context).downloadCache
        }
    }
}
