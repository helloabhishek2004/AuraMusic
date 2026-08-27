import re
with open('android/app/src/main/java/com/auramusic/core/youtube/AuraYouTubeEngine.kt', 'r', encoding='ISO-8859-1') as f:
    content = f.read()

print("Contains searchArtists:", "searchArtists" in content)
print("Contains searchAlbums:", "searchAlbums" in content)
print("Contains getArtistDetails:", "getArtistDetails" in content)
print("Contains getAlbumDetails:", "getAlbumDetails" in content)
