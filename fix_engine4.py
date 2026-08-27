import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = 'if (t != null && !t.contains(" ")) parts.add(t.trim())'
new_str = 'if (t != null && t.trim() != "\\u2022") parts.add(t.trim())'

content = content.replace(old_str, new_str)

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
