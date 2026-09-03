package com.auramusic.core.playback

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.ForwardingPlayer
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import com.auramusic.core.stream.UnifiedStreamResolver
import com.auramusic.core.db.TrackEntity
import kotlinx.coroutines.*
import okhttp3.Dns
import java.net.Inet4Address
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

private const val TAG = "NativeCore"
private const val SESSION_TAG = "MediaSessionTrace"
private const val STREAM_RANGE_CHUNK_SIZE = 1_048_576L // 1 MB chunk bounding for Googlevideo CDN

typealias PlaybackStateListener = (AuraPlaybackState) -> Unit
typealias PlaybackEventListener = (PlaybackEvent, String?) -> Unit

data class TrackMetadata(
    val id: String,
    val title: String,
    val artist: String,
    val album: String?,
    val duration: Int,
    val artworkUrl: String?
)

/**
 * Production Media3-based player.
 * Resolves streams internally via UnifiedStreamResolver (InnerTube unthrottled -> ANDROID_VR fallback).
 * Operates independently of React Native UI lifecycle.
 * Exposes a MediaSession for Android system media controls, lock screen, and Bluetooth.
 */
class AuraPlayer(
    private val context: Context,
    private val streamResolver: UnifiedStreamResolver
) {
    companion object {
        @Volatile
        private var mediaCache: androidx.media3.datasource.cache.SimpleCache? = null

        @Volatile
        private var instance: AuraPlayer? = null

        @Volatile
        private var configuredCacheLimitBytes: Long = 512 * 1024 * 1024L

        @Synchronized
        fun getMediaCache(context: Context): androidx.media3.datasource.cache.SimpleCache {
            return mediaCache ?: run {
                val prefs = context.getSharedPreferences("aura_player_prefs", Context.MODE_PRIVATE)
                val savedLimit = prefs.getLong("cache_limit_bytes", configuredCacheLimitBytes)
                val cacheDir = java.io.File(context.cacheDir, "aura_media_cache")
                val evictor = if (savedLimit > 0) {
                    androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor(savedLimit)
                } else {
                    androidx.media3.datasource.cache.NoOpCacheEvictor()
                }
                val databaseProvider = androidx.media3.database.StandaloneDatabaseProvider(context)
                androidx.media3.datasource.cache.SimpleCache(cacheDir, evictor, databaseProvider).also {
                    mediaCache = it
                }
            }
        }

        @Synchronized
        fun setCacheLimit(context: Context, bytes: Long) {
            configuredCacheLimitBytes = bytes
            val prefs = context.getSharedPreferences("aura_player_prefs", Context.MODE_PRIVATE)
            prefs.edit().putLong("cache_limit_bytes", bytes).apply()
        }

        @Synchronized
        fun clearMediaCache(context: Context): Long {
            var bytesDeleted = 0L
            try {
                val cache = mediaCache
                if (cache != null) {
                    bytesDeleted = cache.cacheSpace
                    val keys = cache.keys.toList()
                    for (key in keys) {
                        try {
                            cache.removeResource(key)
                        } catch (_: Exception) {}
                    }
                } else {
                    val cacheDir = java.io.File(context.cacheDir, "aura_media_cache")
                    if (cacheDir.exists()) {
                        bytesDeleted = cacheDir.walkTopDown().filter { it.isFile }.map { it.length() }.sum()
                        cacheDir.listFiles()?.forEach { file ->
                            if (file.name != "exoplayer_internal.db" && !file.name.startsWith("exoplayer_internal.db")) {
                                file.deleteRecursively()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("AuraPlayer", "Error clearing media cache: ${e.message}")
            }
            return bytesDeleted
        }

        fun getInstance(context: Context, streamResolver: UnifiedStreamResolver? = null): AuraPlayer {
            return instance ?: synchronized(this) {
                instance ?: run {
                    val appContext = context.applicationContext
                    val resolver = streamResolver ?: run {
                        val visitor = com.auramusic.core.botguard.VisitorDataManager()
                        val poToken = com.auramusic.core.botguard.PoTokenManager(appContext)
                        val androidVr = com.auramusic.core.stream.AndroidVrStreamResolver(visitor, poToken)
                        val innerTube = com.auramusic.core.stream.InnerTubeStreamResolver(appContext)
                        com.auramusic.core.stream.UnifiedStreamResolver(appContext, innerTube, androidVr)
                    }
                    AuraPlayer(appContext, resolver).also {
                        instance = it
                    }
                }
            }
        }
    }

    private var exoPlayer: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private val stateListeners = CopyOnWriteArrayList<PlaybackStateListener>()
    private val eventListeners = CopyOnWriteArrayList<PlaybackEventListener>()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Queue management
    private val queue = mutableListOf<String>() // videoIds
    private var currentIndex = -1
    private var repeatMode: String = "off" // "off", "queue", "track"

    // Metadata cache for system notification & lock screen
    private val metadataCache = ConcurrentHashMap<String, TrackMetadata>()

    private var currentState = AuraPlaybackState()
    private var progressJob: Job? = null

    private var retryCount = 0
    private val MAX_RETRIES = 2

    // Forensic: prevent duplicate PLAY_STARTED for the same playback session
    private var playStartedEmittedForTrack: String? = null
    // Forensic: timestamp of playTrackInternal call for elapsed measurement
    private var trackLoadStartTime: Long = 0L

    // P0: Rapid-skip cancellation & monotonic resolution ID
    @Volatile
    private var currentResolutionJob: Job? = null
    @Volatile
    private var resolutionRequestId: Long = 0L

    private var currentStreamingQuality: String = "high"

    fun setStreamingQuality(quality: String) {
        currentStreamingQuality = quality
        Log.i(TAG, "[QualityTrace] Streaming quality updated to $quality")
    }

    fun getAudioSessionId(): Int {
        return exoPlayer?.audioSessionId ?: 0
    }

    fun getMediaSession(): MediaSession? {
        initialize()
        return mediaSession
    }

    fun saveTrackMetadata(id: String, title: String, artist: String, album: String?, duration: Int, artworkUrl: String?) {
        metadataCache[id] = TrackMetadata(id, title, artist, album, duration, artworkUrl)
        if (currentState.currentTrackId == id) {
            updateMediaMetadataForCurrentTrack()
        }
    }

    fun saveTracksMetadata(tracks: List<TrackMetadata>) {
        for (track in tracks) {
            metadataCache[track.id] = track
        }
        val currentId = currentState.currentTrackId
        if (currentId != null && metadataCache.containsKey(currentId)) {
            updateMediaMetadataForCurrentTrack()
        }
    }

    private fun isValidArtworkUri(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = try { Uri.parse(url) } catch (_: Exception) { return false }
        val scheme = uri.scheme?.lowercase() ?: return false
        return scheme == "http" || scheme == "https" || scheme == "file" || scheme == "content"
    }

    private fun updateMediaMetadataForCurrentTrack() {
        val trackId = currentState.currentTrackId ?: return

        // == FIX #2: MediaSession Fallback Hierarchy ==
        // NEVER return early just because metadataCache has no entry.
        // Missing cache entry must NOT leave MediaSession stuck on the previous track.
        //
        // Fallback priority:
        //   1. metadataCache (populated by JS via saveTrackMetadata / saveTracksMetadata)
        //   2. currentMediaItem.mediaMetadata (already set in playTrackInternal, contains
        //      Room or partial data at minimum)
        //   3. Minimal identity (trackId + "Unknown Artist") — always show correct track
        //      identity, never the wrong track.

        val cachedMeta = metadataCache[trackId]

        val title: String
        val artist: String
        val album: String?
        var artworkUri: Uri? = null

        // Check local artwork file first (works 100% offline)
        val localArtwork = com.auramusic.core.download.DownloadUtil.getInstance(context).getLocalArtworkFile(trackId)
        if (localArtwork != null) {
            artworkUri = Uri.fromFile(localArtwork)
        }

        if (cachedMeta != null) {
            // Level 1: in-memory metadata cache (populated by JS bridge)
            Log.i(SESSION_TAG, "[METADATA_CACHE_HIT] trackId=$trackId title=${cachedMeta.title}")
            title = cachedMeta.title
            artist = cachedMeta.artist
            album = cachedMeta.album
            if (artworkUri == null && isValidArtworkUri(cachedMeta.artworkUrl)) {
                artworkUri = Uri.parse(cachedMeta.artworkUrl)
            }
        } else {
            // Level 1.5: Room Database check (works on cold-start offline)
            val roomEntity = try {
                runBlocking(Dispatchers.IO) {
                    com.auramusic.core.db.AuraDatabase.getInstance(context).trackDao().getById(trackId)
                }
            } catch (_: Exception) { null }

            if (roomEntity != null) {
                Log.i(SESSION_TAG, "[METADATA_FALLBACK] Level 1.5 Room DB trackId=$trackId title=${roomEntity.title}")
                title = roomEntity.title
                artist = if (roomEntity.artist.isNotBlank()) roomEntity.artist else "Unknown Artist"
                album = roomEntity.album
                if (artworkUri == null && isValidArtworkUri(roomEntity.artworkUrl)) {
                    artworkUri = Uri.parse(roomEntity.artworkUrl)
                }
            } else {
                // Level 2: MediaItem.mediaMetadata set during playTrackInternal
                val itemMeta = exoPlayer?.currentMediaItem?.mediaMetadata
                val itemTitle = itemMeta?.title?.toString()
                val itemArtist = itemMeta?.artist?.toString()
                val itemArtUri = itemMeta?.artworkUri

                if (!itemTitle.isNullOrBlank() && itemTitle != trackId) {
                    Log.i(SESSION_TAG, "[METADATA_FALLBACK] Level2 currentMediaItem.mediaMetadata trackId=$trackId title=$itemTitle")
                    title = itemTitle
                    artist = if (!itemArtist.isNullOrBlank()) itemArtist else "Unknown Artist"
                    album = itemMeta?.albumTitle?.toString()
                    if (artworkUri == null && isValidArtworkUri(itemArtUri?.toString())) {
                        artworkUri = itemArtUri
                    }
                } else {
                    // Level 3: Minimal identity — correct track, partial metadata
                    Log.w(SESSION_TAG, "[METADATA_FALLBACK] Level3 minimal-identity trackId=$trackId (cache miss, no MediaItem meta)")
                    title = trackId
                    artist = "Unknown Artist"
                    album = null
                }
            }
        }

        val mediaMetadata = MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
            .setAlbumTitle(album)
            .setArtworkUri(artworkUri)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
            .build()
        exoPlayer?.playlistMetadata = mediaMetadata
        Log.i(SESSION_TAG, "[MEDIASESSION_METADATA_UPDATED] trackId=$trackId title=$title artist=$artist artUri=$artworkUri")
        // == END FIX #2 ==
    }

    fun initialize() {
        if (exoPlayer != null) return

        val okHttpClient = okhttp3.OkHttpClient.Builder()
            .followRedirects(true)
            .followSslRedirects(true)
            .retryOnConnectionFailure(true)
            .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
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
                    Log.d(TAG, "[PlaybackTrace][CDN] Request host=$host range=$rangeHeader")
                    requestBuilder.header("Origin", "https://www.youtube.com")
                    requestBuilder.header("Referer", "https://www.youtube.com/")
                }

                val request = requestBuilder.build()
                val response = chain.proceed(request)

                if (isCdn) {
                    val contentRange = response.header("Content-Range") ?: "NONE"
                    val contentLength = response.header("Content-Length") ?: "0"
                    Log.d(TAG, "[PlaybackTrace][CDN] Response code=${response.code} contentRange=$contentRange contentLength=$contentLength")
                }
                response
            }
            .build()

        val userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        val okHttpDataSourceFactory = androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(okHttpClient)
            .setUserAgent(userAgent)

        val chunkingDataSourceFactory = ChunkingDataSource.Factory(okHttpDataSourceFactory, STREAM_RANGE_CHUNK_SIZE)
        val defaultDataSourceFactory = androidx.media3.datasource.DefaultDataSource.Factory(context, chunkingDataSourceFactory)

        val downloadCache = com.auramusic.core.download.DownloadUtil.getDownloadCache(context)
        val playerCache = getMediaCache(context)

        val playerCacheDataSourceFactory = androidx.media3.datasource.cache.CacheDataSource.Factory()
            .setCache(playerCache)
            .setUpstreamDataSourceFactory(defaultDataSourceFactory)
            .setFlags(androidx.media3.datasource.cache.CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        val chainedCacheDataSourceFactory = androidx.media3.datasource.cache.CacheDataSource.Factory()
            .setCache(downloadCache)
            .setUpstreamDataSourceFactory(playerCacheDataSourceFactory)
            .setCacheWriteDataSinkFactory(null)
            .setFlags(androidx.media3.datasource.cache.CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        val audioAttributes = androidx.media3.common.AudioAttributes.Builder()
            .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(androidx.media3.common.C.USAGE_MEDIA)
            .build()

        val rawPlayer = ExoPlayer.Builder(context)
            .setMediaSourceFactory(androidx.media3.exoplayer.source.DefaultMediaSourceFactory(chainedCacheDataSourceFactory))
            .setAudioAttributes(audioAttributes, /* handleAudioFocus = */ true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(androidx.media3.common.C.WAKE_MODE_NETWORK)
            .build()

        exoPlayer = rawPlayer

        // ForwardingPlayer maps next/prev/seeking system commands directly into AuraPlayer queue
        val forwardingPlayer = object : ForwardingPlayer(rawPlayer) {
            override fun seekToNext() {
                Log.i(SESSION_TAG, "[MediaSessionTrace] COMMAND_NEXT")
                this@AuraPlayer.skipNext()
            }

            override fun seekToNextMediaItem() {
                Log.i(SESSION_TAG, "[MediaSessionTrace] COMMAND_NEXT_MEDIA_ITEM")
                this@AuraPlayer.skipNext()
            }

            override fun seekToPrevious() {
                Log.i(SESSION_TAG, "[MediaSessionTrace] COMMAND_PREVIOUS")
                this@AuraPlayer.skipPrevious()
            }

            override fun seekToPreviousMediaItem() {
                Log.i(SESSION_TAG, "[MediaSessionTrace] COMMAND_PREVIOUS_MEDIA_ITEM")
                this@AuraPlayer.skipPrevious()
            }

            override fun hasNextMediaItem(): Boolean {
                if (queue.isEmpty()) return false
                return this@AuraPlayer.repeatMode == "queue" || currentIndex < queue.size - 1
            }

            override fun hasPreviousMediaItem(): Boolean {
                if (queue.isEmpty()) return false
                return this@AuraPlayer.repeatMode == "queue" || currentIndex > 0
            }

            override fun getAvailableCommands(): Player.Commands {
                return super.getAvailableCommands().buildUpon()
                    .add(Player.COMMAND_SEEK_TO_NEXT)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                    .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
                    .add(Player.COMMAND_PLAY_PAUSE)
                    .build()
            }
        }

        val sessionActivityIntent = Intent(context, com.anonymous.AuraMusic.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = android.app.PendingIntent.getActivity(
            context,
            0,
            sessionActivityIntent,
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )

        val sessionCallback = object : MediaSession.Callback {
            override fun onConnect(
                session: MediaSession,
                controller: MediaSession.ControllerInfo
            ): MediaSession.ConnectionResult {
                Log.i(SESSION_TAG, "[MediaSessionTrace] CONTROLLER_CONNECTED pkg=${controller.packageName}")
                val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon().build()
                val playerCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
                    .add(Player.COMMAND_SEEK_TO_NEXT)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                    .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
                    .add(Player.COMMAND_PLAY_PAUSE)
                    .build()
                return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                    .setAvailableSessionCommands(sessionCommands)
                    .setAvailablePlayerCommands(playerCommands)
                    .build()
            }
        }

        mediaSession = MediaSession.Builder(context, forwardingPlayer)
            .setSessionActivity(pendingIntent)
            .setCallback(sessionCallback)
            .build()

        Log.i(SESSION_TAG, "[MediaSessionTrace] CREATED")

        rawPlayer.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val trackId = mediaItem?.mediaId ?: currentState.currentTrackId
                Log.i(TAG, "[PlaybackTrace][Lifecycle] onMediaItemTransition trackId=$trackId reason=$reason")
                Log.i(SESSION_TAG, "[MediaSessionTrace] onMediaItemTransition trackId=$trackId reason=$reason")
                if (trackId != null) {
                    val meta = metadataCache[trackId]
                    val durMs = if ((meta?.duration ?: 0) > 0) meta!!.duration.toLong() * 1000L else currentState.durationMs
                    updateState(currentState.copy(
                        currentTrackId = trackId,
                        durationMs = durMs
                    ))
                    updateMediaMetadataForCurrentTrack()
                }
            }

            override fun onPlaybackStateChanged(state: Int) {
                val trackId = currentState.currentTrackId
                val elapsed = if (trackLoadStartTime > 0) System.currentTimeMillis() - trackLoadStartTime else 0
                when (state) {
                    Player.STATE_IDLE -> {
                        Log.i(TAG, "[PlaybackTrace][Lifecycle] STATE_IDLE track=$trackId elapsed=${elapsed}ms")
                    }
                    Player.STATE_BUFFERING -> {
                        Log.i(TAG, "[PlaybackTrace][Lifecycle] STATE_BUFFERING track=$trackId elapsed=${elapsed}ms")
                        updateState(currentState.copy(isBuffering = true))
                    }
                    Player.STATE_READY -> {
                        Log.i(TAG, "[PlaybackTrace][Lifecycle] STATE_READY track=$trackId elapsed=${elapsed}ms")
                        updateState(currentState.copy(isBuffering = false))
                    }
                    Player.STATE_ENDED -> {
                        Log.i(TAG, "[PlaybackTrace][Lifecycle] STATE_ENDED track=$trackId elapsed=${elapsed}ms repeatMode=$repeatMode")
                        notifyEvent(PlaybackEvent.PLAY_COMPLETED, currentState.currentTrackId)
                        when (repeatMode) {
                            "track" -> {
                                Log.i(TAG, "[RepeatTrace][AutoAdvanceTrace] REPEAT_ONE: replaying $trackId requestId=$resolutionRequestId")
                                seekTo(0)
                                exoPlayer?.play()
                                // Re-emit PLAY_STARTED for repeat one session accounting
                                playStartedEmittedForTrack = null
                                notifyEvent(PlaybackEvent.PLAY_STARTED, trackId)
                            }
                            "queue" -> {
                                if (queue.isNotEmpty()) {
                                    val nextIdx = (currentIndex + 1) % queue.size
                                    Log.i(TAG, "[RepeatTrace][AutoAdvanceTrace] REPEAT_ALL: natural advance $currentIndex -> $nextIdx (size=${queue.size})")
                                    currentIndex = nextIdx
                                    playTrack(queue[currentIndex])
                                }
                            }
                            else -> { // "off"
                                if (queue.isNotEmpty() && currentIndex < queue.size - 1) {
                                    currentIndex++
                                    Log.i(TAG, "[AutoAdvanceTrace] REPEAT_OFF: natural advance to $currentIndex (size=${queue.size})")
                                    playTrack(queue[currentIndex])
                                } else {
                                    Log.i(TAG, "[AutoAdvanceTrace] REPEAT_OFF: reached queue end (index=$currentIndex size=${queue.size}) -> STOP")
                                    stop()
                                }
                            }
                        }
                    }
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                val trackId = currentState.currentTrackId
                Log.i(TAG, "[PlaybackTrace][Lifecycle] onIsPlayingChanged isPlaying=$isPlaying track=$trackId")
                Log.i(SESSION_TAG, "[MediaSessionTrace] onIsPlayingChanged isPlaying=$isPlaying trackId=$trackId")

                updateState(currentState.copy(isPlaying = isPlaying))

                if (isPlaying) {
                    startProgressUpdates()
                    ensureServiceRunning()
                    // P0-C: Emit PLAY_STARTED here — this is the only correct semantic location.
                    // It means "audio is actually playing" not "play command was sent".
                    if (trackId != null && playStartedEmittedForTrack != trackId) {
                        playStartedEmittedForTrack = trackId
                        Log.i(TAG, "[PlaybackTrace][Lifecycle] PLAY_STARTED track=$trackId")
                        notifyEvent(PlaybackEvent.PLAY_STARTED, trackId)
                    }
                } else {
                    stopProgressUpdates()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                val trackId = currentState.currentTrackId
                val elapsed = if (trackLoadStartTime > 0) System.currentTimeMillis() - trackLoadStartTime else 0

                // P0-A: Comprehensive error logging
                Log.e(TAG, "[PlaybackTrace][Error] ExoPlayer error track=$trackId elapsed=${elapsed}ms retryCount=$retryCount/$MAX_RETRIES")
                Log.e(TAG, "[PlaybackTrace][Error] errorCode=${error.errorCode} errorCodeName=${error.errorCodeName}")
                Log.e(TAG, "[PlaybackTrace][Error] message=${error.message}")

                // Unwrap cause chain for HTTP/CDN errors
                var cause: Throwable? = error.cause
                var depth = 0
                while (cause != null && depth < 5) {
                    Log.e(TAG, "[PlaybackTrace][Error] cause[$depth]: ${cause.javaClass.simpleName}: ${cause.message}")
                    if (cause is androidx.media3.datasource.HttpDataSource.HttpDataSourceException) {
                        Log.e(TAG, "[PlaybackTrace][Error] dataSource=${cause.dataSpec.uri}")
                    }
                    if (cause is androidx.media3.datasource.HttpDataSource.InvalidResponseCodeException) {
                        Log.e(TAG, "[PlaybackTrace][Error] httpResponseCode=${cause.responseCode}")
                    }
                    cause = cause.cause
                    depth++
                }

                if (retryCount < MAX_RETRIES && trackId != null) {
                    retryCount++
                    Log.w(TAG, "[PlaybackTrace][Error] Retrying playback for $trackId (attempt $retryCount/$MAX_RETRIES)")
                    playTrackInternal(trackId, isRetry = true)
                } else {
                    Log.e(TAG, "[PlaybackTrace][Error] Playback permanently failed for $trackId after $retryCount retries")
                    updateState(currentState.copy(isBuffering = false, error = error.message))
                    notifyEvent(PlaybackEvent.ERROR, trackId)
                    retryCount = 0
                }
            }
        })
    }

    private fun ensureServiceRunning() {
        try {
            val intent = Intent(context, AuraMediaSessionService::class.java)
            context.startService(intent)
        } catch (e: Exception) {
            Log.w(TAG, "[PlaybackTrace] Service start exception: ${e.message}")
        }
    }

    fun playTrack(videoId: String, localUrl: String? = null) {
        val idx = queue.indexOf(videoId)
        if (idx != -1) currentIndex = idx
        playTrackInternal(videoId, localUrl, isRetry = false)
    }

    private fun playTrackInternal(videoId: String, localUrl: String? = null, isRetry: Boolean = false) {
        if (!isRetry) {
            retryCount = 0
            playStartedEmittedForTrack = null
        }
        trackLoadStartTime = System.currentTimeMillis()

        // P0: Cancel any previous resolution in-flight and increment monotonic request ID
        currentResolutionJob?.cancel()
        val requestId = ++resolutionRequestId

        Log.i(TAG, "[AutoAdvanceTrace] RESOLUTION_START requestId=$requestId track=$videoId currentIndex=$currentIndex isRetry=$isRetry hasLocalUrl=${localUrl != null}")

        currentResolutionJob = scope.launch {
            try {
                initialize()
                
                if (requestId != resolutionRequestId || !isActive) {
                    Log.w(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId STALE_BEFORE_INIT (current=$resolutionRequestId) -> IGNORED")
                    return@launch
                }

                updateState(currentState.copy(
                    isBuffering = true,
                    currentTrackId = videoId,
                    error = null
                ))

                val downloadUtil = com.auramusic.core.download.DownloadUtil.getInstance(context)

                // Build initial MediaMetadata from metadataCache, Room database, or Media3 download
                val meta = metadataCache[videoId] ?: withContext(Dispatchers.IO) {
                    try {
                        val db = com.auramusic.core.db.AuraDatabase.getInstance(context)
                        val entity = db.trackDao().getById(videoId)
                        if (entity != null) {
                            TrackMetadata(entity.id, entity.title, entity.artist, entity.album, entity.duration, entity.artworkUrl).also {
                                metadataCache[videoId] = it
                            }
                        } else {
                            // Check Media3 downloadIndex data!
                            val dl = downloadUtil.getDownload(videoId)
                            if (dl != null && dl.request.data.isNotEmpty()) {
                                val raw = String(dl.request.data, Charsets.UTF_8)
                                var t = "Unknown Title"
                                var a = "Unknown Artist"
                                var alb: String? = null
                                var d = 0
                                var art: String? = null
                                if (raw.startsWith("{")) {
                                    val j = org.json.JSONObject(raw)
                                    t = j.optString("title", t)
                                    a = j.optString("artist", a)
                                    alb = j.optString("album").takeIf { it.isNotEmpty() }
                                    d = j.optInt("duration", 0)
                                    art = j.optString("artworkUrl").takeIf { it.isNotEmpty() }
                                } else {
                                    t = raw
                                }
                                val entityFromDl = TrackEntity(
                                    id = videoId,
                                    title = t,
                                    artist = a,
                                    album = alb,
                                    duration = d,
                                    artworkUrl = art ?: "https://i.ytimg.com/vi/$videoId/hqdefault.jpg",
                                    isDownloaded = true,
                                    downloadedAt = System.currentTimeMillis()
                                )
                                db.trackDao().upsert(entityFromDl)
                                TrackMetadata(videoId, t, a, alb, d, art).also {
                                    metadataCache[videoId] = it
                                }
                            } else null
                        }
                    } catch (_: Exception) { null }
                }

                if (requestId != resolutionRequestId || !isActive) {
                    Log.w(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId STALE_AFTER_META (current=$resolutionRequestId) -> IGNORED")
                    return@launch
                }

                // Check local artwork file first (works 100% offline)
                val localArtworkFile = downloadUtil.getLocalArtworkFile(videoId)
                val effectiveArtworkUri = if (localArtworkFile != null) {
                    Uri.fromFile(localArtworkFile)
                } else if (isValidArtworkUri(meta?.artworkUrl)) {
                    Uri.parse(meta?.artworkUrl)
                } else null

                val mediaMetadata = MediaMetadata.Builder()
                    .setTitle(meta?.title ?: videoId)
                    .setArtist(meta?.artist ?: "Unknown Artist")
                    .setAlbumTitle(meta?.album)
                    .setArtworkUri(effectiveArtworkUri)
                    .setIsPlayable(true)
                    .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
                    .build()

                val isDownloaded = downloadUtil.isTrackDownloaded(videoId) || downloadUtil.downloadCache.isCached(videoId, 0, 1024)

                if (isDownloaded && localUrl == null) {
                    if (requestId != resolutionRequestId || !isActive) {
                        Log.w(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId STALE_OFFLINE (current=$resolutionRequestId) -> IGNORED")
                        return@launch
                    }
                    Log.i(TAG, "[PlaybackTrace][OfflinePlayback] OFFLINE_CACHE_HIT requestId=$requestId track=$videoId playing directly from DownloadCache")
                    Log.i(SESSION_TAG, "[MediaSessionTrace] MEDIA_ITEM_SET trackId=$videoId (offline)")
                    val mediaItem = MediaItem.Builder()
                        .setMediaId(videoId)
                        .setUri(Uri.parse("auramusic://track/$videoId"))
                        .setCustomCacheKey(videoId)
                        .setMediaMetadata(mediaMetadata)
                        .build()
                    exoPlayer?.apply {
                        setMediaItem(mediaItem)
                        Log.i(TAG, "[PlaybackTrace][Lifecycle] PREPARE_CALLED requestId=$requestId track=$videoId (offline)")
                        prepare()
                        Log.i(TAG, "[PlaybackTrace][Lifecycle] PLAY_CALLED requestId=$requestId track=$videoId (offline)")
                        play()
                    }
                    ensureServiceRunning()
                    return@launch
                }

                val finalUrl = if (localUrl != null) {
                    Log.i(TAG, "[PlaybackTrace][Lifecycle] Using localUrl for requestId=$requestId track=$videoId")
                    localUrl
                } else {
                    val resolveStart = System.currentTimeMillis()
                    val result = withContext(Dispatchers.IO) {
                        streamResolver.resolve(videoId, currentStreamingQuality)
                    }
                    val resolveElapsed = System.currentTimeMillis() - resolveStart

                    if (requestId != resolutionRequestId || !isActive) {
                        Log.w(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId STALE_AFTER_RESOLVE (current=$resolutionRequestId) -> IGNORED")
                        return@launch
                    }

                    downloadUtil.cacheStreamUrl(videoId, result.url, result.format)
                    val host = try { Uri.parse(result.url).host ?: "unknown" } catch (_: Exception) { "parse_error" }
                    val isHttps = result.url.startsWith("https://")
                    Log.i(TAG, "[PlaybackTrace][Lifecycle] RESOLUTION_SUCCESS requestId=$requestId track=$videoId elapsed=${resolveElapsed}ms host=$host isHttps=$isHttps format=${result.format} codec=${result.codec} bitrate=${result.bitrate}")
                    result.url
                }

                if (requestId != resolutionRequestId || !isActive) {
                    Log.w(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId STALE_BEFORE_SET_ITEM (current=$resolutionRequestId) -> IGNORED")
                    return@launch
                }

                val host = try { Uri.parse(finalUrl).host ?: "unknown" } catch (_: Exception) { "parse_error" }
                Log.i(TAG, "[PlaybackTrace][Lifecycle] MEDIA_ITEM_SET requestId=$requestId track=$videoId host=$host")
                Log.i(SESSION_TAG, "[MediaSessionTrace] MEDIA_ITEM_SET requestId=$requestId trackId=$videoId host=$host")
                val mediaItem = MediaItem.Builder()
                    .setMediaId(videoId)
                    .setUri(finalUrl)
                    .setCustomCacheKey(videoId)
                    .setMediaMetadata(mediaMetadata)
                    .build()
                exoPlayer?.apply {
                    setMediaItem(mediaItem)
                    Log.i(TAG, "[PlaybackTrace][Lifecycle] PREPARE_CALLED requestId=$requestId track=$videoId")
                    prepare()
                    Log.i(TAG, "[PlaybackTrace][Lifecycle] PLAY_CALLED requestId=$requestId track=$videoId")
                    play()
                }
                ensureServiceRunning()
            } catch (e: Exception) {
                if (e is CancellationException) {
                    Log.i(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId CANCELLED gracefully")
                    return@launch
                }
                val elapsed = System.currentTimeMillis() - trackLoadStartTime
                Log.e(TAG, "[PlaybackTrace][Lifecycle] playTrack error requestId=$requestId track=$videoId elapsed=${elapsed}ms: ${e.message}", e)
                if (requestId == resolutionRequestId) {
                    updateState(currentState.copy(isBuffering = false, error = e.message))
                    notifyEvent(PlaybackEvent.ERROR, videoId)
                }
            }
        }
    }

    fun pause() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] PAUSE")
        exoPlayer?.pause()
        notifyEvent(PlaybackEvent.PLAY_PAUSED, currentState.currentTrackId)
    }

    fun resume() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] PLAY / RESUME")
        exoPlayer?.play()
        ensureServiceRunning()
        notifyEvent(PlaybackEvent.PLAY_RESUMED, currentState.currentTrackId)
    }

    fun seekTo(positionMs: Long) {
        Log.i(SESSION_TAG, "[MediaSessionTrace] SEEK positionMs=$positionMs")
        updateState(currentState.copy(positionMs = positionMs))
        exoPlayer?.seekTo(positionMs)
        notifyEvent(PlaybackEvent.SEEKED, currentState.currentTrackId)
    }

    fun stop() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] STOP")
        currentResolutionJob?.cancel()
        exoPlayer?.stop()
        stopProgressUpdates()
        updateState(AuraPlaybackState())
    }

    fun setQueue(videoIds: List<String>) {
        queue.clear()
        queue.addAll(videoIds)
        val curTrack = currentState.currentTrackId
        if (curTrack != null) {
            val idx = queue.indexOf(curTrack)
            if (idx != -1) currentIndex = idx
        }
        Log.i(TAG, "[ShuffleTrace] setQueue nativeSync size=${videoIds.size} currentIndex=$currentIndex currentTrack=${currentState.currentTrackId}")
        Log.i(SESSION_TAG, "[MediaSessionTrace] SET_QUEUE size=${videoIds.size} currentIndex=$currentIndex")
    }

    fun setRepeatMode(mode: String) {
        val normalized = when (mode.lowercase()) {
            "track", "one" -> "track"
            "queue", "all" -> "queue"
            else -> "off"
        }
        val oldMode = repeatMode
        repeatMode = normalized
        Log.i(TAG, "[RepeatTrace] mode changed $oldMode -> $repeatMode (currentIndex=$currentIndex queueSize=${queue.size})")
        Log.i(SESSION_TAG, "[MediaSessionTrace] SET_REPEAT_MODE mode=$repeatMode")
    }

    fun setVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        exoPlayer?.volume = clamped
        Log.i(TAG, "[PlaybackTrace] setVolume volume=$clamped")
    }

    fun skipNext() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] NEXT queueSize=${queue.size} currentIndex=$currentIndex repeatMode=$repeatMode")
        if (queue.isEmpty()) return
        if (repeatMode == "queue") {
            val nextIdx = (currentIndex + 1) % queue.size
            Log.i(TAG, "[AutoAdvanceTrace] skipNext REPEAT_ALL: $currentIndex -> $nextIdx")
            currentIndex = nextIdx
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            playTrack(queue[currentIndex])
        } else {
            if (currentIndex < queue.size - 1) {
                currentIndex++
                Log.i(TAG, "[AutoAdvanceTrace] skipNext: $currentIndex (target=${queue[currentIndex]})")
                notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
                playTrack(queue[currentIndex])
            } else {
                Log.i(TAG, "[AutoAdvanceTrace] skipNext: already at end of queue (index=$currentIndex size=${queue.size}) -> no-op")
            }
        }
    }

    fun skipPrevious() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] PREVIOUS queueSize=${queue.size} currentIndex=$currentIndex repeatMode=$repeatMode")
        if (queue.isEmpty()) return
        // Standard 3-second threshold: if playback position > 3 seconds, restart current track
        val pos = exoPlayer?.currentPosition ?: 0
        if (pos > 3000) {
            Log.i(TAG, "[AutoAdvanceTrace] skipPrevious: position=${pos}ms > 3000ms -> restart current track at 0:00")
            seekTo(0)
            return
        }
        if (repeatMode == "queue") {
            val prevIdx = if (currentIndex <= 0) queue.size - 1 else currentIndex - 1
            Log.i(TAG, "[AutoAdvanceTrace] skipPrevious REPEAT_ALL: $currentIndex -> $prevIdx")
            currentIndex = prevIdx
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            playTrack(queue[currentIndex])
        } else {
            val prevIdx = (currentIndex - 1).coerceAtLeast(0)
            Log.i(TAG, "[AutoAdvanceTrace] skipPrevious: $currentIndex -> $prevIdx")
            currentIndex = prevIdx
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            playTrack(queue[currentIndex])
        }
    }

    fun getState(): AuraPlaybackState = currentState

    fun addStateListener(listener: PlaybackStateListener) { stateListeners.add(listener) }
    fun removeStateListener(listener: PlaybackStateListener) { stateListeners.remove(listener) }
    fun addEventListener(listener: PlaybackEventListener) { eventListeners.add(listener) }
    fun removeEventListener(listener: PlaybackEventListener) { eventListeners.remove(listener) }

    fun release() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] SESSION_RELEASED")
        stopProgressUpdates()
        scope.cancel()
        mediaSession?.release()
        mediaSession = null
        exoPlayer?.release()
        exoPlayer = null
    }

    private fun updateState(newState: AuraPlaybackState) {
        currentState = newState
        stateListeners.forEach { it(newState) }
    }

    private fun notifyEvent(event: PlaybackEvent, trackId: String?) {
        eventListeners.forEach { it(event, trackId) }
    }

    private fun startProgressUpdates() {
        stopProgressUpdates()
        progressJob = scope.launch {
            while (isActive) {
                val player = exoPlayer ?: break
                val currentPos = player.currentPosition
                val currentDur = player.duration.coerceAtLeast(0)
                if (currentState.positionMs != currentPos || currentState.durationMs != currentDur) {
                    updateState(currentState.copy(
                        positionMs = currentPos,
                        durationMs = currentDur
                    ))
                }
                delay(200) // 5 updates per second for silky smooth UI progress & lyrics sync
            }
        }
    }

    private fun stopProgressUpdates() {
        progressJob?.cancel()
        progressJob = null
    }
}
