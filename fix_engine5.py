import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# I want to find the first occurrence of:
# "if (contents != null) {\n                            for (i in 0 until contents.length()) {"
# and replace the loop body for search()
# Specifically, we know `search` is the very first one!

pattern = r'''(val contents = root\.optJSONObject\("contents"\)\?\.optJSONObject\("tabbedSearchResultsRenderer"\)\?\.optJSONArray\("tabs"\)\?\.optJSONObject\(0\)\?\.optJSONObject\("tabRenderer"\)\?\.optJSONObject\("content"\)\?\.optJSONObject\("sectionListRenderer"\)\?\.optJSONArray\("contents"\)\s+if \(contents != null\) \{\s+for \(i in 0 until contents\.length\(\)\) \{)\s+val section = contents\.optJSONObject\(i\)\s+val shelf = section\?\.optJSONObject\("musicShelfRenderer"\)\s+if \(shelf != null\) \{\s+val items = shelf\.optJSONArray\("contents"\)\s+if \(items != null\) \{\s+for \(j in 0 until items\.length\(\)\) \{\s+val item = items\.optJSONObject\(j\)\?\.optJSONObject\("musicResponsiveListItemRenderer"\)\s+if \(item != null\) \{\s+val track = parseMusicResponsiveListItemRenderer\(item\)\s+if \(track != null\) \{\s+val tJson = JSONObject\(\)\s+tJson\.put\("id", track\.id\)\s+tJson\.put\("title", track\.title\)\s+tJson\.put\("artist", track\.artist\)\s+tJson\.put\("album", track\.album\)\s+tJson\.put\("duration", track\.duration\)\s+tJson\.put\("artworkUrl", track\.artworkUrl\)\s+tracksArray\.put\(tJson\)\s+\}\s+\}\s+\}\s+\}\s+\}\s+\}'''

replacement = r'''\1
                                val section = contents.optJSONObject(i)
                                val shelf = section?.optJSONObject("musicShelfRenderer")
                                val itemSection = section?.optJSONObject("itemSectionRenderer")
                                val items = shelf?.optJSONArray("contents") ?: itemSection?.optJSONArray("contents")
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
                            }'''

new_content = re.sub(pattern, replacement, content, count=1)

if new_content != content:
    print("Replaced!")
    with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
        f.write(new_content)
else:
    print("Pattern not found!")
