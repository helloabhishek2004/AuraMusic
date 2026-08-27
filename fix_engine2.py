import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# Make videoId check both root and titleRun
old_video_id2 = '?: root.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")'
new_video_id2 = '?: root.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")\n            ?: titleRun?.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")'

if old_video_id2 in content:
    content = content.replace(old_video_id2, new_video_id2)

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
    f.write(content)
