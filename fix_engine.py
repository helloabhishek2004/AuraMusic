import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix videoId extraction in parseMusicResponsiveListItemRenderer
old_video_id = '?: titleRun.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")'
new_video_id = '?: root.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")'

if old_video_id in content:
    content = content.replace(old_video_id, new_video_id)
else:
    print("WARNING: Old video ID pattern not found!")

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
