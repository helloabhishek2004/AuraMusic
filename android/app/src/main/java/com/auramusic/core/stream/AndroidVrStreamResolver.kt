package com.auramusic.core.stream

import com.auramusic.core.botguard.PoTokenManager
import com.auramusic.core.botguard.VisitorDataManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class StreamResolutionResult(
    val url: String,
    val format: String,
    val codec: String,
    val bitrate: Int
)

class AndroidVrStreamResolver(
    private val visitorDataManager: VisitorDataManager,
    private val poTokenManager: PoTokenManager
) {
    private val client = OkHttpClient()

    suspend fun resolve(videoId: String): StreamResolutionResult = withContext(Dispatchers.IO) {
        android.util.Log.i("NativeCore", "[PlaybackTrace] playTrack videoId=$videoId")
        
        val visitorData = visitorDataManager.getVisitorData() ?: throw Exception("VisitorData is required but could not be obtained.")
        
        poTokenManager.prewarm()
        
        // Player Request PoToken (session-bound)
        val playerPoTokenResult = poTokenManager.getToken(visitorData)
        // Streaming Data PoToken (video-bound)
        val streamingPoTokenResult = poTokenManager.getToken(videoId)

        return@withContext suspendCancellableCoroutine { continuation ->
            try {
                val json = JSONObject()
                json.put("videoId", videoId)

                val clientJson = JSONObject()
                clientJson.put("clientName", "ANDROID_VR")
                clientJson.put("clientVersion", "1.65.10")
                clientJson.put("hl", "en")
                clientJson.put("gl", "US")
                clientJson.put("osName", "Android")
                clientJson.put("osVersion", "12L")
                if (visitorData.isNotEmpty()) {
                    clientJson.put("visitorData", visitorData)
                }

                val contextJson = JSONObject()
                contextJson.put("client", clientJson)
                json.put("context", contextJson)

                val contentPlaybackContext = JSONObject()
                contentPlaybackContext.put("html5Preference", "HTML5_PREF_WANTS")
                contentPlaybackContext.put("signatureTimestamp", 20684)
                
                json.put("playbackContext", JSONObject().put("contentPlaybackContext", contentPlaybackContext))
                json.put("contentCheckOk", true)
                json.put("racyCheckOk", true)

                val serviceIntegrityDimensions = JSONObject()
                serviceIntegrityDimensions.put("poToken", playerPoTokenResult.token)
                json.put("serviceIntegrityDimensions", serviceIntegrityDimensions)

                val requestBuilder = Request.Builder()
                    .url("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
                    .post(json.toString().toRequestBody("application/json".toMediaType()))
                    .header("User-Agent", "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip")
                    .header("X-Youtube-Client-Name", "112")
                    .header("X-Youtube-Client-Version", "1.65.10")
                    .header("Origin", "https://www.youtube.com")
                    .header("X-Goog-Visitor-Id", visitorData)

                val request = requestBuilder.build()
                val response = client.newCall(request).execute()
                val code = response.code
                val body = response.body?.string() ?: throw Exception("Empty body")

                val root = JSONObject(body)

                val poLen = playerPoTokenResult.token.length
                val visLen = visitorData.length
                android.util.Log.i("NativeCore", "[PlaybackTrace][YouTubePlayer] HTTP $code | videoId=$videoId | client=ANDROID_VR | visitorDataPresent=${visLen > 0} | visitorDataLength=$visLen | poTokenPresent=${poLen > 0} | poTokenLength=$poLen")
                if (!response.isSuccessful) {
                    android.util.Log.e("NativeCore", "[PlaybackTrace][YouTubePlayer] ERROR BODY: $body")
                    throw Exception("YouTube /player HTTP $code: $body")
                }

                val playabilityStatus = root.optJSONObject("playabilityStatus")
                val status = playabilityStatus?.optString("status")
                if (status != "OK") {
                    throw Exception("Playability status is not OK: $status. Reason: ${playabilityStatus?.optString("reason")}")
                }

                val streamingData = root.optJSONObject("streamingData")
                if (streamingData == null) {
                    throw Exception("No streaming data in response.")
                }

                val adaptiveFormats = streamingData.optJSONArray("adaptiveFormats")
                if (adaptiveFormats == null || adaptiveFormats.length() == 0) {
                    throw Exception("No adaptive formats available.")
                }

                var bestFormat: JSONObject? = null
                var maxBitrate = -1
                for (i in 0 until adaptiveFormats.length()) {
                    val format = adaptiveFormats.getJSONObject(i)
                    val mimeType = format.optString("mimeType", "")
                    if (mimeType.startsWith("audio/")) {
                        val bitrate = format.optInt("averageBitrate", format.optInt("bitrate", 0))
                        if (bitrate > maxBitrate) {
                            maxBitrate = bitrate
                            bestFormat = format
                        }
                    }
                }

                if (bestFormat != null) {
                    var url = bestFormat.optString("url", "")
                    if (url.isEmpty()) {
                        val cipher = bestFormat.optString("signatureCipher", "")
                        if (cipher.isNotEmpty()) {
                            throw Exception("Cipher is required but ANDROID_VR cipher bypass failed.")
                        } else {
                            throw Exception("No URL or cipher provided.")
                        }
                    }
                    
                    // Append streaming pot
                    if (!url.contains("pot=")) {
                        val cleanPot = streamingPoTokenResult.token.trim().replace("=", "")
                        url = if (url.contains("?")) "$url&pot=$cleanPot" else "$url?pot=$cleanPot"
                    }
                    android.util.Log.i("NativeCore", "[PlaybackTrace] resolved stream URL: ${url.take(80)}... (potLen=${streamingPoTokenResult.token.length})")
                    
                    continuation.resume(StreamResolutionResult(
                        url = url,
                        format = bestFormat.optString("mimeType", "audio/mp4"),
                        codec = bestFormat.optString("mimeType", "").substringAfter("codecs=\"").substringBefore("\""),
                        bitrate = maxBitrate
                    ))
                } else {
                    throw Exception("No audio streams found.")
                }

            } catch (e: Exception) {
                continuation.resumeWithException(e)
            }
        }
    }
}

