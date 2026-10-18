package com.auramusic.core.stream

import android.content.Context
import android.util.Log
import com.auramusic.core.botguard.PoTokenGenerator
import com.auramusic.core.botguard.VisitorDataManager
import com.metrolist.innertubex.InnerTube
import com.metrolist.innertubex.InnerTubeLogLevel
import com.metrolist.innertubex.InnerTubeLogger
import com.metrolist.innertubex.cipher.PlayerConfigRepository
import com.metrolist.innertubex.cipher.RemotePlayerConfigStore
import com.metrolist.innertubex.cipher.YouTubeCipherService
import com.metrolist.innertubex.extraction.AudioQuality
import com.metrolist.innertubex.extraction.ContentHints
import com.metrolist.innertubex.extraction.ExtractedStream
import com.metrolist.innertubex.extraction.InnerTubeExtractor
import com.metrolist.innertubex.extraction.PoTokenResult as InnerTubePoTokenResult
import com.metrolist.innertubex.extraction.TokenProvider
import com.metrolist.innertubex.extraction.TokenProviderCapabilities
import com.metrolist.innertubex.extraction.YtConfigParserImpl
import com.metrolist.innertubex.extraction.generateClientPlaybackNonce
import com.metrolist.innertubex.extraction.strategy.PoTokenProviderKind
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.util.concurrent.TimeUnit

class InnerTubeStreamResolver(private val context: Context) {
    private val TAG = "InnerTubeStreamResolver"
    private val visitorDataManager = VisitorDataManager()
    private val poTokenGenerator = PoTokenGenerator(context)
    private val bundleMutex = Mutex()

    private val httpClient by lazy {
        HttpClient(OkHttp) {
            expectSuccess = false
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                        explicitNulls = false
                        encodeDefaults = true
                    }
                )
            }
            engine {
                config {
                    connectionPool(okhttp3.ConnectionPool(10, 5, TimeUnit.MINUTES))
                    connectTimeout(30, TimeUnit.SECONDS)
                    readTimeout(60, TimeUnit.SECONDS)
                    writeTimeout(60, TimeUnit.SECONDS)
                    protocols(listOf(okhttp3.Protocol.HTTP_2, okhttp3.Protocol.HTTP_1_1))
                }
            }
        }
    }

    private val innerTube by lazy {
        InnerTube(httpClient)
    }

    private val configRepository: PlayerConfigRepository by lazy {
        AndroidPlayerConfigRepository(context)
    }

    private val logger = InnerTubeLogger { event ->
        val details = event.details.entries.joinToString(prefix = " [", postfix = "]") { "${it.key}=${it.value}" }
        val message = event.message + details.takeUnless { event.details.isEmpty() }.orEmpty()
        when (event.level) {
            InnerTubeLogLevel.DEBUG -> Log.d("NativeCore", "[PlaybackTrace][InnerTubeX] $message")
            InnerTubeLogLevel.INFO -> Log.i("NativeCore", "[PlaybackTrace][InnerTubeX] $message")
            InnerTubeLogLevel.WARN -> Log.w("NativeCore", "[PlaybackTrace][InnerTubeX] $message")
            InnerTubeLogLevel.ERROR -> Log.e("NativeCore", "[PlaybackTrace][InnerTubeX] $message")
        }
    }

    private val tokenProvider = object : TokenProvider {
        override val capabilities = TokenProviderCapabilities(
            providers = setOf(PoTokenProviderKind.WEB_BOTGUARD),
            usesWebView = true,
        )

        override suspend fun getPoToken(
            videoId: String,
            visitorData: String,
            cookie: String?,
        ): InnerTubePoTokenResult? {
            val session = if (visitorData.isNotEmpty()) visitorData else (visitorDataManager.getVisitorData() ?: "")
            return poTokenGenerator.getWebClientPoToken(videoId, session)?.let { token ->
                InnerTubePoTokenResult(
                    playerRequestToken = token.playerRequestPoToken,
                    streamingDataToken = token.streamingDataPoToken,
                    visitorData = session,
                )
            }
        }

        override suspend fun prewarm(cookie: String?) {
            val session = visitorDataManager.getVisitorData() ?: ""
            if (session.isNotEmpty()) {
                poTokenGenerator.getWebClientPoToken("jNQXAC9IVRw", session)
            }
        }

        override suspend fun close() {
            poTokenGenerator.close()
        }
    }

    private var currentExtractor: InnerTubeExtractor? = null

    private suspend fun getExtractor(): InnerTubeExtractor = bundleMutex.withLock {
        currentExtractor?.let { return it }
        val remoteStore = RemotePlayerConfigStore(httpClient, configRepository, logger)
        val cipherService = YouTubeCipherService(httpClient, remoteStore, logger)
        val extractor = InnerTubeExtractor(
            configParser = YtConfigParserImpl(
                httpClient,
                innerTube,
                remoteStore,
                logger,
            ),
            cipherService = cipherService,
            innerTube = innerTube,
            tokenProvider = tokenProvider,
            logger = logger,
        )
        currentExtractor = extractor
        extractor
    }

    suspend fun resolveStream(videoId: String, quality: String? = null): StreamResolutionResult = withContext(Dispatchers.IO) {
        val targetQuality = when (quality?.lowercase()?.trim()) {
            "low" -> AudioQuality.LOW
            "normal", "medium" -> AudioQuality.AUTO
            "high", "best" -> AudioQuality.HIGH
            else -> AudioQuality.AUTO
        }
        Log.i("NativeCore", "[PlaybackTrace] InnerTubeX extracting unthrottled stream for track=$videoId quality=$quality (targetQuality=$targetQuality)")
        val extractor = getExtractor()
        val hints = ContentHints().withStreamCapabilities(
            allowHls = false,
            allowSabr = false,
            allowBoundedRange = true,
        )

        val stream: ExtractedStream = requireNotNull(
            extractor.extract(
                videoId = videoId,
                hints = hints,
                excludedClients = emptySet(),
                audioQuality = targetQuality,
                clientPlaybackNonce = generateClientPlaybackNonce(),
            )
        ) { "InnerTubeX returned no playable stream for $videoId" }

        val audioUrl = stream.audioUrl
        val mimeType = if (stream.codecs.isNullOrBlank()) {
            stream.mimeType.orEmpty()
        } else {
            "${stream.mimeType.orEmpty()}; codecs=\"${stream.codecs}\""
        }

        Log.i("NativeCore", "[PlaybackTrace] InnerTubeX stream resolved! client=${stream.clientName} itag=${stream.itag} urlLength=${audioUrl.length}")
        Log.i("NativeCore", "[QualityTrace] InnerTube resolved stream: track=$videoId requestedQuality=$quality targetQuality=$targetQuality itag=${stream.itag} bitrate=${stream.bitrate} codec=${stream.codecs} client=${stream.clientName}")

        StreamResolutionResult(
            url = audioUrl,
            format = mimeType.ifEmpty { "audio/mp4" },
            codec = stream.codecs.orEmpty(),
            bitrate = stream.bitrate ?: 128000,
            userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            loudnessDb = stream.loudnessDb,
            perceptualLoudnessDb = stream.perceptualLoudnessDb,
            itag = stream.itag,
            resolver = "InnerTube"
        )
    }

    private class AndroidPlayerConfigRepository(context: Context) : PlayerConfigRepository {
        private val preferences = context.getSharedPreferences("innertubex_player_config", Context.MODE_PRIVATE)

        override val enabled: Boolean = true
        override val sourceUrl: String = PLAYER_CONFIG_URL
        override val defaultSourceUrl: String = PLAYER_CONFIG_URL
        override var cachedJson: String
            get() = preferences.getString("json", "").orEmpty()
            set(value) = preferences.edit().putString("json", value).apply()
        override var cachedAtMs: Long
            get() = preferences.getLong("cached_at_ms", 0L)
            set(value) = preferences.edit().putLong("cached_at_ms", value).apply()
        override var cachedSourceUrl: String
            get() = preferences.getString("source_url", "").orEmpty()
            set(value) = preferences.edit().putString("source_url", value).apply()
        override var cachedEtag: String
            get() = preferences.getString("etag", "").orEmpty()
            set(value) = preferences.edit().putString("etag", value).apply()

        private companion object {
            const val PLAYER_CONFIG_URL =
                "https://raw.githubusercontent.com/ZemerTeam/zemer-cipher/master/library/src/main/assets/player_configs.json"
        }
    }
}
