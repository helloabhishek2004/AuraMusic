package com.anonymous.AuraMusic.poc

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AuraPocModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraPoc"
    @ReactMethod fun testPlay(videoId: String, promise: Promise) {}
    @ReactMethod fun stop() {}

    companion object {
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
                val regex = "\"visitorData\":\"(.*?)\"".toRegex()
                val match = regex.find(body)
                val visitorData = match?.groups?.get(1)?.value
                Log.e("AURA_POC_EXP", "VisitorData fetch took ${System.currentTimeMillis() - t0}ms: $visitorData")
                visitorData
            } catch (e: Exception) {
                Log.e("AURA_POC_EXP", "VisitorData fetch failed: ${e.message}")
                null
            }
        }

        fun testPlayNative(context: Context) {
            val videoIds = listOf(
                "OPf0YbXqDm0" // Uptown Funk
            )
            
            CoroutineScope(Dispatchers.Main).launch {
                Log.e("AURA_POC_EXP", "=== STARTING FULL PLAYBACK TEST ===")
                
                val visitorData = fetchVisitorData()
                if (visitorData == null) return@launch

                val resolver = StreamResolver()
                val exp = PoTokenExperiment(context)
                
                val vToken = exp.run("OPf0YbXqDm0")
                
                try {
                    val res = resolver.resolve("OPf0YbXqDm0", visitorData, ClientStrategy.ANDROID_VR, vToken, signatureTimestamp = 20684)
                    Log.e("AURA_POC_EXP", "ANDROID_VR: SUCCESS! URL=${res.url}")
                    
                    if (res.url != null) {
                        Log.e("AURA_POC_EXP", "Handing off to Media3PlaybackManager...")
                        Media3PlaybackManager(context).playAudio(res.url)
                    }
                } catch(e: Exception) {
                    Log.e("AURA_POC_EXP", "ANDROID_VR: FAILED - ${e.message}")
                }
                Log.e("AURA_POC_EXP", "=== FULL PLAYBACK TEST COMPLETE ===")
            }
        }
    }
}

