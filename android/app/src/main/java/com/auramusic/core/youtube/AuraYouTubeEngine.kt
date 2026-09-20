package com.auramusic.core.youtube

import android.content.Context
import android.util.Log
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class AuraYouTubeEngine(private val context: Context) {
    private val client = OkHttpClient.Builder().build()
    private val TAG = "AuraYouTubeEngine"

    private fun getBaseContext(): JSONObject {
        val c = JSONObject()
        val clientInfo = JSONObject()
        clientInfo.put("clientName", "WEB_REMIX")
        clientInfo.put("clientVersion", "1.20250101.01.00")
        c.put("client", clientInfo)
        return c
    }

    private fun extractThumbnail(renderer: JSONObject): String {
        val thumbs = renderer.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
            ?: renderer.optJSONObject("thumbnailRenderer")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
            ?: renderer.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
            ?: renderer.optJSONArray("thumbnails")
        
        if (thumbs != null && thumbs.length() > 0) {
            val last = thumbs.optJSONObject(thumbs.length() - 1)
            var url = last?.optString("url") ?: ""
            if (url.startsWith("//")) {
                url = "https:$url"
            }
            if (url.isNotEmpty()) return url
        }
        return ""
    }

    private fun parseDurationSeconds(durationStr: String): Int {
        if (durationStr.isEmpty()) return 0
        val parts = durationStr.split(":")
        try {
            if (parts.size == 2) {
                return parts[0].trim().toInt() * 60 + parts[1].trim().toInt()
            } else if (parts.size == 3) {
                return parts[0].trim().toInt() * 3600 + parts[1].trim().toInt() * 60 + parts[2].trim().toInt()
            }
        } catch (e: Exception) {
            // Ignore
        }
        return 0
    }

    /**
     * Unified Search: Parses hero musicCardShelfRenderer (Top Result), songs, artists, albums, playlists, and videos.
     */
    suspend fun searchUnified(query: String): JSONObject {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)

                        val responseJson = JSONObject()
                        responseJson.put("query", query)
                        val songsArray = JSONArray()
                        val artistsArray = JSONArray()
                        val albumsArray = JSONArray()
                        val playlistsArray = JSONArray()
                        val videosArray = JSONArray()

                        val tabs = root.optJSONObject("contents")?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")
                        val sectionContents = tabs?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")

                        if (sectionContents != null) {
                            for (i in 0 until sectionContents.length()) {
                                val sec = sectionContents.optJSONObject(i) ?: continue

                                // 1. Top Result Hero Card (musicCardShelfRenderer)
                                if (sec.has("musicCardShelfRenderer")) {
                                    val card = sec.optJSONObject("musicCardShelfRenderer")
                                    if (card != null) {
                                        val titleRuns = card.optJSONObject("title")?.optJSONArray("runs")
                                        val title = titleRuns?.optJSONObject(0)?.optString("text") ?: ""

                                        val subRuns = card.optJSONObject("subtitle")?.optJSONArray("runs")
                                        var subtitle = ""
                                        val artistNames = mutableListOf<String>()
                                        var artistName = ""
                                        var artistId = ""
                                        var albumName = ""
                                        var albumId = ""
                                        val subParts = mutableListOf<String>()
                                        if (subRuns != null) {
                                            for (k in 0 until subRuns.length()) {
                                                val run = subRuns.optJSONObject(k) ?: continue
                                                val t = run.optString("text") ?: ""
                                                subtitle += t
                                                val trimmed = t.trim()
                                                if (trimmed.isNotEmpty() && trimmed != "•" && trimmed != "&" && trimmed != ",") {
                                                    subParts.add(trimmed)
                                                }

                                                val navEnd = run.optJSONObject("navigationEndpoint")
                                                val bId = navEnd?.optJSONObject("browseEndpoint")?.optString("browseId") ?: ""
                                                val pageType = navEnd?.optJSONObject("browseEndpoint")?.optJSONObject("browseEndpointContextSupportedConfigs")?.optJSONObject("browseEndpointContextMusicConfig")?.optString("pageType") ?: ""

                                                if (bId.startsWith("UC") || bId.startsWith("FEmusic_library_privately_owned_artist_detail") || pageType.contains("ARTIST")) {
                                                    if (!artistNames.contains(trimmed)) {
                                                        artistNames.add(trimmed)
                                                    }
                                                    if (artistId.isEmpty()) {
                                                        artistId = bId
                                                    }
                                                } else if (bId.startsWith("MPREb_") || bId.startsWith("FEmusic_library_privately_owned_release_detail") || pageType.contains("ALBUM")) {
                                                    if (albumName.isEmpty()) {
                                                        albumName = trimmed
                                                        albumId = bId
                                                    }
                                                }
                                            }
                                        }
                                        if (artistNames.isNotEmpty()) {
                                            artistName = artistNames.joinToString(", ")
                                        }

                                        val nav = titleRuns?.optJSONObject(0)?.optJSONObject("navigationEndpoint")
                                        var watchId = nav?.optJSONObject("watchEndpoint")?.optString("videoId") ?: ""
                                        val browseId = nav?.optJSONObject("browseEndpoint")?.optString("browseId") ?: ""

                                        var topMusicVideoType = nav?.optJSONObject("watchEndpoint")
                                            ?.optJSONObject("watchEndpointMusicSupportedConfigs")
                                            ?.optJSONObject("watchEndpointMusicConfig")
                                            ?.optString("musicVideoType", "") ?: ""

                                        if (watchId.isEmpty() || topMusicVideoType.isEmpty()) {
                                            val buttons = card.optJSONArray("buttons")
                                            if (buttons != null) {
                                                for (bIdx in 0 until buttons.length()) {
                                                    val btn = buttons.optJSONObject(bIdx)?.optJSONObject("buttonRenderer")
                                                    val bNav = btn?.optJSONObject("command") ?: btn?.optJSONObject("navigationEndpoint")
                                                    val wId = bNav?.optJSONObject("watchEndpoint")?.optString("videoId")
                                                    if (watchId.isEmpty() && !wId.isNullOrEmpty()) {
                                                        watchId = wId
                                                    }
                                                    if (topMusicVideoType.isEmpty()) {
                                                        val mvt = bNav?.optJSONObject("watchEndpoint")
                                                            ?.optJSONObject("watchEndpointMusicSupportedConfigs")
                                                            ?.optJSONObject("watchEndpointMusicConfig")
                                                            ?.optString("musicVideoType", "") ?: ""
                                                        if (mvt.isNotEmpty()) {
                                                            topMusicVideoType = mvt
                                                        }
                                                    }
                                                    if (watchId.isNotEmpty() && topMusicVideoType.isNotEmpty()) {
                                                        break
                                                    }
                                                }
                                            }
                                        }

                                        val art = extractThumbnail(card)
                                        val subLower = subtitle.lowercase()
                                        var cardType = "SONG"
                                        if (subLower.contains("artist") || browseId.startsWith("UC")) {
                                            cardType = "ARTIST"
                                            if (artistId.isEmpty()) artistId = browseId
                                        } else if (subLower.contains("album") || subLower.contains("ep") || subLower.contains("single") || browseId.startsWith("MPREb_")) {
                                            cardType = "ALBUM"
                                            if (albumId.isEmpty()) albumId = browseId
                                        } else if (subLower.contains("playlist") || browseId.startsWith("VL") || browseId.startsWith("PL")) {
                                            cardType = "PLAYLIST"
                                        } else if (subLower.contains("video")) {
                                            cardType = "VIDEO"
                                        } else if (watchId.isNotEmpty()) {
                                            cardType = "SONG"
                                        }

                                        if (artistName.isEmpty()) {
                                            if (cardType == "SONG" || cardType == "VIDEO") {
                                                if (subParts.size > 1) artistName = subParts[1]
                                                if (albumName.isEmpty() && subParts.size > 2) albumName = subParts[2]
                                            } else if (cardType == "ALBUM") {
                                                if (subParts.size > 1) artistName = subParts[1]
                                            } else if (cardType == "ARTIST") {
                                                artistName = title
                                            }
                                        }

                                        val isTopAtv = topMusicVideoType == "MUSIC_VIDEO_TYPE_ATV"
                                        val isTopOmv = topMusicVideoType == "MUSIC_VIDEO_TYPE_OMV" || topMusicVideoType == "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC_VIDEO"
                                        val isTopTopic = artistName.trim().endsWith("- Topic") || subtitle.contains("- Topic")
                                        val isTopOfficial = isTopAtv || isTopOmv || isTopTopic || (cardType == "ARTIST" || cardType == "ALBUM" || cardType == "PLAYLIST") || (cardType == "SONG" && topMusicVideoType.isNotEmpty() && topMusicVideoType != "MUSIC_VIDEO_TYPE_UGC" && topMusicVideoType != "MUSIC_VIDEO_TYPE_PODCAST_EPISODE")

                                        val topObj = JSONObject()
                                        topObj.put("id", if (watchId.isNotEmpty()) watchId else browseId)
                                        topObj.put("type", cardType)
                                        topObj.put("title", title)
                                        topObj.put("subtitle", subtitle)
                                        topObj.put("artistName", artistName)
                                        topObj.put("artistId", artistId)
                                        topObj.put("albumName", albumName)
                                        topObj.put("albumId", albumId)
                                        topObj.put("videoId", watchId)
                                        topObj.put("browseId", browseId)
                                        topObj.put("thumbnail", art)
                                        topObj.put("musicVideoType", topMusicVideoType)
                                        topObj.put("isOfficial", isTopOfficial)
                                        topObj.put("sourceRank", 0)

                                        responseJson.put("topResult", topObj)

                                        // Sub-items of card
                                        val cardContents = card.optJSONArray("contents")
                                        if (cardContents != null) {
                                            for (cIdx in 0 until cardContents.length()) {
                                                val rItem = cardContents.optJSONObject(cIdx)?.optJSONObject("musicResponsiveListItemRenderer")
                                                if (rItem != null) {
                                                    val parsed = parseResponsiveItem(rItem, songsArray.length())
                                                    if (parsed != null) songsArray.put(parsed)
                                                }
                                            }
                                        }
                                    }
                                }

                                // 2. Item Shelves
                                val isr = sec.optJSONObject("itemSectionRenderer") ?: sec.optJSONObject("musicShelfRenderer")
                                if (isr != null) {
                                    val cList = isr.optJSONArray("contents")
                                    if (cList != null) {
                                        for (j in 0 until cList.length()) {
                                            val cItem = cList.optJSONObject(j) ?: continue
                                            if (cItem.has("musicResponsiveListItemRenderer")) {
                                                val rItem = cItem.optJSONObject("musicResponsiveListItemRenderer")
                                                if (rItem != null) {
                                                    val currentTotal = songsArray.length() + artistsArray.length() + albumsArray.length() + playlistsArray.length()
                                                    val parsed = parseResponsiveItem(rItem, currentTotal)
                                                    if (parsed != null) {
                                                        when (parsed.optString("type")) {
                                                            "SONG" -> songsArray.put(parsed)
                                                            "ARTIST" -> artistsArray.put(parsed)
                                                            "ALBUM" -> albumsArray.put(parsed)
                                                            "PLAYLIST" -> playlistsArray.put(parsed)
                                                            "VIDEO" -> videosArray.put(parsed)
                                                            else -> songsArray.put(parsed)
                                                        }
                                                    }
                                                }
                                            } else if (cItem.has("musicTwoRowItemRenderer")) {
                                                val twoRow = cItem.optJSONObject("musicTwoRowItemRenderer")
                                                if (twoRow != null) {
                                                    val parsed = parseTwoRowItem(twoRow)
                                                    if (parsed != null) {
                                                        when (parsed.optString("type")) {
                                                            "ALBUM" -> albumsArray.put(parsed)
                                                            "PLAYLIST" -> playlistsArray.put(parsed)
                                                            "ARTIST" -> artistsArray.put(parsed)
                                                            else -> albumsArray.put(parsed)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        responseJson.put("songs", songsArray)
                        responseJson.put("artists", artistsArray)
                        responseJson.put("albums", albumsArray)
                        responseJson.put("playlists", playlistsArray)
                        responseJson.put("videos", videosArray)

                        continuation.resume(responseJson)
                    } catch (e: Exception) {
                        Log.e(TAG, "[SearchTrace] Exception parsing searchUnified: ${e.message}", e)
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    private fun parseResponsiveItem(root: JSONObject, rankIndex: Int): JSONObject? {
        val columns = root.optJSONArray("flexColumns") ?: return null
        if (columns.length() == 0) return null

        val col1Runs = columns.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")
        val title = col1Runs?.optJSONObject(0)?.optString("text") ?: return null

        val col2Runs = if (columns.length() > 1) {
            columns.optJSONObject(1)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")
        } else null

        var col2Text = ""
        val col2Parts = mutableListOf<String>()
        if (col2Runs != null) {
            for (i in 0 until col2Runs.length()) {
                val t = col2Runs.optJSONObject(i)?.optString("text") ?: ""
                col2Text += t
                val trimmed = t.trim()
                if (trimmed.isNotEmpty() && trimmed != "•") {
                    col2Parts.add(trimmed)
                }
            }
        }

        val nav = root.optJSONObject("navigationEndpoint") ?: col1Runs?.optJSONObject(0)?.optJSONObject("navigationEndpoint")
        var watchId = nav?.optJSONObject("watchEndpoint")?.optString("videoId") 
            ?: root.optJSONObject("playlistItemData")?.optString("videoId") ?: ""
        val browseId = nav?.optJSONObject("browseEndpoint")?.optString("browseId") ?: ""

        var musicVideoType = nav?.optJSONObject("watchEndpoint")
            ?.optJSONObject("watchEndpointMusicSupportedConfigs")
            ?.optJSONObject("watchEndpointMusicConfig")
            ?.optString("musicVideoType", "") ?: ""

        if (watchId.isEmpty() || musicVideoType.isEmpty()) {
            val overlay = root.optJSONObject("overlay")?.optJSONObject("musicItemThumbnailOverlayRenderer")?.optJSONObject("content")?.optJSONObject("musicPlayButtonRenderer")
            val playNav = overlay?.optJSONObject("playNavigationEndpoint")
            if (watchId.isEmpty()) {
                watchId = playNav?.optJSONObject("watchEndpoint")?.optString("videoId") ?: ""
            }
            if (musicVideoType.isEmpty()) {
                val overlayConfig = playNav?.optJSONObject("watchEndpoint")
                    ?.optJSONObject("watchEndpointMusicSupportedConfigs")
                    ?.optJSONObject("watchEndpointMusicConfig")
                if (overlayConfig != null) {
                    musicVideoType = overlayConfig.optString("musicVideoType", "")
                }
            }
        }

        val art = extractThumbnail(root)

        var itemType = "SONG"
        var artistName = ""
        var artistId = ""
        var albumName = ""
        var albumId = ""
        var durationStr = ""
        var subscribers = ""
        var trackCount = ""
        var year = ""
        var isExplicit = false

        val badges = root.optJSONArray("badges")
        if (badges != null) {
            for (bIdx in 0 until badges.length()) {
                val label = badges.optJSONObject(bIdx)?.optJSONObject("musicInlineBadgeRenderer")?.optJSONObject("accessibilityData")?.optJSONObject("accessibilityData")?.optString("label") ?: ""
                if (label.lowercase().contains("explicit")) {
                    isExplicit = true
                }
            }
        }

        val artistNames = mutableListOf<String>()

        // 1. Deep run inspection across all flexColumns for linked artist & album entities
        for (cIdx in 0 until columns.length()) {
            val col = columns.optJSONObject(cIdx)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer") ?: continue
            val runs = col.optJSONObject("text")?.optJSONArray("runs") ?: continue
            for (rIdx in 0 until runs.length()) {
                val run = runs.optJSONObject(rIdx) ?: continue
                val text = run.optString("text").trim()
                if (text.isEmpty() || text == "•" || text == "&" || text == ",") continue

                val navEnd = run.optJSONObject("navigationEndpoint")
                val bId = navEnd?.optJSONObject("browseEndpoint")?.optString("browseId") ?: ""
                val pageType = navEnd?.optJSONObject("browseEndpoint")?.optJSONObject("browseEndpointContextSupportedConfigs")?.optJSONObject("browseEndpointContextMusicConfig")?.optString("pageType") ?: ""

                if (bId.startsWith("UC") || bId.startsWith("FEmusic_library_privately_owned_artist_detail") || pageType.contains("ARTIST")) {
                    if (!artistNames.contains(text)) {
                        artistNames.add(text)
                    }
                    if (artistId.isEmpty()) {
                        artistId = bId
                    }
                } else if (bId.startsWith("MPREb_") || bId.startsWith("FEmusic_library_privately_owned_release_detail") || pageType.contains("ALBUM")) {
                    if (albumName.isEmpty()) {
                        albumName = text
                        albumId = bId
                    }
                }
            }
        }
        if (artistNames.isNotEmpty()) {
            artistName = artistNames.joinToString(", ")
        }

        // 2. Inspect fixedColumns for duration (e.g. table view)
        val fixedCols = root.optJSONArray("fixedColumns")
        if (fixedCols != null && fixedCols.length() > 0) {
            val fCol = fixedCols.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFixedColumnRenderer")
            val fRuns = fCol?.optJSONObject("text")?.optJSONArray("runs")
            if (fRuns != null && fRuns.length() > 0) {
                val fText = fRuns.optJSONObject(0)?.optString("text") ?: ""
                if (fText.contains(":")) {
                    durationStr = fText.trim()
                }
            }
        }

        // 3. Fallback to parsing subtitle parts
        if (col2Parts.isNotEmpty()) {
            val firstTag = col2Parts[0].lowercase()
            if (firstTag == "artist") {
                itemType = "ARTIST"
                if (artistName.isEmpty()) artistName = title
                if (artistId.isEmpty()) artistId = browseId
                if (col2Parts.size > 1) subscribers = col2Parts[1]
            } else if (firstTag == "album" || firstTag == "ep" || firstTag == "single") {
                itemType = "ALBUM"
                if (artistName.isEmpty() && col2Parts.size > 1) artistName = col2Parts[1]
                if (albumId.isEmpty()) albumId = browseId
                if (albumName.isEmpty()) albumName = title
                if (col2Parts.size > 2) year = col2Parts[2]
            } else if (firstTag == "playlist") {
                itemType = "PLAYLIST"
                if (artistName.isEmpty() && col2Parts.size > 1) artistName = col2Parts[1]
                if (col2Parts.size > 2) trackCount = col2Parts[2]
            } else if (firstTag == "video") {
                itemType = "VIDEO"
                if (artistName.isEmpty() && col2Parts.size > 1) artistName = col2Parts[1]
                for (k in 2 until col2Parts.size) {
                    if (col2Parts[k].contains(":")) durationStr = col2Parts[k]
                }
            } else if (firstTag == "song") {
                itemType = "SONG"
                if (artistName.isEmpty() && col2Parts.size > 1) artistName = col2Parts[1]
                if (albumName.isEmpty() && col2Parts.size > 2 && !col2Parts[2].contains(":")) albumName = col2Parts[2]
                for (k in 2 until col2Parts.size) {
                    if (col2Parts[k].contains(":")) durationStr = col2Parts[k]
                }
            } else {
                if (browseId.startsWith("UC")) {
                    itemType = "ARTIST"
                    if (artistName.isEmpty()) artistName = title
                    if (artistId.isEmpty()) artistId = browseId
                } else if (browseId.startsWith("MPREb_")) {
                    itemType = "ALBUM"
                    if (artistName.isEmpty()) artistName = col2Parts[0]
                    if (albumId.isEmpty()) albumId = browseId
                    if (albumName.isEmpty()) albumName = title
                } else if (browseId.startsWith("VL") || browseId.startsWith("PL")) {
                    itemType = "PLAYLIST"
                    if (artistName.isEmpty()) artistName = col2Parts[0]
                } else if (watchId.isNotEmpty()) {
                    itemType = "SONG"
                    if (artistName.isEmpty()) artistName = col2Parts[0]
                    if (albumName.isEmpty() && col2Parts.size > 1 && !col2Parts[1].contains(":")) albumName = col2Parts[1]
                    for (k in 1 until col2Parts.size) {
                        if (col2Parts[k].contains(":")) durationStr = col2Parts[k]
                    }
                }
            }
        }

        if (artistName.isEmpty()) {
            artistName = "Unknown Artist"
        }

        val durationSec = parseDurationSeconds(durationStr)
        val durationMs = durationSec * 1000

        val isAtv = musicVideoType == "MUSIC_VIDEO_TYPE_ATV"
        val isOmv = musicVideoType == "MUSIC_VIDEO_TYPE_OMV" || musicVideoType == "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC_VIDEO"
        val isTopic = artistName.trim().endsWith("- Topic") || col2Text.contains("- Topic")
        val isOfficial = isAtv || isOmv || isTopic || (itemType == "ARTIST" || itemType == "ALBUM" || itemType == "PLAYLIST") || (itemType == "SONG" && musicVideoType.isNotEmpty() && musicVideoType != "MUSIC_VIDEO_TYPE_UGC" && musicVideoType != "MUSIC_VIDEO_TYPE_PODCAST_EPISODE")

        val itemObj = JSONObject()
        itemObj.put("id", if (watchId.isNotEmpty()) watchId else browseId)
        itemObj.put("type", itemType)
        itemObj.put("title", title)
        itemObj.put("subtitle", col2Text)
        itemObj.put("artistName", artistName)
        itemObj.put("artistId", artistId)
        itemObj.put("albumName", albumName)
        itemObj.put("albumId", albumId)
        itemObj.put("durationMs", durationMs)
        itemObj.put("duration", if (durationStr.isNotEmpty()) durationStr else if (durationMs > 0) String.format("%d:%02d", durationSec / 60, durationSec % 60) else "--:--")
        itemObj.put("thumbnail", art)
        itemObj.put("browseId", browseId)
        itemObj.put("videoId", watchId)
        itemObj.put("year", year)
        itemObj.put("subscribers", subscribers)
        itemObj.put("trackCount", trackCount)
        itemObj.put("isExplicit", isExplicit)
        itemObj.put("musicVideoType", musicVideoType)
        itemObj.put("isOfficial", isOfficial)
        itemObj.put("sourceRank", rankIndex)

        return itemObj
    }

    private fun parseTwoRowItem(twoRow: JSONObject): JSONObject? {
        val titleRuns = twoRow.optJSONObject("title")?.optJSONArray("runs")
        val title = titleRuns?.optJSONObject(0)?.optString("text") ?: return null

        val subRuns = twoRow.optJSONObject("subtitle")?.optJSONArray("runs")
        var subtitle = ""
        val artistNames = mutableListOf<String>()
        var artistName = ""
        var artistId = ""
        var albumName = ""
        var albumId = ""
        val subParts = mutableListOf<String>()
        if (subRuns != null) {
            for (i in 0 until subRuns.length()) {
                val run = subRuns.optJSONObject(i) ?: continue
                val t = run.optString("text") ?: ""
                subtitle += t
                val trimmed = t.trim()
                if (trimmed.isNotEmpty() && trimmed != "•" && trimmed != "&" && trimmed != ",") subParts.add(trimmed)

                val navEnd = run.optJSONObject("navigationEndpoint")
                val bId = navEnd?.optJSONObject("browseEndpoint")?.optString("browseId") ?: ""
                if (bId.startsWith("UC") || bId.startsWith("FEmusic_library_privately_owned_artist_detail")) {
                    if (!artistNames.contains(trimmed)) {
                        artistNames.add(trimmed)
                    }
                    if (artistId.isEmpty()) {
                        artistId = bId
                    }
                }
            }
        }
        if (artistNames.isNotEmpty()) {
            artistName = artistNames.joinToString(", ")
        }

        val nav = twoRow.optJSONObject("navigationEndpoint") ?: titleRuns?.optJSONObject(0)?.optJSONObject("navigationEndpoint")
        val browseId = nav?.optJSONObject("browseEndpoint")?.optString("browseId") ?: ""
        val art = extractThumbnail(twoRow)

        var itemType = "ALBUM"
        val subLower = subtitle.lowercase()
        if (subLower.contains("artist") || browseId.startsWith("UC")) {
            itemType = "ARTIST"
            artistName = title
            artistId = browseId
        } else if (subLower.contains("playlist") || browseId.startsWith("VL") || browseId.startsWith("PL")) {
            itemType = "PLAYLIST"
            if (artistName.isEmpty() && subParts.isNotEmpty()) artistName = subParts[0]
        } else {
            itemType = "ALBUM"
            albumName = title
            albumId = browseId
            if (artistName.isEmpty() && subParts.isNotEmpty()) artistName = subParts[0]
        }

        val itemObj = JSONObject()
        itemObj.put("id", browseId)
        itemObj.put("type", itemType)
        itemObj.put("title", title)
        itemObj.put("subtitle", subtitle)
        itemObj.put("artistName", artistName)
        itemObj.put("artistId", artistId)
        itemObj.put("albumName", albumName)
        itemObj.put("albumId", albumId)
        itemObj.put("thumbnail", art)
        itemObj.put("browseId", browseId)
        itemObj.put("videoId", "")
        itemObj.put("isOfficial", true)
        itemObj.put("sourceRank", 99)

        return itemObj
    }

    /**
     * Legacy Search for Backward Compatibility
     */
    suspend fun search(query: String): JSONArray {
        val res = searchUnified(query)
        val songs = res.optJSONArray("songs") ?: JSONArray()
        val top = res.optJSONObject("topResult")
        if (top != null && top.optString("type") == "SONG" && top.optString("videoId").isNotEmpty()) {
            val topTrack = JSONObject()
            topTrack.put("id", top.optString("videoId"))
            topTrack.put("title", top.optString("title"))
            topTrack.put("artist", top.optString("artistName"))
            topTrack.put("album", top.optString("albumName"))
            topTrack.put("duration", top.optInt("durationMs") / 1000)
            topTrack.put("artworkUrl", top.optString("thumbnail"))
            
            val combined = JSONArray()
            combined.put(topTrack)
            for (i in 0 until songs.length()) {
                val s = songs.optJSONObject(i) ?: continue
                val t = JSONObject()
                t.put("id", s.optString("id"))
                t.put("title", s.optString("title"))
                t.put("artist", s.optString("artistName"))
                t.put("album", s.optString("albumName"))
                t.put("duration", s.optInt("durationMs") / 1000)
                t.put("artworkUrl", s.optString("thumbnail"))
                combined.put(t)
            }
            return combined
        }
        
        val flatTracks = JSONArray()
        for (i in 0 until songs.length()) {
            val s = songs.optJSONObject(i) ?: continue
            val t = JSONObject()
            t.put("id", s.optString("id"))
            t.put("title", s.optString("title"))
            t.put("artist", s.optString("artistName"))
            t.put("album", s.optString("albumName"))
            t.put("duration", s.optInt("durationMs") / 1000)
            t.put("artworkUrl", s.optString("thumbnail"))
            flatTracks.put(t)
        }
        return flatTracks
    }

    suspend fun searchArtists(query: String): JSONArray {
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
                        val artistsArray = JSONArray()

                        val contents = root.optJSONObject("contents")?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val shelf = contents.optJSONObject(i)?.optJSONObject("musicShelfRenderer")
                                val items = shelf?.optJSONArray("contents")
                                if (items != null) {
                                    for (j in 0 until items.length()) {
                                        val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                        if (item != null) {
                                            val columns = item.optJSONArray("flexColumns")
                                            if (columns != null && columns.length() > 0) {
                                                val title = columns.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text")
                                                val browseId = item.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                                                val art = extractThumbnail(item)
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
                        continuation.resume(artistsArray)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    suspend fun searchAlbums(query: String): JSONArray {
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
                        val albumsArray = JSONArray()

                        val contents = root.optJSONObject("contents")?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val shelf = contents.optJSONObject(i)?.optJSONObject("musicShelfRenderer")
                                val items = shelf?.optJSONArray("contents")
                                if (items != null) {
                                    for (j in 0 until items.length()) {
                                        val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                        if (item != null) {
                                            val columns = item.optJSONArray("flexColumns")
                                            if (columns != null && columns.length() > 0) {
                                                val title = columns.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text")
                                                val browseId = item.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                                                val art = extractThumbnail(item)
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
                        continuation.resume(albumsArray)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    suspend fun searchPlaylists(query: String): JSONArray {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)
            json.put("params", "EgWKAQIoAWoMEAMQBBAJEA4QChAF")

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
                        val playlistsArray = JSONArray()

                        val contents = root.optJSONObject("contents")?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val shelf = contents.optJSONObject(i)?.optJSONObject("musicShelfRenderer")
                                val items = shelf?.optJSONArray("contents")
                                if (items != null) {
                                    for (j in 0 until items.length()) {
                                        val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                        if (item != null) {
                                            val parsed = parseResponsiveItem(item, playlistsArray.length())
                                            if (parsed != null) {
                                                playlistsArray.put(parsed)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        continuation.resume(playlistsArray)
                    } catch (e: Exception) {
                        continuation.resumeWithException(e)
                    }
                }
            })
        }
    }

    suspend fun getArtistDetails(browseId: String): JSONObject {
        var targetBrowseId = browseId
        var preResolvedName = ""
        var preResolvedArt = ""

        if (!targetBrowseId.startsWith("UC") && !targetBrowseId.startsWith("FE")) {
            try {
                val artists = searchArtists(targetBrowseId)
                if (artists.length() > 0) {
                    val first = artists.getJSONObject(0)
                    targetBrowseId = first.optString("id", targetBrowseId)
                    preResolvedName = first.optString("title", "")
                    preResolvedArt = first.optString("art", "")
                }
            } catch (e: Exception) {
                // Keep targetBrowseId as is
            }
        }

        val finalBrowseId = targetBrowseId

        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("browseId", finalBrowseId)

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
                        val header = root.optJSONObject("header")?.optJSONObject("musicImmersiveHeaderRenderer")
                            ?: root.optJSONObject("header")?.optJSONObject("musicVisualHeaderRenderer")
                            ?: root.optJSONObject("header")?.optJSONObject("musicHeaderRenderer")

                        val title = header?.optJSONObject("title")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text")
                            ?: (if (preResolvedName.isNotEmpty()) preResolvedName else "Unknown Artist")

                        val thumbnails = header?.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails") 
                            ?: header?.optJSONObject("foregroundThumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                        val artwork = if (thumbnails != null && thumbnails.length() > 0) {
                            thumbnails.optJSONObject(thumbnails.length() - 1)?.optString("url") ?: ""
                        } else preResolvedArt

                        val descRuns = header?.optJSONObject("description")?.optJSONArray("runs")
                        val desc = if (descRuns != null && descRuns.length() > 0) descRuns.optJSONObject(0)?.optString("text") ?: "" else ""

                        val result = JSONObject()
                        result.put("id", finalBrowseId)
                        result.put("name", title)
                        result.put("art", artwork)
                        result.put("description", desc)
                        
                        val songsArray = JSONArray()
                        val albumsArray = JSONArray()

                        val tabs = root.optJSONObject("contents")?.optJSONObject("singleColumnBrowseResultsRenderer")?.optJSONArray("tabs")
                            ?: root.optJSONObject("contents")?.optJSONObject("twoColumnBrowseResultsRenderer")?.optJSONObject("secondaryContents")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")
                        
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
                                        val parsed = parseResponsiveItem(rowItem, songsArray.length())
                                        if (parsed != null) {
                                            val tJson = JSONObject()
                                            tJson.put("id", parsed.optString("id"))
                                            tJson.put("title", parsed.optString("title"))
                                            tJson.put("artist", if (parsed.optString("artistName").isNotEmpty() && parsed.optString("artistName") != "Unknown Artist") parsed.optString("artistName") else title)
                                            tJson.put("artistId", if (parsed.optString("artistId").isNotEmpty()) parsed.optString("artistId") else finalBrowseId)
                                            tJson.put("album", parsed.optString("albumName"))
                                            tJson.put("albumId", parsed.optString("albumId"))
                                            tJson.put("duration", parsed.optInt("durationMs") / 1000)
                                            tJson.put("artworkUrl", if (parsed.optString("thumbnail").isNotEmpty()) parsed.optString("thumbnail") else artwork)
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
                                val straplineRuns = headerSection.optJSONObject("straplineTextOne")?.optJSONArray("runs")
                                if (straplineRuns != null && straplineRuns.length() > 0) {
                                    val artistSb = StringBuilder()
                                    for (r in 0 until straplineRuns.length()) {
                                        val runObj = straplineRuns.optJSONObject(r) ?: continue
                                        artistSb.append(runObj.optString("text"))
                                    }
                                    val fullArtist = artistSb.toString().trim()
                                    if (fullArtist.isNotEmpty()) {
                                        artist = fullArtist
                                    }
                                }
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
                        
                        val tracksArray = JSONArray()

                        val contents = root.optJSONObject("contents")?.optJSONObject("twoColumnBrowseResultsRenderer")?.optJSONObject("secondaryContents")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")?.optJSONObject(0)?.optJSONObject("musicShelfRenderer")?.optJSONArray("contents")
                            ?: root.optJSONObject("contents")?.optJSONObject("singleColumnBrowseResultsRenderer")?.optJSONArray("tabs")?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents")?.optJSONObject(0)?.optJSONObject("musicShelfRenderer")?.optJSONArray("contents")
                        
                        if (contents != null) {
                            for (i in 0 until contents.length()) {
                                val item = contents.optJSONObject(i)?.optJSONObject("musicResponsiveListItemRenderer")
                                if (item != null) {
                                    val parsed = parseResponsiveItem(item, tracksArray.length())
                                    if (parsed != null) {
                                        val tJson = JSONObject()
                                        tJson.put("id", parsed.optString("id"))
                                        tJson.put("title", parsed.optString("title"))
                                        tJson.put("artist", if (parsed.optString("artistName").isNotEmpty() && parsed.optString("artistName") != "Unknown Artist") parsed.optString("artistName") else artist)
                                        tJson.put("artistId", parsed.optString("artistId"))
                                        tJson.put("album", title)
                                        tJson.put("albumId", browseId)
                                        tJson.put("duration", parsed.optInt("durationMs") / 1000)
                                        tJson.put("artworkUrl", if (parsed.optString("thumbnail").isNotEmpty()) parsed.optString("thumbnail") else artwork)
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

    /**
     * Fetch radio automix recommendations for a videoId via InnerTube /v1/next.
     * Guaranteed bounded execution with timeout and safe fallback.
     */
    suspend fun getRadioAutomix(videoId: String): JSONArray = withTimeoutOrNull(3500L) {
        suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("videoId", videoId)
            json.put("playlistId", "RDAMVM$videoId")
            json.put("isAudioOnly", true)

            val request = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/next?prettyPrint=false")
                .post(json.toString().toRequestBody("application/json".toMediaType()))
                .header("User-Agent", "Mozilla/5.0")
                .build()

            val call = client.newCall(request)
            continuation.invokeOnCancellation {
                try {
                    call.cancel()
                } catch (_: Throwable) {}
            }

            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (continuation.isActive) {
                        continuation.resume(JSONArray())
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    try {
                        val body = response.body?.string() ?: ""
                        val root = JSONObject(body)
                        val results = JSONArray()

                        val tabs = root.optJSONObject("contents")
                            ?.optJSONObject("singleColumnMusicWatchNextResultsRenderer")
                            ?.optJSONObject("tabbedRenderer")
                            ?.optJSONObject("watchNextTabbedResultsRenderer")
                            ?.optJSONArray("tabs")

                        val tab0 = tabs?.optJSONObject(0)?.optJSONObject("tabRenderer")?.optJSONObject("content")
                        val playlistPanel = tab0?.optJSONObject("musicQueueRenderer")?.optJSONObject("content")?.optJSONObject("playlistPanelRenderer")
                            ?: root.optJSONObject("continuationContents")?.optJSONObject("playlistPanelContinuation")

                        val items = playlistPanel?.optJSONArray("contents")
                        if (items != null) {
                            for (i in 0 until items.length()) {
                                val item = items.optJSONObject(i)?.optJSONObject("playlistPanelVideoRenderer") ?: continue
                                val vId = item.optString("videoId")
                                if (vId.isEmpty() || vId == videoId) continue

                                val titleRuns = item.optJSONObject("title")?.optJSONArray("runs")
                                val title = titleRuns?.optJSONObject(0)?.optString("text") ?: ""
                                if (title.isEmpty()) continue

                                val longBylineRuns = item.optJSONObject("longBylineText")?.optJSONArray("runs")
                                    ?: item.optJSONObject("shortBylineText")?.optJSONArray("runs")
                                val artistNames = mutableListOf<String>()
                                var artistName = ""
                                var artistId = ""
                                var albumName = ""
                                var albumId = ""

                                if (longBylineRuns != null) {
                                    for (r in 0 until longBylineRuns.length()) {
                                        val run = longBylineRuns.optJSONObject(r) ?: continue
                                        val text = run.optString("text").trim()
                                        if (text.isEmpty() || text == "•" || text == "&" || text == ",") continue
                                        val navEnd = run.optJSONObject("navigationEndpoint")
                                        val bId = navEnd?.optJSONObject("browseEndpoint")?.optString("browseId") ?: ""
                                        if (bId.startsWith("UC")) {
                                            if (!artistNames.contains(text)) {
                                                artistNames.add(text)
                                            }
                                            if (artistId.isEmpty()) {
                                                artistId = bId
                                            }
                                        } else if (bId.startsWith("MPREb_")) {
                                            if (albumName.isEmpty()) {
                                                albumName = text
                                                albumId = bId
                                            }
                                        } else if (artistNames.isEmpty()) {
                                            artistNames.add(text)
                                        }
                                    }
                                }
                                if (artistNames.isNotEmpty()) {
                                    artistName = artistNames.joinToString(", ")
                                }

                                val lengthText = item.optJSONObject("lengthText")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text")
                                    ?: item.optJSONObject("lengthText")?.optString("simpleText") ?: ""
                                val durSec = parseDurationSeconds(lengthText)

                                val thumbs = item.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                var artwork = ""
                                if (thumbs != null && thumbs.length() > 0) {
                                    artwork = thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") ?: ""
                                }

                                val navEnd = item.optJSONObject("navigationEndpoint")
                                val musicVideoType = navEnd?.optJSONObject("watchEndpoint")
                                    ?.optJSONObject("watchEndpointMusicSupportedConfigs")
                                    ?.optJSONObject("watchEndpointMusicConfig")
                                    ?.optString("musicVideoType", "") ?: ""

                                val isAtv = musicVideoType == "MUSIC_VIDEO_TYPE_ATV"
                                val isOmv = musicVideoType == "MUSIC_VIDEO_TYPE_OMV" || musicVideoType == "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC_VIDEO"
                                val isTopic = artistName.trim().endsWith("- Topic")
                                val isOfficial = isAtv || isOmv || isTopic || (musicVideoType.isNotEmpty() && musicVideoType != "MUSIC_VIDEO_TYPE_UGC" && musicVideoType != "MUSIC_VIDEO_TYPE_PODCAST_EPISODE")

                                if (musicVideoType == "MUSIC_VIDEO_TYPE_PODCAST_EPISODE") continue

                                val trackObj = JSONObject()
                                trackObj.put("id", vId)
                                trackObj.put("videoId", vId)
                                trackObj.put("title", title)
                                trackObj.put("artist", if (artistName.isNotEmpty()) artistName else "Unknown Artist")
                                trackObj.put("artistName", if (artistName.isNotEmpty()) artistName else "Unknown Artist")
                                trackObj.put("artistId", artistId)
                                trackObj.put("album", albumName)
                                trackObj.put("albumName", albumName)
                                trackObj.put("albumId", albumId)
                                trackObj.put("duration", durSec)
                                trackObj.put("durationMs", durSec * 1000)
                                trackObj.put("artworkUrl", artwork)
                                trackObj.put("thumbnail", artwork)
                                trackObj.put("musicVideoType", musicVideoType)
                                trackObj.put("isOfficial", isOfficial)

                                results.put(trackObj)
                            }
                        }

                        if (continuation.isActive) {
                            continuation.resume(results)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "[Automix] Exception parsing radio: ${e.message}", e)
                        if (continuation.isActive) {
                            continuation.resume(JSONArray())
                        }
                    }
                }
            })
        }
    } ?: JSONArray()
}
