import re

with open('android/app/src/main/java/com/auramusic/core/bridge/AuraYouTubeModule.kt', 'r', encoding='utf-8') as f:
    content = f.read()

kotlin_methods = '''
    @ReactMethod
    fun getArtistDetails(browseId: String, promise: Promise) {
        scope.launch {
            try {
                val result = engine.getArtistDetails(browseId)
                // Convert org.json.JSONObject to React WritableMap
                promise.resolve(convertJsonToMap(result))
            } catch (e: Exception) {
                promise.reject("ARTIST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getAlbumDetails(browseId: String, promise: Promise) {
        scope.launch {
            try {
                val result = engine.getAlbumDetails(browseId)
                promise.resolve(convertJsonToMap(result))
            } catch (e: Exception) {
                promise.reject("ALBUM_ERROR", e.message, e)
            }
        }
    }

    private fun convertJsonToMap(jsonObject: org.json.JSONObject): WritableMap {
        val map = Arguments.createMap()
        val iterator = jsonObject.keys()
        while (iterator.hasNext()) {
            val key = iterator.next()
            val value = jsonObject.get(key)
            when (value) {
                is String -> map.putString(key, value)
                is Int -> map.putInt(key, value)
                is Boolean -> map.putBoolean(key, value)
                is Double -> map.putDouble(key, value)
                is org.json.JSONArray -> map.putArray(key, convertJsonToArray(value))
                is org.json.JSONObject -> map.putMap(key, convertJsonToMap(value))
            }
        }
        return map
    }

    private fun convertJsonToArray(jsonArray: org.json.JSONArray): WritableArray {
        val array = Arguments.createArray()
        for (i in 0 until jsonArray.length()) {
            when (val value = jsonArray.get(i)) {
                is String -> array.pushString(value)
                is Int -> array.pushInt(value)
                is Boolean -> array.pushBoolean(value)
                is Double -> array.pushDouble(value)
                is org.json.JSONArray -> array.pushArray(convertJsonToArray(value))
                is org.json.JSONObject -> array.pushMap(convertJsonToMap(value))
            }
        }
        return array
    }
'''

content = content.replace('    @ReactMethod\n    fun getTrack(videoId: String, promise: Promise) {', kotlin_methods + '\n    @ReactMethod\n    fun getTrack(videoId: String, promise: Promise) {')
with open('android/app/src/main/java/com/auramusic/core/bridge/AuraYouTubeModule.kt', 'w', encoding='utf-8') as f:
    f.write(content)
