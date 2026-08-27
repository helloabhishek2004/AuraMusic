import re

with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to add the overlay fallback for videoId
old_code = """        val videoId = root.optJSONObject("playlistItemData")?.optString("videoId") 
            ?: root.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")
            ?: titleRun?.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")
            ?: return null"""

new_code = """        val videoId = root.optJSONObject("playlistItemData")?.optString("videoId") 
            ?: root.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")
            ?: titleRun?.optJSONObject("navigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")
            ?: root.optJSONObject("overlay")?.optJSONObject("musicItemThumbnailOverlayRenderer")?.optJSONObject("content")?.optJSONObject("musicPlayButtonRenderer")?.optJSONObject("playNavigationEndpoint")?.optJSONObject("watchEndpoint")?.optString("videoId")
            ?: return null"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched AuraYouTubeEngine!")
else:
    print("Could not find the parser code block to replace.")

