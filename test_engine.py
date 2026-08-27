import re
with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='utf-8') as f:
    content = f.read()

print("Contains searchArtists:", "searchArtists" in content)
print("Contains searchAlbums:", "searchAlbums" in content)
