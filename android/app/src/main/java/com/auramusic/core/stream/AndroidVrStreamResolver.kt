package com.auramusic.core.stream

import android.net.Uri
import com.auramusic.core.botguard.PoTokenManager
import com.auramusic.core.botguard.VisitorDataManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.Inet4Address
import java.net.InetAddress
import okhttp3.Dns

data class StreamResolutionResult(
    val url: String,
    val format: String,
    val codec: String,
    val bitrate: Int,
    val userAgent: String = "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
)

private data class ClientCandidate(
    val clientName: String,
    val clientVersion: String,
    val clientNameHeader: String,
    val userAgent: String,
    val osName: String = "Android",
    val osVersion: String = "14",
    val deviceModel: String? = null
)

class AndroidVrStreamResolver(
    private val visitorDataManager: VisitorDataManager,
    private val poTokenManager: PoTokenManager
) {
    private val client = OkHttpClient.Builder()
        .dns(object : Dns {
            override fun lookup(hostname: String): List<InetAddress> {
                val all = InetAddress.getAllByName(hostname)
                val ipv4 = all.filterIsInstance<Inet4Address>()
                return if (ipv4.isNotEmpty()) ipv4 else all.toList()
            }
        })
        .build()

    private val candidates = listOf(
        ClientCandidate(
            clientName = "ANDROID_MUSIC",
            clientVersion = "6.41.52",
            clientNameHeader = "21",
            userAgent = "com.google.android.apps.youtube.music/6.41.52 (Linux; U; Android 14; Pixel 7 Build/UQ1A.240105.004) gzip",
            osName = "Android",
            osVersion = "14"
        ),
        ClientCandidate(
            clientName = "ANDROID_TESTSUITE",
            clientVersion = "1.9",
            clientNameHeader = "85",
            userAgent = "com.google.android.youtube/1.9 (Linux; U; Android 14; Pixel 7 Build/UQ1A.240105.004) gzip"
        ),
        ClientCandidate(
            clientName = "WEB_REMIX",
            clientVersion = "1.20240401.01.00",
            clientNameHeader = "67",
            userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            osName = "Windows",
            osVersion = "10.0"
        ),
        ClientCandidate(
            clientName = "IOS",
            clientVersion = "19.29.1",
            clientNameHeader = "5",
            userAgent = "com.google.ios.youtube/19.29.1 (iPhone14,3; U; CPU iOS 17_5_1 like Mac OS X; en_US)",
            osName = "iOS",
            osVersion = "17.5.1.21F90",
            deviceModel = "iPhone14,3"
        ),
        ClientCandidate(
            clientName = "ANDROID_CREATOR",
            clientVersion = "23.47.100",
            clientNameHeader = "62",
            userAgent = "com.google.android.apps.youtube.creator/23.47.100 (Linux; U; Android 14; Pixel 7 Build/UQ1A.240105.004) gzip"
        ),
        ClientCandidate(
            clientName = "ANDROID_VR",
            clientVersion = "1.65.10",
            clientNameHeader = "28",
            userAgent = "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
            osName = "Android",
            osVersion = "12L"
        )
    )

    suspend fun resolve(videoId: String): StreamResolutionResult = withContext(Dispatchers.IO) {
        android.util.Log.i("NativeCore", "[PlaybackTrace] playTrack videoId=$videoId")
        
        val visitorData = visitorDataManager.getVisitorData() ?: ""
        val poToken = try {
            if (visitorData.isNotEmpty()) {
                poTokenManager.getToken(visitorData).token
            } else {
                poTokenManager.getToken(videoId).token
            }
        } catch (e: Exception) {
            android.util.Log.w("NativeCore", "[PlaybackTrace] PoToken generation error: ${e.message}")
            null
        }

        for (candidate in candidates) {
            try {
                android.util.Log.i("NativeCore", "[PlaybackTrace] Trying client candidate: ${candidate.clientName}")
                val json = JSONObject()
                json.put("videoId", videoId)

                val clientJson = JSONObject()
                clientJson.put("clientName", candidate.clientName)
                clientJson.put("clientVersion", candidate.clientVersion)
                clientJson.put("hl", "en")
                clientJson.put("gl", "US")
                clientJson.put("osName", candidate.osName)
                clientJson.put("osVersion", candidate.osVersion)
                if (candidate.deviceModel != null) {
                    clientJson.put("deviceModel", candidate.deviceModel)
                }
                if (visitorData.isNotEmpty()) {
                    clientJson.put("visitorData", visitorData)
                }

                val contextJson = JSONObject()
                contextJson.put("client", clientJson)
                if (!poToken.isNullOrEmpty()) {
                    val serviceIntegrity = JSONObject()
                    serviceIntegrity.put("poToken", poToken)
                    contextJson.put("serviceIntegrityDimensions", serviceIntegrity)
                }
                json.put("context", contextJson)

                val contentPlayback = JSONObject()
                contentPlayback.put("html5Preference", "HTML5_PREF_WANTS")
                contentPlayback.put("signatureTimestamp", 19800)
                val playbackContext = JSONObject()
                playbackContext.put("contentPlaybackContext", contentPlayback)
                json.put("playbackContext", playbackContext)

                json.put("contentCheckOk", true)
                json.put("racyCheckOk", true)

                val endpoint = if (candidate.clientName == "WEB_REMIX" || candidate.clientName == "ANDROID_MUSIC") {
                    "https://music.youtube.com/youtubei/v1/player?prettyPrint=false"
                } else {
                    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"
                }

                val origin = if (candidate.clientName == "WEB_REMIX" || candidate.clientName == "ANDROID_MUSIC") {
                    "https://music.youtube.com"
                } else {
                    "https://www.youtube.com"
                }

                val requestBuilder = Request.Builder()
                    .url(endpoint)
                    .post(json.toString().toRequestBody("application/json".toMediaType()))
                    .header("User-Agent", candidate.userAgent)
                    .header("X-Youtube-Client-Name", candidate.clientNameHeader)
                    .header("X-Youtube-Client-Version", candidate.clientVersion)
                    .header("Origin", origin)
                    .header("Referer", "$origin/")

                if (visitorData.isNotEmpty()) {
                    requestBuilder.header("X-Goog-Visitor-Id", visitorData)
                }

                val request = requestBuilder.build()
                val response = client.newCall(request).execute()
                val code = response.code
                val body = response.body?.string() ?: ""

                if (!response.isSuccessful || body.isEmpty()) {
                    android.util.Log.w("NativeCore", "[PlaybackTrace][Candidate] ${candidate.clientName} HTTP $code")
                    continue
                }

                val root = JSONObject(body)
                val playabilityStatus = root.optJSONObject("playabilityStatus")
                val status = playabilityStatus?.optString("status")
                if (status != "OK") {
                    android.util.Log.w("NativeCore", "[PlaybackTrace][Candidate] ${candidate.clientName} status not OK: $status")
                    continue
                }

                val streamingData = root.optJSONObject("streamingData") ?: continue
                val adaptiveFormats = streamingData.optJSONArray("adaptiveFormats") ?: continue

                var bestFormat: JSONObject? = null
                var maxBitrate = -1
                for (i in 0 until adaptiveFormats.length()) {
                    val format = adaptiveFormats.getJSONObject(i)
                    val mimeType = format.optString("mimeType", "")
                    if (mimeType.startsWith("audio/")) {
                        val bitrate = format.optInt("averageBitrate", format.optInt("bitrate", 0))
                        val url = format.optString("url", "")
                        if (url.isNotEmpty() && bitrate > maxBitrate) {
                            maxBitrate = bitrate
                            bestFormat = format
                        }
                    }
                }

                if (bestFormat != null) {
                    val url = bestFormat.optString("url", "")
                    if (url.isNotEmpty()) {
                        // Quick probe: Test Range 1MB-2MB on CDN
                        var isChunkable = false
                        try {
                            val probe = client.newCall(
                                Request.Builder()
                                    .url(url)
                                    .header("User-Agent", candidate.userAgent)
                                    .header("Origin", origin)
                                    .header("Referer", "$origin/")
                                    .header("Range", "bytes=1048576-1572863")
                                    .build()
                            ).execute()
                            val probeCode = probe.code
                            probe.close()
                            android.util.Log.i("NativeCore", "[PlaybackTrace][Probe] ${candidate.clientName} Range 1MB probe code=$probeCode")
                            if (probeCode in 200..299) {
                                isChunkable = true
                            }
                        } catch (pe: Exception) {
                            android.util.Log.w("NativeCore", "[PlaybackTrace][Probe] ${candidate.clientName} probe failed: ${pe.message}")
                        }

                        // If probe succeeded or if fallback to ANDROID_VR
                        if (isChunkable || candidate.clientName == "ANDROID_VR") {
                            android.util.Log.i("NativeCore", "[PlaybackTrace] Selected client ${candidate.clientName} (chunkable=$isChunkable)")
                            return@withContext StreamResolutionResult(
                                url = url,
                                format = bestFormat.optString("mimeType", "audio/mp4"),
                                codec = bestFormat.optString("mimeType", "").substringAfter("codecs=\"").substringBefore("\""),
                                bitrate = maxBitrate,
                                userAgent = candidate.userAgent
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.w("NativeCore", "[PlaybackTrace] Candidate ${candidate.clientName} failed: ${e.message}")
            }
        }

        throw Exception("Failed to resolve playable stream across all client candidates.")
    }
}
