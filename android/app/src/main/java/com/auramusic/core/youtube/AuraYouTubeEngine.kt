package com.auramusic.core.youtube

import com.auramusic.core.youtube.models.Track
import com.auramusic.core.youtube.models.SearchResult
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class AuraYouTubeEngine {
    private val client = OkHttpClient()

    private fun getBaseContext(): JSONObject {
        val clientJson = JSONObject()
        clientJson.put("clientName", "WEB_REMIX")
        clientJson.put("clientVersion", "1.20231214.00.00")
        clientJson.put("hl", "en")
        clientJson.put("gl", "US")
        
        val contextJson = JSONObject()
        contextJson.put("client", clientJson)
        return contextJson
    }

    suspend fun search(query: String): SearchResult {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                .header("Origin", "https://music.youtube.com")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val parsed = parseSearchResponse(body)
                        continuation.resume(SearchResult(parsed))
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    private fun parseSearchResponse(json: String): List<Track> {
        val tracks = mutableListOf<Track>()
        try {
            val root = JSONObject(json)
            val contents = root.optJSONObject("contents")
                ?.optJSONObject("tabbedSearchResultsRenderer")
                ?.optJSONArray("tabs")?.optJSONObject(0)
                ?.optJSONObject("tabRenderer")
                ?.optJSONObject("content")
                ?.optJSONObject("sectionListRenderer")
                ?.optJSONArray("contents")

            if (contents == null) return tracks

            for (i in 0 until contents.length()) {
                val section = contents.optJSONObject(i)?.optJSONObject("musicShelfRenderer")
                if (section != null) {
                    val items = section.optJSONArray("contents")
                    if (items != null) {
                        for (j in 0 until items.length()) {
                            val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                            if (item != null) {
                                val track = parseMusicResponsiveListItemRenderer(item)
                                if (track != null) {
                                    tracks.add(track)
                                }
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return tracks
    }

    private fun parseMusicResponsiveListItemRenderer(item: JSONObject): Track? {
        try {
            val columns = item.optJSONArray("flexColumns") ?: return null
            
            // First column: Title
            val titleCol = columns.optJSONObject(0)
                ?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")
                ?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)
            val title = titleCol?.optString("text") ?: return null
            val videoId = item.optJSONObject("playlistItemData")?.optString("videoId") 
                ?: titleCol?.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")
                ?: return null

            // Second column: Artist, Album, Duration
            val detailsRuns = columns.optJSONObject(1)
                ?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")
                ?.optJSONObject("text")?.optJSONArray("runs")
            
            var artist = "Unknown"
            var album: String? = null
            var duration = 0
            
            if (detailsRuns != null) {
                // Parse runs (usually Artist • Album • Duration)
                for (i in 0 until detailsRuns.length()) {
                    val text = detailsRuns.optJSONObject(i)?.optString("text")?.trim() ?: continue
                    if (text == "•") continue
                    if (i == 0) artist = text
                    else if (i == 2) album = text
                    else if (i == 4 || i == 2) {
                        // could be duration
                        if (text.contains(":")) {
                            val parts = text.split(":")
                            if (parts.size == 2) {
                                duration = parts[0].toIntOrNull()?.times(60)?.plus(parts[1].toIntOrNull() ?: 0) ?: 0
                            }
                        }
                    }
                }
            }

            // Artwork
            val thumbnails = item.optJSONObject("thumbnail")
                ?.optJSONObject("musicThumbnailRenderer")
                ?.optJSONObject("thumbnail")
                ?.optJSONArray("thumbnails")
            
            var artworkUrl: String? = null
            if (thumbnails != null && thumbnails.length() > 0) {
                artworkUrl = thumbnails.optJSONObject(thumbnails.length() - 1)?.optString("url")
            }

            return Track(
                id = videoId,
                title = title,
                artist = artist,
                album = album,
                duration = duration,
                artworkUrl = artworkUrl
            )
        } catch(e: Exception) {
            return null
        }
    }
}
