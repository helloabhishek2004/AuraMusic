import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# Add logging inside the search loop
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
                                                    tracks.add(trackInfo)
                                                }
                                            }
                                        }
                                    }
                                }
                            }'''

new_loop = '''                            var musicResponsiveItems = 0
                            var songsCandidate = 0
                            var songsWithVideoId = 0

                            for (i in 0 until contents.length()) {
                                val section = contents.optJSONObject(i)
                                val shelf = section?.optJSONObject("musicShelfRenderer")
                                if (shelf != null) {
                                    val items = shelf.optJSONArray("contents")
                                    if (items != null) {
                                        for (j in 0 until items.length()) {
                                            val item = items.optJSONObject(j)?.optJSONObject("musicResponsiveListItemRenderer")
                                            if (item != null) {
                                                musicResponsiveItems++
                                                songsCandidate++
                                                val trackInfo = parseMusicResponsiveListItemRenderer(item)
                                                if (trackInfo != null) {
                                                    songsWithVideoId++
                                                    tracks.add(trackInfo)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Log.d("SEARCH_DEBUG", "musicResponsiveItems=$musicResponsiveItems")
                            Log.d("SEARCH_DEBUG", "songsCandidate=$songsCandidate")
                            Log.d("SEARCH_DEBUG", "songsWithVideoId=$songsWithVideoId")
'''

content = content.replace(old_loop, new_loop)

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
