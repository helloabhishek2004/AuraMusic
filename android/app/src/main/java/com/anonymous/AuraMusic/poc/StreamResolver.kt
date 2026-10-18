package com.anonymous.AuraMusic.poc

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

data class ResolvedStream(
    val url: String?,
    val mimeType: String,
    val bitrate: Int,
    val requiresCipher: Boolean,
    val requiresPoToken: Boolean,
    val signatureCipher: String? = null
)

sealed class StreamFailure(message: String) : Exception(message) {
    class NetworkFailure(msg: String) : StreamFailure(msg)
    class ClientRejected(msg: String) : StreamFailure(msg)
    class NoAudioFormat(msg: String) : StreamFailure(msg)
    class UnknownFailure(msg: String) : StreamFailure(msg)
}

class StreamResolver {
    private val client = OkHttpClient()

    suspend fun resolve(videoId: String, visitorData: String? = null, strategy: ClientStrategy = ClientStrategy.ANDROID_VR, poToken: String? = null, signatureTimestamp: Int? = null): ResolvedStream {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("videoId", videoId)
            
            val clientJson = JSONObject()
            clientJson.put("clientName", strategy.clientName)
            clientJson.put("clientVersion", strategy.clientVersion)
            clientJson.put("hl", "en")
            clientJson.put("gl", "US")
            clientJson.put("osName", "Android")
            clientJson.put("deviceMake", "Oculus")
            clientJson.put("deviceModel", "Quest 3")
            clientJson.put("androidSdkVersion", 32)
            clientJson.put("userAgent", "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip")
            clientJson.put("osVersion", "12L")
            clientJson.put("timeZone", "UTC")
            clientJson.put("utcOffsetMinutes", 0)
            
            if (visitorData != null) { 
                clientJson.put("visitorData", visitorData) 
            }
            
            val contextJson = JSONObject()
            contextJson.put("client", clientJson)
            json.put("context", contextJson)
            
            val contentPlaybackContext = JSONObject()
            contentPlaybackContext.put("html5Preference", "HTML5_PREF_WANTS")
            if (signatureTimestamp != null) { 
                contentPlaybackContext.put("signatureTimestamp", signatureTimestamp)
            }
            json.put("playbackContext", JSONObject().put("contentPlaybackContext", contentPlaybackContext))
            
            json.put("contentCheckOk", true)
            json.put("racyCheckOk", true)
            
            if (poToken != null) {
                val serviceIntegrityDimensions = JSONObject()
                serviceIntegrityDimensions.put("poToken", poToken)
                json.put("serviceIntegrityDimensions", serviceIntegrityDimensions)
            }

            val requestBuilder = Request.Builder()
                .url("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip")
                .header("X-Youtube-Client-Name", strategy.clientId.toString())
                .header("X-Youtube-Client-Version", strategy.clientVersion)
                .header("Origin", "https://www.youtube.com")
            
            if (visitorData != null) {
                requestBuilder.header("X-Goog-Visitor-Id", visitorData)
                // Let's also set cookie just in case
                // requestBuilder.header("Cookie", "VISITOR_INFO1_LIVE=$visitorData")
            }

            val request = requestBuilder.build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(StreamFailure.NetworkFailure(e.message ?: "Unknown network error"))
                }

                override fun onResponse(call: Call, response: Response) {
                    val bodyStr = response.body?.string() ?: ""
                    try {
                        val respJson = JSONObject(bodyStr)
                        val playability = respJson.optJSONObject("playabilityStatus")
                        val status = playability?.optString("status") ?: "UNKNOWN"
                        
                        if (status != "OK") {
                            val reason = playability?.optString("reason") ?: ""
                            continuation.resumeWithException(StreamFailure.ClientRejected("Status not OK: $status $reason"))
                            return
                        }

                        val streamingData = respJson.optJSONObject("streamingData")
                        if (streamingData == null) {
                            continuation.resumeWithException(StreamFailure.ClientRejected("No streamingData present"))
                            return
                        }

                        val adaptiveFormats = streamingData.optJSONArray("adaptiveFormats")
                        if (adaptiveFormats == null || adaptiveFormats.length() == 0) {
                            continuation.resumeWithException(StreamFailure.NoAudioFormat("No adaptive formats available"))
                            return
                        }

                        var bestAudio: JSONObject? = null
                        var bestBitrate = 0

                        for (i in 0 until adaptiveFormats.length()) {
                            val format = adaptiveFormats.getJSONObject(i)
                            val mimeType = format.optString("mimeType", "")
                            if (mimeType.startsWith("audio/mp4")) {
                                val bitrate = format.optInt("bitrate", 0)
                                if (bitrate > bestBitrate) {
                                    bestBitrate = bitrate
                                    bestAudio = format
                                }
                            }
                        }

                        if (bestAudio == null) {
                            continuation.resumeWithException(StreamFailure.NoAudioFormat("No suitable audio format found"))
                            return
                        }

                        val url = bestAudio.optString("url", null)
                        val signatureCipher = bestAudio.optString("signatureCipher", null)
                        
                        val resolved = ResolvedStream(
                            url = url,
                            mimeType = bestAudio.optString("mimeType", ""),
                            bitrate = bestBitrate,
                            requiresCipher = signatureCipher != null,
                            requiresPoToken = false,
                            signatureCipher = signatureCipher
                        )
                        continuation.resume(resolved)
                    } catch (e: Exception) {
                        continuation.resumeWithException(StreamFailure.UnknownFailure(e.message ?: "JSON parse error"))
                    }
                }
            })
        }
    }
}
