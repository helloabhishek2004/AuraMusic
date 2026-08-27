import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

old_loop = '''                            for (i in 0 until contents.length()) {
                                val section = contents.optJSONObject(i)
                                val shelf = section?.optJSONObject("musicShelfRenderer")
                                if (shelf != null) {
                                    val items = shelf.optJSONArray("contents")
                                    if (items != null) {
                                        for (j in 0 until items.length()) {
                                            val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                            if (item != null) {
                                                val trackInfo = parseMusicResponsiveListItemRenderer(item)
                                                if (trackInfo != null) {
                                                    val tJson = JSONObject()
                                                    tJson.put("id", trackInfo.id)
                                                    tJson.put("title", trackInfo.title)
                                                    tJson.put("artist", trackInfo.artist)
                                                    tJson.put("album", trackInfo.album)
                                                    tJson.put("duration", trackInfo.duration)
                                                    tJson.put("artworkUrl", trackInfo.artworkUrl)
                                                    tracksArray.put(tJson)
                                                }
                                            }
                                        }
                                    }
                                }
                            }'''

new_loop = '''                            for (i in 0 until contents.length()) {
                                val section = contents.optJSONObject(i)
                                val shelf = section?.optJSONObject("musicShelfRenderer")
                                val itemSection = section?.optJSONObject("itemSectionRenderer")
                                
                                val items = shelf?.optJSONArray("contents") ?: itemSection?.optJSONArray("contents")
                                if (items != null) {
                                    for (j in 0 until items.length()) {
                                        val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                        if (item != null) {
                                            val trackInfo = parseMusicResponsiveListItemRenderer(item)
                                            if (trackInfo != null) {
                                                val tJson = JSONObject()
                                                tJson.put("id", trackInfo.id)
                                                tJson.put("title", trackInfo.title)
                                                tJson.put("artist", trackInfo.artist)
                                                tJson.put("album", trackInfo.album)
                                                tJson.put("duration", trackInfo.duration)
                                                tJson.put("artworkUrl", trackInfo.artworkUrl)
                                                tracksArray.put(tJson)
                                            }
                                        }
                                    }
                                }
                            }'''

content = content.replace(old_loop, new_loop)

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
