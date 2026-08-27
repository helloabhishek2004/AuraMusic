package com.auramusic.core.youtube

import android.content.Context
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class AuraYouTubeEngine(private val context: Context) {
    private val client = OkHttpClient.Builder().build()
    
    private fun getBaseContext(): JSONObject {
        val c = JSONObject()
        val clientInfo = JSONObject()
        clientInfo.put("clientName", "WEB_REMIX")
        clientInfo.put("clientVersion", "1.20250101.01.00")
        c.put("client", clientInfo)
        return c
    }

    suspend fun search(query: String): org.json.JSONArray {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)
                        val tracksArray = org.json.JSONArray()
                        
                        val contents = root.optJSONObject("contents")?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val section = contents.optJSONObject(i)
                                val shelf = section?.optJSONObject("musicShelfRenderer")
                                if (shelf != null) {
                                    val items = shelf.optJSONArray("contents")
                                    if (items != null) {
                                        for (j in 0 until items.length()) {
                                            val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                            if (item != null) {
                                                val track = parseMusicResponsiveListItemRenderer(item)
                                                if (track != null) {
                                                    val tJson = JSONObject()
                                                    tJson.put("id", track.id)
                                                    tJson.put("title", track.title)
                                                    tJson.put("artist", track.artist)
                                                    tJson.put("album", track.album)
                                                    tJson.put("duration", track.duration)
                                                    tJson.put("artworkUrl", track.artworkUrl)
                                                    tracksArray.put(tJson)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        continuation.resume(tracksArray)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    suspend fun searchArtists(query: String): org.json.JSONArray {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)
            json.put("params", "EgWKAQIgAWoMEAMQBBAJEA4QChAF")

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)
                        val artistsArray = org.json.JSONArray()
                        
                        val contents = root.optJSONObject("contents")?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val section = contents.optJSONObject(i)
                                val shelf = section?.optJSONObject("musicShelfRenderer")
                                if (shelf != null) {
                                    val items = shelf.optJSONArray("contents")
                                    if (items != null) {
                                        for (j in 0 until items.length()) {
                                            val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                            if (item != null) {
                                                val columns = item.optJSONArray("flexColumns")
                                                if (columns != null && columns.length() > 0) {
                                                    val titleRun = columns.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)
                                                    val title = titleRun?.optString("text")
                                                    val browseId = item.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                                                    
                                                    val thumbs = item.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                                    val art = if (thumbs != null && thumbs.length() > 0) thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") else ""

                                                    if (title != null && browseId != null) {
                                                        val aJson = JSONObject()
                                                        aJson.put("id", browseId)
                                                        aJson.put("title", title)
                                                        aJson.put("art", art)
                                                        artistsArray.put(aJson)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        continuation.resume(artistsArray)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    suspend fun searchAlbums(query: String): org.json.JSONArray {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)
            json.put("params", "EgWKAQIYAWoMEAMQBBAJEA4QChAF")

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)
                        val albumsArray = org.json.JSONArray()
                        
                        val contents = root.optJSONObject("contents")?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val section = contents.optJSONObject(i)
                                val shelf = section?.optJSONObject("musicShelfRenderer")
                                if (shelf != null) {
                                    val items = shelf.optJSONArray("contents")
                                    if (items != null) {
                                        for (j in 0 until items.length()) {
                                            val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                            if (item != null) {
                                                val columns = item.optJSONArray("flexColumns")
                                                if (columns != null && columns.length() > 0) {
                                                    val titleRun = columns.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)
                                                    val title = titleRun?.optString("text")
                                                    val browseId = item.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                                                    
                                                    val thumbs = item.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                                    val art = if (thumbs != null && thumbs.length() > 0) thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") else ""

                                                    if (title != null && browseId != null) {
                                                        val aJson = JSONObject()
                                                        aJson.put("id", browseId)
                                                        aJson.put("title", title)
                                                        aJson.put("art", art)
                                                        albumsArray.put(aJson)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        continuation.resume(albumsArray)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    suspend fun getArtistDetails(browseId: String): JSONObject {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("browseId", browseId)

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)
                        val header = root.optJSONObject("header")?.optJSONObject("musicImmersiveHeaderRenderer") ?: root.optJSONObject("header")?.optJSONObject("musicVisualHeaderRenderer")
                        val title = header?.optJSONObject("title")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text") ?: "Unknown Artist"
                        val thumbnails = header?.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails") 
                            ?: header?.optJSONObject("foregroundThumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                        val artwork = if (thumbnails != null && thumbnails.length() > 0) {
                            thumbnails.optJSONObject(thumbnails.length() - 1)?.optString("url") ?: ""
                        } else ""

                        val result = JSONObject()
                        result.put("id", browseId)
                        result.put("name", title)
                        result.put("art", artwork)
                        result.put("description", "")
                        
                        val songsArray = org.json.JSONArray()
                        val albumsArray = org.json.JSONArray()

                        val tabs = root.optJSONObject("contents")?.optJSONObject("singleColumnBrowseResultsRenderer")?.optJSONArray("tabs")
                        val sections = tabs?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        
                        if (sections != null) {
                            for (i in 0 until sections.length()) {
                                val s = sections.optJSONObject(i) ?: continue
                                val shelf = s.optJSONObject("musicShelfRenderer") ?: s.optJSONObject("musicCarouselShelfRenderer") ?: continue
                                val items = shelf.optJSONArray("contents") ?: continue
                                
                                for (j in 0 until items.length()) {
                                    val item = items.optJSONObject(j) ?: continue
                                    val twoRow = item.optJSONObject("musicTwoRowItemRenderer")
                                    if (twoRow != null) {
                                        val albumTitle = twoRow.optJSONObject("title")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text")
                                        val albumId = twoRow.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                                        val albumThumbs = twoRow.optJSONObject("thumbnailRenderer")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                        val albumArt = if (albumThumbs != null && albumThumbs.length() > 0) {
                                            albumThumbs.optJSONObject(albumThumbs.length() - 1)?.optString("url") ?: ""
                                        } else ""
                                        
                                        if (albumTitle != null && albumId != null) {
                                            val alb = JSONObject()
                                            alb.put("id", albumId)
                                            alb.put("title", albumTitle)
                                            alb.put("art", albumArt)
                                            albumsArray.put(alb)
                                        }
                                    }
                                    
                                    val rowItem = item.optJSONObject("musicResponsiveListItemRenderer")
                                    if (rowItem != null) {
                                        val track = parseMusicResponsiveListItemRenderer(rowItem)
                                        if (track != null) {
                                            val tJson = JSONObject()
                                            tJson.put("id", track.id)
                                            tJson.put("title", track.title)
                                            tJson.put("artist", track.artist)
                                            tJson.put("album", track.album)
                                            tJson.put("duration", track.duration)
                                            tJson.put("artworkUrl", track.artworkUrl)
                                            songsArray.put(tJson)
                                        }
                                    }
                                }
                            }
                        }

                        result.put("songs", songsArray)
                        result.put("albums", albumsArray)
                        
                        continuation.resume(result)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    suspend fun getAlbumDetails(browseId: String): JSONObject {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("browseId", browseId)

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)
                        
                        var title = "Unknown Album"
                        var artist = "Unknown Artist"
                        var artwork = ""
                        var year = ""
                        
                        val twoCol = root.optJSONObject("contents")?.optJSONObject("twoColumnBrowseResultsRenderer")
                        if (twoCol != null) {
                            val tabs = twoCol.optJSONArray("tabs")
                            val headerSection = tabs?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")?.optJSONObject(0)?.optJSONObject("musicResponsiveHeaderRenderer")
                            
                            if (headerSection != null) {
                                title = headerSection.optJSONObject("title")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text") ?: title
                                artist = headerSection.optJSONObject("straplineTextOne")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text") ?: artist
                                val thumbs = headerSection.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                artwork = if (thumbs != null && thumbs.length() > 0) {
                                    thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") ?: ""
                                } else ""
                                
                                val subtitleRuns = headerSection.optJSONObject("subtitle")?.optJSONArray("runs")
                                if (subtitleRuns != null && subtitleRuns.length() > 2) {
                                    year = subtitleRuns.optJSONObject(2)?.optString("text") ?: ""
                                } else if (subtitleRuns != null && subtitleRuns.length() > 0) {
                                    year = subtitleRuns.optJSONObject(0)?.optString("text") ?: ""
                                }
                            }
                        }

                        val result = JSONObject()
                        result.put("id", browseId)
                        result.put("title", title)
                        result.put("artist", artist)
                        result.put("thumbnail", artwork)
                        result.put("year", year)
                        
                        val tracksArray = org.json.JSONArray()

                        val contents = root.optJSONObject("contents")?.optJSONObject("twoColumnBrowseResultsRenderer")?.optJSONObject("secondaryContents")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")?.optJSONObject(0)?.optJSONObject("musicShelfRenderer")?.optJSONArray("contents")
                            ?: root.optJSONObject("contents")?.optJSONObject("singleColumnBrowseResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")?.optJSONObject(0)?.optJSONObject("musicShelfRenderer")?.optJSONArray("contents")
                        
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val item = contents.optJSONObject(i)?.optJSONObject("musicResponsiveListItemRenderer")
                                if (item != null) {
                                    val track = parseMusicResponsiveListItemRenderer(item)
                                    if (track != null) {
                                        val tJson = JSONObject()
                                        tJson.put("id", track.id)
                                        tJson.put("title", track.title)
                                        tJson.put("artist", track.artist)
                                        tJson.put("album", track.album)
                                        tJson.put("duration", track.duration)
                                        tJson.put("artworkUrl", track.artworkUrl)
                                        tracksArray.put(tJson)
                                    }
                                }
                            }
                        }

                        result.put("tracks", tracksArray)
                        continuation.resume(result)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    private fun parseMusicResponsiveListItemRenderer(root: JSONObject): AuraTrackInfo? {
        val columns = root.optJSONArray("flexColumns") ?: return null
        if (columns.length() < 2) return null

        val titleRun = columns.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)
        val title = titleRun?.optString("text") ?: return null

        val videoId = root.optJSONObject("playlistItemData")?.optString("videoId") 
            ?: titleRun.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")
            ?: return null

        val artistRun = columns.optJSONObject(1)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")
        var artist = "Unknown Artist"
        var album = "Unknown Album"
        
        if (artistRun != null) {
            val parts = mutableListOf<String>()
            for (i in 0 until artistRun.length()) {
                val t = artistRun.optJSONObject(i)?.optString("text")
                if (t != null && t != " • ") parts.add(t)
            }
            if (parts.isNotEmpty()) artist = parts[0]
            if (parts.size > 1) album = parts[1]
        }

        val thumbs = root.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
        val artwork = if (thumbs != null && thumbs.length() > 0) thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") else null

        return AuraTrackInfo(videoId, title, artist, album, 0, artwork)
    }
}

data class AuraTrackInfo(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val duration: Int,
    val artworkUrl: String?
)
