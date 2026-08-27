package com.auramusic.core.bridge

import com.facebook.react.bridge.*
import com.auramusic.core.youtube.AuraYouTubeEngine
import kotlinx.coroutines.*
import org.json.JSONObject
import org.json.JSONArray

class AuraYouTubeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraYouTubeModule"

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val engine = AuraYouTubeEngine(reactContext)

    @ReactMethod
    fun search(query: String, promise: Promise) {
        scope.launch {
            try {
                val result = engine.search(query)
                promise.resolve(convertJsonToArray(result))
            } catch (e: Exception) {
                promise.reject("SEARCH_ERROR", e.message, e)
            }
        }
    }

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

    @ReactMethod
    fun getArtistDetails(browseId: String, promise: Promise) {
        scope.launch {
            try {
                val result = engine.getArtistDetails(browseId)
                promise.resolve(convertJsonToMap(result))
            } catch (e: Exception) {
                promise.reject("ARTIST_DETAILS_ERROR", e.message, e)
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
                promise.reject("ALBUM_DETAILS_ERROR", e.message, e)
            }
        }
    }

    private fun convertJsonToArray(jsonArray: JSONArray): WritableArray {
        val array = Arguments.createArray()
        for (i in 0 until jsonArray.length()) {
            val value = jsonArray.opt(i)
            when (value) {
                is JSONObject -> array.pushMap(convertJsonToMap(value))
                is JSONArray -> array.pushArray(convertJsonToArray(value))
                is String -> array.pushString(value)
                is Int -> array.pushInt(value)
                is Double -> array.pushDouble(value)
                is Boolean -> array.pushBoolean(value)
                else -> array.pushNull()
            }
        }
        return array
    }

    private fun convertJsonToMap(jsonObject: JSONObject): WritableMap {
        val map = Arguments.createMap()
        val iterator = jsonObject.keys()
        while (iterator.hasNext()) {
            val key = iterator.next()
            val value = jsonObject.opt(key)
            when (value) {
                is JSONObject -> map.putMap(key, convertJsonToMap(value))
                is JSONArray -> map.putArray(key, convertJsonToArray(value))
                is String -> map.putString(key, value)
                is Int -> map.putInt(key, value)
                is Double -> map.putDouble(key, value)
                is Boolean -> map.putBoolean(key, value)
                else -> map.putNull(key)
            }
        }
        return map
    }
}
