import re

with open('engine.bak.kt', 'r', encoding='ISO-8859-1') as f:
    content = f.read()

# Fix searchArtists & searchAlbums browseId issue
old_artist_id = 'val browseId = titleRun?.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")'
new_artist_id = 'val browseId = item.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")'
content = content.replace(old_artist_id, new_artist_id)

new_getArtistDetails = """
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
"""

new_getAlbumDetails = """
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
"""

start_artist = content.find("suspend fun getArtistDetails")
end_artist = content.find("suspend fun searchArtists")

start_album = content.find("suspend fun getAlbumDetails")
end_album = content.rfind("}") # end of file class

if start_artist != -1 and end_artist != -1:
    content = content[:start_artist] + new_getArtistDetails.strip() + "\n\n    " + content[end_artist:]

start_album = content.find("suspend fun getAlbumDetails")
end_album = content.rfind("}") 

if start_album != -1 and end_album != -1:
    content = content[:start_album] + new_getAlbumDetails.strip() + "\n}"

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='ISO-8859-1') as f:
    f.write(content)
