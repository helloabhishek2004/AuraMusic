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
        // 1. Ensure VisitorData is available
        val visitorData = visitorDataManager.getVisitorData() ?: throw Exception("VisitorData is required but could not be obtained.")
        
        // 2. Prewarm PoToken
        poTokenManager.prewarm()
        val poTokenResult = poTokenManager.getToken(videoId)

        // 3. Resolve using ANDROID_VR
        return@withContext suspendCancellableCoroutine { continuation ->
            try {
                val json = JSONObject()
                json.put("videoId", videoId)

                // Client Config
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

                // The Golden Payload (Bypasses Age Restriction / Cipher)
                val contentPlaybackContext = JSONObject()
                contentPlaybackContext.put("html5Preference", "HTML5_PREF_WANTS")
                contentPlaybackContext.put("signatureTimestamp", 20684) // TODO: Dynamic fetching
                
                json.put("playbackContext", JSONObject().put("contentPlaybackContext", contentPlaybackContext))
                json.put("contentCheckOk", true)
                json.put("racyCheckOk", true)

                // PoToken
                val serviceIntegrityDimensions = JSONObject()
                serviceIntegrityDimensions.put("poToken", poTokenResult.token)
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
                val body = response.body?.string() ?: throw Exception("Empty body")

                val root = JSONObject(body)

                // Check for errors
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

                // Pick the best audio format (highest audio bitrate)
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
                    val url = bestFormat.optString("url", "")
                    if (url.isEmpty()) {
                        val cipher = bestFormat.optString("signatureCipher", "")
                        if (cipher.isNotEmpty()) {
                            throw Exception("Cipher is required but ANDROID_VR cipher bypass failed.")
                        } else {
                            throw Exception("No URL or cipher provided.")
                        }
                    }
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
