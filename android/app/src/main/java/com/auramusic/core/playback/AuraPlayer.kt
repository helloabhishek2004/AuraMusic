package com.auramusic.core.playback

import android.content.Context
import android.content.Intent
import android.media.audiofx.AudioEffect
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
import androidx.media3.session.CommandButton
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.auramusic.core.stream.UnifiedStreamResolver
import com.auramusic.core.db.TrackEntity
import com.anonymous.AuraMusic.R
import kotlinx.coroutines.*
import okhttp3.Dns
import java.net.Inet4Address
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CopyOnWriteArraySet

private const val TAG = "NativeCore"
private const val SESSION_TAG = "MediaSessionTrace"
private const val STREAM_RANGE_CHUNK_SIZE = 1_048_576L // 1 MB chunk bounding for Googlevideo CDN

typealias PlaybackStateListener = (AuraPlaybackState) -> Unit
typealias PlaybackEventListener = (PlaybackEvent, String?) -> Unit
typealias LikeToggleListener = (String, Boolean) -> Unit

data class TrackMetadata(
    val id: String,
    val title: String,
    val artist: String,
    val album: String?,
    val duration: Int,
    val artworkUrl: String?,
    val loudnessDb: Double? = null
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
        const val CUSTOM_COMMAND_TOGGLE_LIKE = "com.auramusic.ACTION_TOGGLE_LIKE"

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
    private val likedTrackIds = ConcurrentHashMap.newKeySet<String>()
    private val likeToggleListeners = CopyOnWriteArrayList<LikeToggleListener>()
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
    // Proactive replenishment: debounce QUEUE_NEARING_END per track session
    private var queueNearingEndEmittedForTrack: String? = null
    // Forensic: timestamp of playTrackInternal call for elapsed measurement
    private var trackLoadStartTime: Long = 0L

    // P0: Rapid-skip cancellation & monotonic resolution ID
    @Volatile
    private var currentResolutionJob: Job? = null
    @Volatile
    private var aotJob: Job? = null
    @Volatile
    private var resolutionRequestId: Long = 0L

    private var currentStreamingQuality: String = "high"

    // --- Audio Intelligence: Loudness Normalization ---
    @Volatile
    private var isNormalizationEnabled: Boolean = true
    @Volatile
    private var userMasterVolume: Float = 1.0f
    @Volatile
    private var currentTrackLoudnessDb: Double? = null

    // Audio Session tracking for system/OEM DSP (Dolby, Dirac, etc.)
    private var currentAudioSessionId: Int = 0

    fun setStreamingQuality(quality: String) {
        currentStreamingQuality = quality
        Log.i(TAG, "[QualityTrace] Streaming quality updated to $quality")
    }

    fun getAudioSessionId(): Int {
        val id = exoPlayer?.audioSessionId ?: currentAudioSessionId
        return if (id > 0) id else currentAudioSessionId
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
        updateCustomLayout()
    }

    fun addLikeToggleListener(listener: LikeToggleListener) {
        likeToggleListeners.add(listener)
    }

    fun removeLikeToggleListener(listener: LikeToggleListener) {
        likeToggleListeners.remove(listener)
    }

    private fun notifyLikeToggle(trackId: String, isLiked: Boolean) {
        for (listener in likeToggleListeners) {
            try {
                listener(trackId, isLiked)
            } catch (e: Exception) {
                Log.e(TAG, "Error in like toggle listener: ${e.message}")
            }
        }
    }

    fun setTrackLiked(trackId: String, isLiked: Boolean) {
        if (isLiked) {
            likedTrackIds.add(trackId)
        } else {
            likedTrackIds.remove(trackId)
        }
        if (currentState.currentTrackId == trackId) {
            updateCustomLayout()
        }
    }

    fun syncLikedTrackIds(trackIds: Collection<String>) {
        likedTrackIds.clear()
        likedTrackIds.addAll(trackIds)
        updateCustomLayout()
    }

    fun isTrackLiked(trackId: String?): Boolean {
        if (trackId == null) return false
        return likedTrackIds.contains(trackId)
    }

    @Suppress("DEPRECATION")
    private fun buildLikeButton(isLiked: Boolean): CommandButton {
        val iconRes = if (isLiked) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline
        return CommandButton.Builder()
            .setDisplayName(if (isLiked) "Unlike" else "Like")
            .setIconResId(iconRes)
            .setSessionCommand(SessionCommand(CUSTOM_COMMAND_TOGGLE_LIKE, android.os.Bundle.EMPTY))
            .setEnabled(true)
            .build()
    }

    fun updateCustomLayout() {
        val session = mediaSession ?: return
        val currentTrackId = currentState.currentTrackId
        val isLiked = if (currentTrackId != null) likedTrackIds.contains(currentTrackId) else false
        val customLayout = listOf(buildLikeButton(isLiked))
        try {
            session.setCustomLayout(customLayout)
        } catch (e: Throwable) {
            Log.w(SESSION_TAG, "[MediaSessionTrace] setCustomLayout(layout) error: ${e.message}")
        }
        for (controller in session.connectedControllers) {
            try {
                session.setCustomLayout(controller, customLayout)
            } catch (e: Throwable) {
                Log.w(SESSION_TAG, "[MediaSessionTrace] setCustomLayout(controller, layout) error: ${e.message}")
            }
        }
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
        val forwardingPlayer = createForwardingPlayer(rawPlayer)

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
                val customCmd = SessionCommand(CUSTOM_COMMAND_TOGGLE_LIKE, android.os.Bundle.EMPTY)
                val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
                    .add(customCmd)
                    .build()
                val playerCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
                    .add(Player.COMMAND_SEEK_TO_NEXT)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                    .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                    .add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
                    .add(Player.COMMAND_PLAY_PAUSE)
                    .build()

                val currentTrackId = currentState.currentTrackId
                val isLiked = if (currentTrackId != null) likedTrackIds.contains(currentTrackId) else false
                val customLayout = listOf(buildLikeButton(isLiked))

                return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                    .setAvailableSessionCommands(sessionCommands)
                    .setAvailablePlayerCommands(playerCommands)
                    .setCustomLayout(customLayout)
                    .build()
            }

            override fun onPostConnect(session: MediaSession, controller: MediaSession.ControllerInfo) {
                val currentTrackId = currentState.currentTrackId
                val isLiked = if (currentTrackId != null) likedTrackIds.contains(currentTrackId) else false
                try {
                    session.setCustomLayout(controller, listOf(buildLikeButton(isLiked)))
                } catch (e: Exception) {
                    Log.w(SESSION_TAG, "[MediaSessionTrace] onPostConnect setCustomLayout error: ${e.message}")
                }
            }

            override fun onCustomCommand(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
                customCommand: SessionCommand,
                args: android.os.Bundle
            ): ListenableFuture<SessionResult> {
                if (customCommand.customAction == CUSTOM_COMMAND_TOGGLE_LIKE) {
                    val currentTrackId = currentState.currentTrackId
                    if (currentTrackId != null) {
                        val wasLiked = likedTrackIds.contains(currentTrackId)
                        val newLikedState = !wasLiked
                        if (newLikedState) {
                            likedTrackIds.add(currentTrackId)
                        } else {
                            likedTrackIds.remove(currentTrackId)
                        }
                        updateCustomLayout()
                        notifyLikeToggle(currentTrackId, newLikedState)
                        Log.i(SESSION_TAG, "[MediaSessionTrace] LIKE_TOGGLED via controller pkg=${controller.packageName} trackId=$currentTrackId newLiked=$newLikedState")
                    }
                    return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
                }
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_NOT_SUPPORTED))
            }
        }

        mediaSession = MediaSession.Builder(context, forwardingPlayer)
            .setSessionActivity(pendingIntent)
            .setCallback(sessionCallback)
            .build()

        Log.i(SESSION_TAG, "[MediaSessionTrace] CREATED")

        attachPlayerListeners(rawPlayer)
    }

    private fun createForwardingPlayer(player: ExoPlayer): ForwardingPlayer {
        return object : ForwardingPlayer(player) {
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
    }

    private fun attachPlayerListeners(player: ExoPlayer) {
        player.addAnalyticsListener(object : androidx.media3.exoplayer.analytics.AnalyticsListener {
            override fun onAudioSessionIdChanged(
                eventTime: androidx.media3.exoplayer.analytics.AnalyticsListener.EventTime,
                audioSessionId: Int
            ) {
                if (audioSessionId > 0 && audioSessionId != currentAudioSessionId) {
                    updateAudioSession(audioSessionId)
                }
            }
        })
        if (player.audioSessionId > 0) {
            updateAudioSession(player.audioSessionId)
        }
        player.addListener(playerListener)
    }

    private val playerListener = object : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val trackId = mediaItem?.mediaId ?: currentState.currentTrackId
            Log.i(TAG, "[PlaybackTrace][Lifecycle] onMediaItemTransition trackId=$trackId reason=$reason")
            Log.i(SESSION_TAG, "[MediaSessionTrace] onMediaItemTransition trackId=$trackId reason=$reason")
            if (trackId != null) {
                val qIdx = queue.indexOf(trackId)
                if (qIdx != -1) {
                    currentIndex = qIdx
                }

                val meta = metadataCache[trackId]
                val durMs = if ((meta?.duration ?: 0) > 0) meta!!.duration.toLong() * 1000L else exoPlayer?.duration?.coerceAtLeast(0) ?: 0L

                // Audio Intelligence: Update loudness normalization for transitioned track
                currentTrackLoudnessDb = meta?.loudnessDb
                updateEffectiveVolume()
                if (currentTrackLoudnessDb == null) {
                    scope.launch(Dispatchers.IO) {
                        try {
                            val db = com.auramusic.core.db.AuraDatabase.getInstance(context)
                            val entity = db.trackDao().getById(trackId)
                            if (entity?.loudnessDb != null) {
                                withContext(Dispatchers.Main) {
                                    if (currentState.currentTrackId == trackId) {
                                        currentTrackLoudnessDb = entity.loudnessDb
                                        updateEffectiveVolume()
                                    }
                                }
                            }
                        } catch (_: Exception) {}
                    }
                }

                updateState(currentState.copy(
                    currentTrackId = trackId,
                    currentMediaIndex = currentIndex,
                    durationMs = durMs
                ))
                updateMediaMetadataForCurrentTrack()

                // Single source of truth for play started
                if (playStartedEmittedForTrack != trackId) {
                    playStartedEmittedForTrack = trackId
                    Log.i(TAG, "[PlaybackTrace][Lifecycle] PLAY_STARTED track=$trackId")
                    notifyEvent(PlaybackEvent.PLAY_STARTED, trackId)
                }

                // Proactive queue replenishment trigger:
                // When remaining tracks <= 2, emit QUEUE_NEARING_END once per track transition
                val remaining = queue.size - 1 - currentIndex
                if (remaining in 0..2 && queueNearingEndEmittedForTrack != trackId) {
                    queueNearingEndEmittedForTrack = trackId
                    Log.i(TAG, "[PlaybackTrace][Queue] QUEUE_NEARING_END emitted track=$trackId remaining=$remaining queueSize=${queue.size}")
                    notifyEvent(PlaybackEvent.QUEUE_NEARING_END, trackId)
                }

                // Controlled timeline reconciliation and AOT resolution for next track
                val gen = resolutionRequestId
                scope.launch(Dispatchers.Main) {
                    reconcileTimeline(trackId, gen)
                }
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

                    // In Media3 timeline architecture, STATE_ENDED fires only when the timeline
                    // has no more media items to transition to (queue exhausted or AOT pending).
                    when (repeatMode) {
                        "track" -> {
                            seekTo(0)
                            exoPlayer?.play()
                        }
                        "queue" -> {
                            if (queue.isNotEmpty()) {
                                val nextIdx = (currentIndex + 1) % queue.size
                                Log.i(TAG, "[AOT] STATE_ENDED fallback wrap-around: $currentIndex -> $nextIdx (size=${queue.size})")
                                currentIndex = nextIdx
                                playTrack(queue[currentIndex])
                            }
                        }
                        else -> { // "off"
                            if (queue.isNotEmpty() && currentIndex < queue.size - 1) {
                                currentIndex++
                                Log.i(TAG, "[AOT] STATE_ENDED fallback on-demand resolution for index $currentIndex (size=${queue.size})")
                                playTrack(queue[currentIndex])
                            } else {
                                Log.i(TAG, "[AutoAdvanceTrace] REPEAT_OFF: reached true queue end (index=$currentIndex size=${queue.size}) -> STOP")
                                updateState(currentState.copy(isPlaying = false, isBuffering = false))
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

            Log.e(TAG, "[PlaybackTrace][Error] ExoPlayer error track=$trackId elapsed=${elapsed}ms retryCount=$retryCount/$MAX_RETRIES")
            Log.e(TAG, "[PlaybackTrace][Error] errorCode=${error.errorCode} errorCodeName=${error.errorCodeName}")
            Log.e(TAG, "[PlaybackTrace][Error] message=${error.message}")

            // Unwrap cause chain for HTTP/CDN errors
            var is403 = false
            var cause: Throwable? = error.cause
            var depth = 0
            while (cause != null && depth < 5) {
                Log.e(TAG, "[PlaybackTrace][Error] cause[$depth]: ${cause.javaClass.simpleName}: ${cause.message}")
                if (cause is androidx.media3.datasource.HttpDataSource.InvalidResponseCodeException &&
                    (cause.responseCode == 403 || cause.responseCode == 410 || cause.responseCode == 416)
                ) {
                    is403 = true
                    Log.w(TAG, "[PlaybackTrace][Error] Detected expired/forbidden stream URL (HTTP ${cause.responseCode}) for $trackId")
                }
                cause = cause.cause
                depth++
            }

            if (is403 && trackId != null) {
                com.auramusic.core.download.DownloadUtil.getInstance(context).invalidateStreamUrl(trackId)
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
    }

    private fun ensureServiceRunning() {
        try {
            val intent = Intent(context, AuraMediaSessionService::class.java)
            context.startService(intent)
        } catch (e: Exception) {
            Log.w(TAG, "[PlaybackTrace] Service start exception: ${e.message}")
        }
    }

    private suspend fun resolveTrackMetadata(videoId: String): TrackMetadata {
        // Level 1: In-memory cache
        metadataCache[videoId]?.let { return it }

        // Level 2: Room database
        try {
            val db = com.auramusic.core.db.AuraDatabase.getInstance(context)
            val entity = withContext(Dispatchers.IO) { db.trackDao().getById(videoId) }
            if (entity != null) {
                val meta = TrackMetadata(entity.id, entity.title, entity.artist, entity.album, entity.duration, entity.artworkUrl, entity.loudnessDb)
                metadataCache[videoId] = meta
                return meta
            }
        } catch (_: Exception) {}

        // Level 3: Media3 download request data
        try {
            val downloadUtil = com.auramusic.core.download.DownloadUtil.getInstance(context)
            val dl = downloadUtil.getDownload(videoId)
            if (dl != null && dl.request.data.isNotEmpty()) {
                val raw = String(dl.request.data, Charsets.UTF_8)
                var t = "Unknown Title"
                var a = "Unknown Artist"
                var alb: String? = null
                var d = 0
                var art: String? = null
                var loudness: Double? = null
                if (raw.startsWith("{")) {
                    val j = org.json.JSONObject(raw)
                    t = j.optString("title", t)
                    a = j.optString("artist", a)
                    alb = j.optString("album").takeIf { it.isNotEmpty() }
                    d = j.optInt("duration", 0)
                    art = j.optString("artworkUrl").takeIf { it.isNotEmpty() }
                    if (j.has("loudnessDb") && !j.isNull("loudnessDb")) {
                        loudness = j.optDouble("loudnessDb")
                    }
                } else {
                    t = raw
                }
                val meta = TrackMetadata(videoId, t, a, alb, d, art, loudness)
                metadataCache[videoId] = meta
                return meta
            }
        } catch (_: Exception) {}

        // Level 4: Minimal identity
        return TrackMetadata(videoId, videoId, "Unknown Artist", null, 0, null, null)
    }

    private suspend fun resolveMediaItem(videoId: String, localUrl: String? = null): MediaItem {
        val downloadUtil = com.auramusic.core.download.DownloadUtil.getInstance(context)
        val meta = resolveTrackMetadata(videoId)

        // Check local artwork file first (100% offline support)
        val localArtworkFile = downloadUtil.getLocalArtworkFile(videoId)
        val effectiveArtworkUri = if (localArtworkFile != null) {
            Uri.fromFile(localArtworkFile)
        } else if (isValidArtworkUri(meta.artworkUrl)) {
            Uri.parse(meta.artworkUrl)
        } else null

        val mediaMetadata = MediaMetadata.Builder()
            .setTitle(meta.title)
            .setArtist(meta.artist)
            .setAlbumTitle(meta.album)
            .setArtworkUri(effectiveArtworkUri)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
            .build()

        // Verify physical download asset exists on disk (do not rely on Room alone)
        val isPhysicallyDownloaded = downloadUtil.isTrackDownloaded(videoId) && downloadUtil.downloadCache.isCached(videoId, 0, 1024)

        val uri = if (isPhysicallyDownloaded && localUrl == null) {
            Log.i(TAG, "[AOT][Stream] track=$videoId source=downloaded_cache uri=auramusic://track/$videoId")
            Uri.parse("auramusic://track/$videoId")
        } else if (localUrl != null) {
            Log.i(TAG, "[AOT][Stream] track=$videoId source=local_url uri=$localUrl")
            Uri.parse(localUrl)
        } else {
            // Check in-memory stream URL cache first
            val cachedUrl = downloadUtil.getCachedStreamUrl(videoId)
            if (cachedUrl != null) {
                Log.i(TAG, "[AOT][Stream] track=$videoId source=cached_stream_url")
                Uri.parse(cachedUrl)
            } else {
                // Online resolution via UnifiedStreamResolver (InnerTube -> AndroidVR)
                val resolveStart = System.currentTimeMillis()
                val result = withContext(Dispatchers.IO) {
                    streamResolver.resolve(videoId, currentStreamingQuality)
                }
                val resolveElapsed = System.currentTimeMillis() - resolveStart
                downloadUtil.cacheStreamUrl(videoId, result.url, result.format)
                Log.i(TAG, "[AOT][Stream] track=$videoId source=online_resolved elapsed=${resolveElapsed}ms format=${result.format} bitrate=${result.bitrate} loudnessDb=${result.loudnessDb}")
                if (result.loudnessDb != null) {
                    val updatedMeta = meta.copy(loudnessDb = result.loudnessDb)
                    metadataCache[videoId] = updatedMeta
                    if (currentState.currentTrackId == videoId) {
                        currentTrackLoudnessDb = result.loudnessDb
                        withContext(Dispatchers.Main) {
                            updateEffectiveVolume()
                        }
                    }
                    try {
                        val db = com.auramusic.core.db.AuraDatabase.getInstance(context)
                        withContext(Dispatchers.IO) {
                            db.trackDao().updateLoudness(videoId, result.loudnessDb)
                        }
                    } catch (_: Exception) {}
                }
                Uri.parse(result.url)
            }
        }

        return MediaItem.Builder()
            .setMediaId(videoId)
            .setUri(uri)
            .setCustomCacheKey(videoId)
            .setMediaMetadata(mediaMetadata)
            .build()
    }

    private fun scheduleAotResolution(currentTrackId: String, currentRequestId: Long) {
        aotJob?.cancel()
        if (repeatMode == "track") {
            Log.i(TAG, "[AOT] Repeat mode is 'track', skipping AOT resolution (ExoPlayer loops natively)")
            return
        }
        if (queue.isEmpty()) return

        val currentQueueIdx = queue.indexOf(currentTrackId)
        if (currentQueueIdx == -1) {
            Log.w(TAG, "[AOT] currentTrackId=$currentTrackId not in queue, skipping AOT")
            return
        }

        val nextIdx = when (repeatMode) {
            "queue" -> (currentQueueIdx + 1) % queue.size
            else -> if (currentQueueIdx < queue.size - 1) currentQueueIdx + 1 else -1
        }

        if (nextIdx == -1) {
            Log.i(TAG, "[AOT] Queue reaches end at index $currentQueueIdx, no next track to resolve ahead of time")
            return
        }

        val nextTrackId = queue[nextIdx]

        // Check if next track is already attached in ExoPlayer timeline as the next item
        val player = exoPlayer ?: return
        val curTimelineIdx = player.currentMediaItemIndex
        if (curTimelineIdx >= 0 && curTimelineIdx < player.mediaItemCount - 1) {
            val existingNext = player.getMediaItemAt(curTimelineIdx + 1)
            if (existingNext.mediaId == nextTrackId) {
                Log.i(TAG, "[AOT] Next track $nextTrackId is already attached in timeline at index ${curTimelineIdx + 1}")
                return
            }
        }

        Log.i(TAG, "[AOT] Scheduling AOT resolution for next track=$nextTrackId (generation=$currentRequestId currentTrack=$currentTrackId)")

        aotJob = scope.launch(Dispatchers.IO) {
            try {
                if (currentRequestId != resolutionRequestId || !isActive) {
                    Log.w(TAG, "[AOT] Stale before resolve for track=$nextTrackId (gen=$currentRequestId current=$resolutionRequestId)")
                    return@launch
                }

                val nextMediaItem = resolveMediaItem(nextTrackId)

                withContext(Dispatchers.Main) {
                    if (currentRequestId != resolutionRequestId || !isActive) {
                        Log.w(TAG, "[AOT] Stale after resolve for track=$nextTrackId (gen=$currentRequestId current=$resolutionRequestId)")
                        return@withContext
                    }
                    if (currentState.currentTrackId != currentTrackId) {
                        Log.w(TAG, "[AOT] Active track changed from $currentTrackId to ${currentState.currentTrackId}, discarding AOT for $nextTrackId")
                        return@withContext
                    }

                    val p = exoPlayer ?: return@withContext
                    val currentIdxInPlayer = p.currentMediaItemIndex
                    if (currentIdxInPlayer < 0) return@withContext

                    // Remove any obsolete forward items beyond the current playing item
                    if (p.mediaItemCount > currentIdxInPlayer + 1) {
                        Log.i(TAG, "[AOT] Removing obsolete forward items (${currentIdxInPlayer + 1} to ${p.mediaItemCount})")
                        p.removeMediaItems(currentIdxInPlayer + 1, p.mediaItemCount)
                    }

                    // Attach the pre-resolved next media item into the ExoPlayer timeline
                    p.addMediaItem(nextMediaItem)
                    Log.i(TAG, "[AOT] Successfully attached nextMediaItem to ExoPlayer timeline: trackId=$nextTrackId timelineCount=${p.mediaItemCount}")
                }
            } catch (e: Exception) {
                if (e is CancellationException) {
                    Log.i(TAG, "[AOT] AOT resolution cancelled for track=$nextTrackId")
                } else {
                    Log.w(TAG, "[AOT] AOT resolution failed for track=$nextTrackId: ${e.message} (playback of $currentTrackId continues)")
                }
            }
        }
    }

    private fun reconcileTimeline(currentTrackId: String, currentRequestId: Long) {
        val player = exoPlayer ?: return
        val curTimelineIdx = player.currentMediaItemIndex
        if (curTimelineIdx > 1) {
            // Keep at most 1 item behind the current item to keep memory bounded
            val itemsToRemove = curTimelineIdx - 1
            Log.i(TAG, "[Timeline] Bounded timeline: pruning $itemsToRemove played items before index ${curTimelineIdx - 1}")
            player.removeMediaItems(0, itemsToRemove)
        }
        scheduleAotResolution(currentTrackId, currentRequestId)
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
            queueNearingEndEmittedForTrack = null
        }
        trackLoadStartTime = System.currentTimeMillis()

        // P0: Cancel any previous resolution in-flight and increment monotonic request ID
        currentResolutionJob?.cancel()
        aotJob?.cancel()
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
                    currentMediaIndex = currentIndex,
                    error = null
                ))

                val mediaItem = withContext(Dispatchers.IO) {
                    resolveMediaItem(videoId, localUrl)
                }

                if (requestId != resolutionRequestId || !isActive) {
                    Log.w(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId STALE_AFTER_RESOLVE (current=$resolutionRequestId) -> IGNORED")
                    return@launch
                }

                val player = exoPlayer ?: return@launch
                Log.i(TAG, "[PlaybackTrace][Lifecycle] SET_MEDIA_ITEM requestId=$requestId track=$videoId")
                Log.i(SESSION_TAG, "[MediaSessionTrace] SET_MEDIA_ITEM requestId=$requestId trackId=$videoId")

                player.setMediaItem(mediaItem)
                player.prepare()
                player.play()

                ensureServiceRunning()

                // Immediately schedule AOT resolution for the next track
                scheduleAotResolution(videoId, requestId)
            } catch (e: Exception) {
                if (e is CancellationException) {
                    Log.i(TAG, "[AutoAdvanceTrace] requestId=$requestId track=$videoId CANCELLED gracefully")
                    return@launch
                }
                val elapsed = System.currentTimeMillis() - trackLoadStartTime
                Log.e(TAG, "[PlaybackTrace][Lifecycle] playTrack error requestId=$requestId track=$videoId elapsed=${elapsed}ms: ${e.message}", e)
                if (requestId == resolutionRequestId) {
                    if (retryCount < MAX_RETRIES) {
                        retryCount++
                        Log.w(TAG, "[PlaybackTrace] Retrying playTrackInternal for $videoId (attempt $retryCount/$MAX_RETRIES)")
                        playTrackInternal(videoId, localUrl, isRetry = true)
                    } else {
                        updateState(currentState.copy(isBuffering = false, error = e.message))
                        notifyEvent(PlaybackEvent.ERROR, videoId)
                        retryCount = 0
                    }
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
        aotJob?.cancel()
        exoPlayer?.stop()
        stopProgressUpdates()
        updateState(AuraPlaybackState())
    }

    fun setQueue(videoIds: List<String>) {
        queue.clear()
        queue.addAll(videoIds)
        queueNearingEndEmittedForTrack = null
        val curTrack = currentState.currentTrackId
        if (curTrack != null) {
            val idx = queue.indexOf(curTrack)
            if (idx != -1) currentIndex = idx
        }
        Log.i(TAG, "[ShuffleTrace] setQueue nativeSync size=${videoIds.size} currentIndex=$currentIndex currentTrack=${currentState.currentTrackId}")
        Log.i(SESSION_TAG, "[MediaSessionTrace] SET_QUEUE size=${videoIds.size} currentIndex=$currentIndex")

        // Reconcile AOT next item with updated queue
        if (curTrack != null) {
            val gen = resolutionRequestId
            scope.launch(Dispatchers.Main) {
                scheduleAotResolution(curTrack, gen)
            }
        }
    }

    fun appendQueue(videoIds: List<String>) {
        val newItems = videoIds.filter { !queue.contains(it) }
        if (newItems.isEmpty()) return
        queue.addAll(newItems)
        Log.i(TAG, "[QueueReplenish] appendQueue added ${newItems.size} items, new queueSize=${queue.size}")
        Log.i(SESSION_TAG, "[MediaSessionTrace] APPEND_QUEUE newSize=${queue.size}")

        // Reconcile AOT next item with updated queue
        val curTrack = currentState.currentTrackId
        if (curTrack != null) {
            val gen = resolutionRequestId
            scope.launch(Dispatchers.Main) {
                scheduleAotResolution(curTrack, gen)
            }
        }
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

        if (normalized == "track") {
            exoPlayer?.repeatMode = Player.REPEAT_MODE_ONE
            val p = exoPlayer
            val curIdx = p?.currentMediaItemIndex ?: -1
            if (p != null && curIdx >= 0 && p.mediaItemCount > curIdx + 1) {
                p.removeMediaItems(curIdx + 1, p.mediaItemCount)
            }
        } else {
            exoPlayer?.repeatMode = Player.REPEAT_MODE_OFF
            val curTrack = currentState.currentTrackId
            if (curTrack != null) {
                val gen = resolutionRequestId
                scope.launch(Dispatchers.Main) {
                    scheduleAotResolution(curTrack, gen)
                }
            }
        }
    }

    // --- Audio Intelligence: Loudness Normalization Implementation ---
    fun calculateNormalizationGain(loudnessDb: Double?): Float {
        if (!isNormalizationEnabled || loudnessDb == null || loudnessDb.isNaN() || loudnessDb.isInfinite()) {
            return 1.0f
        }
        // YouTube audio target reference is -14 LUFS.
        // audioConfig.loudnessDb represents content loudness relative to reference (dB).
        // Negative loudnessDb means track is quiet -> boost (capped at +3 dB headroom to prevent clipping).
        // Positive loudnessDb means track is loud -> attenuate (clamped down to -15 dB).
        val clampedGainDb = (-loudnessDb).coerceIn(-15.0, 3.0)
        return Math.pow(10.0, clampedGainDb / 20.0).toFloat()
    }

    private fun updateEffectiveVolume() {
        val normGain = calculateNormalizationGain(currentTrackLoudnessDb)
        val effectiveVolume = (userMasterVolume * normGain).coerceIn(0f, 1f)
        Log.i(TAG, "[Normalization] effectiveVolume=$effectiveVolume (userMasterVolume=$userMasterVolume normGain=$normGain loudnessDb=$currentTrackLoudnessDb enabled=$isNormalizationEnabled)")
        exoPlayer?.volume = effectiveVolume
    }

    fun setNormalizeVolume(enabled: Boolean) {
        if (isNormalizationEnabled != enabled) {
            isNormalizationEnabled = enabled
            updateEffectiveVolume()
            Log.i(TAG, "[Normalization] setNormalizeVolume: enabled=$enabled")
        }
    }

    // --- System / OEM Audio Effect Session Management ---
    @Synchronized
    private fun updateAudioSession(sessionId: Int) {
        if (sessionId <= 0 || sessionId == currentAudioSessionId) return
        closeAudioEffectSession()
        currentAudioSessionId = sessionId
        openAudioEffectSession(sessionId)
        Log.i(TAG, "[AudioEffectSession] Broadcasted open session for sessionId=$sessionId")
    }

    private fun openAudioEffectSession(sessionId: Int) {
        try {
            val intent = Intent(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION).apply {
                putExtra(AudioEffect.EXTRA_AUDIO_SESSION, sessionId)
                putExtra(AudioEffect.EXTRA_PACKAGE_NAME, context.packageName)
                putExtra(AudioEffect.EXTRA_CONTENT_TYPE, AudioEffect.CONTENT_TYPE_MUSIC)
            }
            context.sendBroadcast(intent)
        } catch (_: Exception) {}
    }

    private fun closeAudioEffectSession() {
        val sessionId = currentAudioSessionId
        if (sessionId > 0) {
            try {
                val intent = Intent(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION).apply {
                    putExtra(AudioEffect.EXTRA_AUDIO_SESSION, sessionId)
                    putExtra(AudioEffect.EXTRA_PACKAGE_NAME, context.packageName)
                }
                context.sendBroadcast(intent)
            } catch (_: Exception) {}
        }
    }

    fun openSystemEqualizer(): Boolean {
        return try {
            val sessionId = getAudioSessionId()
            val intent = Intent(AudioEffect.ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL).apply {
                if (sessionId > 0) {
                    putExtra(AudioEffect.EXTRA_AUDIO_SESSION, sessionId)
                }
                putExtra(AudioEffect.EXTRA_PACKAGE_NAME, context.packageName)
                putExtra(AudioEffect.EXTRA_CONTENT_TYPE, AudioEffect.CONTENT_TYPE_MUSIC)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                Log.i(TAG, "[Equalizer] Launched system equalizer panel (session=$sessionId)")
                true
            } else {
                Log.w(TAG, "[Equalizer] No system equalizer activity found on device")
                false
            }
        } catch (e: Exception) {
            Log.w(TAG, "[Equalizer] Failed to open system equalizer: ${e.message}")
            false
        }
    }

    fun setVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        userMasterVolume = clamped
        updateEffectiveVolume()
        Log.i(TAG, "[PlaybackTrace] setVolume masterVolume=$clamped")
    }

    fun skipNext() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] NEXT queueSize=${queue.size} currentIndex=$currentIndex repeatMode=$repeatMode")
        if (queue.isEmpty()) return

        val targetIdx = if (repeatMode == "queue") {
            (currentIndex + 1) % queue.size
        } else {
            if (currentIndex < queue.size - 1) currentIndex + 1 else -1
        }

        if (targetIdx == -1) {
            Log.i(TAG, "[AutoAdvanceTrace] skipNext: already at end of queue -> no-op")
            return
        }

        val targetTrackId = queue[targetIdx]
        val player = exoPlayer
        val curIdx = player?.currentMediaItemIndex ?: -1
        val hasNextInTimeline = player != null && curIdx >= 0 && curIdx < player.mediaItemCount - 1
        val nextItem = if (hasNextInTimeline) player.getMediaItemAt(curIdx + 1) else null

        if (player != null && nextItem != null && nextItem.mediaId == targetTrackId) {
            Log.i(TAG, "[AOT] skipNext: target $targetTrackId already in timeline at ${curIdx + 1}, executing seekToNextMediaItem()")
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            player.seekToNextMediaItem()
        } else {
            Log.i(TAG, "[AOT] skipNext: target $targetTrackId not in timeline, falling back to direct playTrack")
            currentIndex = targetIdx
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            playTrack(targetTrackId)
        }
    }

    fun skipPrevious() {
        Log.i(SESSION_TAG, "[MediaSessionTrace] PREVIOUS queueSize=${queue.size} currentIndex=$currentIndex repeatMode=$repeatMode")
        if (queue.isEmpty()) return

        val pos = exoPlayer?.currentPosition ?: 0
        if (pos > 3000) {
            Log.i(TAG, "[AutoAdvanceTrace] skipPrevious: position=${pos}ms > 3000ms -> restart current track at 0:00")
            seekTo(0)
            return
        }

        val targetIdx = if (repeatMode == "queue") {
            if (currentIndex <= 0) queue.size - 1 else currentIndex - 1
        } else {
            (currentIndex - 1).coerceAtLeast(0)
        }

        val targetTrackId = queue[targetIdx]
        val player = exoPlayer
        val curIdx = player?.currentMediaItemIndex ?: -1
        val hasPrevInTimeline = player != null && curIdx > 0
        val prevItem = if (hasPrevInTimeline) player?.getMediaItemAt(curIdx - 1) else null

        if (player != null && prevItem != null && prevItem.mediaId == targetTrackId) {
            Log.i(TAG, "[AOT] skipPrevious: target $targetTrackId is in timeline at ${curIdx - 1}, executing seekToPreviousMediaItem()")
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            player.seekToPreviousMediaItem()
        } else {
            Log.i(TAG, "[AOT] skipPrevious: target $targetTrackId not in timeline, calling playTrack")
            currentIndex = targetIdx
            notifyEvent(PlaybackEvent.PLAY_SKIPPED, currentState.currentTrackId)
            playTrack(targetTrackId)
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
        aotJob?.cancel()
        currentResolutionJob?.cancel()
        scope.cancel()
        closeAudioEffectSession()
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
