import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('fun getArtistDetails')
print(content[idx+3000:idx+6500])

