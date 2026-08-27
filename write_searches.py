import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

kotlin_methods = '''
    suspend fun searchArtists(query: String): org.json.JSONArray {
        return suspendCancellableCoroutine { continuation ->
            val json = JSONObject()
            json.put("context", getBaseContext())
            json.put("query", query)
            json.put("params", "EgWKAQIgAWoMEAMQBBAJEA4QChAF") // Artists

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
                                val shelf = contents.optJSONObject(i)?.optJSONObject("musicShelfRenderer")
                                if (shelf != null) {
                                    val items = shelf.optJSONArray("contents")
                                    if (items != null) {
                                        for (j in 0 until items.length()) {
                                            val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                            if (item != null) {
                                                val columns = item.optJSONArray("flexColumns")
                                                if (columns != null && columns.length() > 0) {
                                                    val titleRun = columns.optJSONObject(0)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)
                                                    val name = titleRun?.optString("text")
                                                    val browseId = titleRun?.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                                                    
                                                    val thumbs = item.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                                    val art = if (thumbs != null && thumbs.length() > 0) {
                                                        thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") ?: ""
                                                    } else ""
                                                    
                                                    if (name != null && browseId != null) {
                                                        val aObj = JSONObject()
                                                        aObj.put("id", browseId)
                                                        aObj.put("title", name)
                                                        aObj.put("art", art)
                                                        artistsArray.put(aObj)
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
            json.put("params", "EgWKAQIYAWoMEAMQBBAJEA4QChAF") // Albums

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
                                val shelf = contents.optJSONObject(i)?.optJSONObject("musicShelfRenderer")
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
                                                    val browseId = titleRun?.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                                                    
                                                    val artistRun = columns.optJSONObject(1)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")?.optJSONObject(0)
                                                    val artist = artistRun?.optString("text") ?: ""

                                                    val thumbs = item.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                                    val art = if (thumbs != null && thumbs.length() > 0) {
                                                        thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") ?: ""
                                                    } else ""
                                                    
                                                    if (title != null && browseId != null) {
                                                        val aObj = JSONObject()
                                                        aObj.put("id", browseId)
                                                        aObj.put("title", title)
                                                        aObj.put("artist", artist)
                                                        aObj.put("art", art)
                                                        albumsArray.put(aObj)
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
'''

content = content.replace('    suspend fun getAlbumDetails(browseId: String): JSONObject {', kotlin_methods + '\n    suspend fun getAlbumDetails(browseId: String): JSONObject {')
with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
