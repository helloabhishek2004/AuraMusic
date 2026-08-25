package com.auramusic.core.botguard

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.atomic.AtomicReference

class VisitorDataManager {
    private val client = OkHttpClient()
    private val cachedVisitorData = AtomicReference<String?>(null)

    suspend fun getVisitorData(forceRefresh: Boolean = false): String? = withContext(Dispatchers.IO) {
        if (!forceRefresh) {
            val current = cachedVisitorData.get()
            if (current != null) return@withContext current
        }

        try {
            val request = Request.Builder()
                .url("https://www.youtube.com/")
                .header("User-Agent", "Mozilla/5.0")
                .build()
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: return@withContext null
            val regex = "\"visitorData\":\"(.*?)\"".toRegex()
            val match = regex.find(body)
            val visitorData = match?.groups?.get(1)?.value
            if (visitorData != null) {
                cachedVisitorData.set(visitorData)
            }
            visitorData
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun clearCache() {
        cachedVisitorData.set(null)
    }
}
