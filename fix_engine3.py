# -*- coding: utf-8 -*-
import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix artistRun parsing
old_artist = '''        if (artistRun != null) {
            val parts = mutableListOf<String>()
            for (i in 0 until artistRun.length()) {
                val t = artistRun.optJSONObject(i)?.optString("text")
                if (t != null && !t.contains(" ")) parts.add(t.trim())
            }
            if (parts.isNotEmpty()) artist = parts[0]
            if (parts.size > 1) album = parts[1]
        }'''

new_artist = '''        if (artistRun != null) {
            val parts = mutableListOf<String>()
            for (i in 0 until artistRun.length()) {
                val t = artistRun.optJSONObject(i)?.optString("text")
                if (t != null && t.trim() != "\u2022") parts.add(t.trim())
            }
            if (parts.isNotEmpty()) artist = parts.joinToString(", ") // wait, no, they are separated by bullet points!
        }'''

# wait, the runs array contains: ArtistName, Bullet, AlbumName, Bullet, Year
new_artist_correct = '''        if (artistRun != null) {
            val parts = mutableListOf<String>()
            for (i in 0 until artistRun.length()) {
                val t = artistRun.optJSONObject(i)?.optString("text")
                if (t != null && t.trim() != "\u2022") parts.add(t.trim())
            }
            if (parts.isNotEmpty()) artist = parts[0]
            if (parts.size > 1) album = parts[1]
        }'''

if old_artist in content:
    content = content.replace(old_artist, new_artist_correct)
    print("Replaced successfully!")
else:
    print("WARNING: Old artist pattern not found!")

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
