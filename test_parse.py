import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('fun parseMusicResponsiveListItemRenderer')
print(content[idx:idx+2500])

