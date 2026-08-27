import re

with open('android/app/src/main/java/com/auramusic/core/bridge/AuraYouTubeModule.kt', 'r', encoding='utf-8') as f:
    content = f.read()

kotlin_methods = '''
    @ReactMethod
    fun searchArtists(query: String, promise: Promise) {
        scope.launch {
            try {
                val result = engine.searchArtists(query)
                promise.resolve(convertJsonToArray(result))
            } catch (e: Exception) {
                promise.reject("SEARCH_ARTIST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun searchAlbums(query: String, promise: Promise) {
        scope.launch {
            try {
                val result = engine.searchAlbums(query)
                promise.resolve(convertJsonToArray(result))
            } catch (e: Exception) {
                promise.reject("SEARCH_ALBUM_ERROR", e.message, e)
            }
        }
    }
'''

content = content.replace('    @ReactMethod\n    fun getArtistDetails', kotlin_methods + '\n    @ReactMethod\n    fun getArtistDetails')
with open('android/app/src/main/java/com/auramusic/core/bridge/AuraYouTubeModule.kt', 'w', encoding='utf-8') as f:
    f.write(content)
