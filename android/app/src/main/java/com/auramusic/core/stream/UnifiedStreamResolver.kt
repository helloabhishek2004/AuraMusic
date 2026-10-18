package com.auramusic.core.stream

import android.content.Context
import android.util.Log

class UnifiedStreamResolver(
    private val context: Context,
    private val innerTubeResolver: InnerTubeStreamResolver,
    private val androidVrResolver: AndroidVrStreamResolver
) {
    suspend fun resolve(videoId: String, quality: String? = null): StreamResolutionResult {
        // 1. Primary Strategy: Try InnerTube unthrottled WEB_REMIX / ANDROID_MUSIC format extraction
        try {
            Log.i("NativeCore", "[PlaybackTrace] Attempting Primary InnerTube Stream Resolver for track=$videoId quality=$quality")
            val result = innerTubeResolver.resolveStream(videoId, quality)
            if (result.url.isNotEmpty()) {
                Log.i("NativeCore", "[PlaybackTrace] Primary InnerTube Stream Resolution SUCCESS for track=$videoId bitrate=${result.bitrate}")
                return result
            }
        } catch (e: Exception) {
            Log.w("NativeCore", "[PlaybackTrace] Primary InnerTube Stream Resolution failed for track=$videoId: ${e.message}, falling back to AndroidVrStreamResolver")
        }

        // 2. Controlled Fallback: Use existing ANDROID_VR format extraction
        Log.i("NativeCore", "[PlaybackTrace] Using fallback AndroidVrStreamResolver for track=$videoId quality=$quality")
        return androidVrResolver.resolve(videoId, quality)
    }
}
