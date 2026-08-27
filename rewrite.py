import os

content = """package com.anonymous.AuraMusic.poc

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.MediaItem

class AuraPocModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraPoc"
    @ReactMethod fun testPlay(videoId: String, promise: Promise) {}
    @ReactMethod fun stop() {}

    companion object {
        var player: ExoPlayer? = null

        suspend fun fetchVisitorData(): String? = withContext(Dispatchers.IO) {
            val t0 = System.currentTimeMillis()
            try {
                val client = okhttp3.OkHttpClient()
                val request = okhttp3.Request.Builder()
                    .url("https://www.youtube.com/")
                    .header("User-Agent", "Mozilla/5.0")
                    .build()
                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext null
                val regex = "\\\"visitorData\\\":\\\"(.*?)\\\"".toRegex()
                val match = regex.find(body)
                val visitorData = match?.groups?.get(1)?.value
                Log.e("AURA_POC_EXP", "VisitorData fetch took \ms: \")
                visitorData
            } catch (e: Exception) {
                Log.e("AURA_POC_EXP", "VisitorData fetch failed: \")
                null
            }
        }

        fun testPlayNative(context: Context) {
            val videoIds = listOf(
                "dQw4w9WgXcQ", // Never Gonna Give You Up
                "jNQXAC9IVRw", // Me at the zoo
                "kJQP7kiw5Fk", // Luis Fonsi - Despacito
                "9bZkp7q19f0", // PSY - GANGNAM STYLE
                "fJ9rUzIMcZQ", // Queen - Bohemian Rhapsody
                "L_jWHffIx5E", // Smash Mouth - All Star
                "09R8_2nJtjg", // Maroon 5 - Sugar
                "RgKAFK5djSk", // Wiz Khalifa - See You Again
                "YQHsXMglC9A", // Adele - Hello
                "OPf0YbXqDm0", // Mark Ronson - Uptown Funk
            )
            
            CoroutineScope(Dispatchers.Main).launch {
                Log.e("AURA_POC_EXP", "=== STARTING PHASE 1B EXPERIMENT ===")
                
                val visitorData = fetchVisitorData()
                if (visitorData == null) {
                    Log.e("AURA_POC_EXP", "Failed to acquire visitorData. Aborting.")
                    return@launch
                }

                val resolver = StreamResolver()
                var successfulUrlToPlay: String? = null
                var successfulVideoId: String? = null

                for (videoId in videoIds) {
                    Log.e("AURA_POC_EXP", "--- TESTING VIDEO: \ ---")
                    val exp = PoTokenExperiment(context)
                    val token = try {
                        exp.run(visitorData)
                    } catch (e: Exception) {
                        Log.e("AURA_POC_EXP", "Token Generation Failed: \")
                        null
                    }
                    
                    if (token != null) {
                        Log.e("AURA_POC_EXP", "Token generated successfully for \ (Length: \)")
                        
                        try {
                            val res1 = resolver.resolve(videoId, null, ClientStrategy.ANDROID_VR, null)
                            Log.e("AURA_POC_EXP", "ANDROID_VR (TEST A: No VisitorData): SUCCESS format \")
                        } catch(e: Exception) {
                            Log.e("AURA_POC_EXP", "ANDROID_VR (TEST A: No VisitorData): FAILED - \")
                        }

                        try {
                            val res = resolver.resolve(videoId, visitorData, ClientStrategy.ANDROID_VR, token)
                            Log.e("AURA_POC_EXP", "ANDROID_VR (TEST D: Local VisitorData + PoToken): SUCCESS - format: \")
                            if (successfulUrlToPlay == null) {
                                successfulUrlToPlay = res.url
                                successfulVideoId = videoId
                            }
                        } catch(e: Exception) {
                            Log.e("AURA_POC_EXP", "ANDROID_VR (TEST D: Local VisitorData + PoToken): FAILED - \")
                        }
                    }
                }

                if (successfulUrlToPlay != null) {
                    Log.e("AURA_POC_EXP", "=== STARTING MEDIA3 PLAYBACK FOR \ ===")
                    val tPrepare = System.currentTimeMillis()
                    
                    player?.release()
                    player = ExoPlayer.Builder(context).build()
                    val mediaItem = MediaItem.fromUri(successfulUrlToPlay!!)
                    player?.setMediaItem(mediaItem)
                    player?.prepare()
                    player?.play()
                    
                    Log.e("AURA_POC_EXP", "Media3 prepare() and play() called. T = \ms")
                    
                    player?.addListener(object : androidx.media3.common.Player.Listener {
                        override fun onPlaybackStateChanged(playbackState: Int) {
                            if (playbackState == androidx.media3.common.Player.STATE_READY) {
                                Log.e("AURA_POC_EXP", "Media3 STATE_READY! Audio should be playing now! T_total = \ms")
                            }
                        }
                        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                            Log.e("AURA_POC_EXP", "Media3 ERROR: \")
                        }
                    })
                } else {
                    Log.e("AURA_POC_EXP", "No successful direct URL obtained. Skipping Media3 playback.")
                }
                
                Log.e("AURA_POC_EXP", "=== PHASE 1B COMPLETE ===")
            }
        }
    }
}
"""
with open("android/app/src/main/java/com/anonymous/AuraMusic/poc/AuraPocModule.kt", "w") as f:
    f.write(content)
