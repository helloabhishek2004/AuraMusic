package com.auramusic.core.lyrics.provider

import android.net.Uri
import android.util.Base64
import android.util.Log
import com.auramusic.core.lyrics.models.LyricsResult
import com.auramusic.core.lyrics.parser.LyricsParser
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class KuGouLyricsProvider(
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(6, TimeUnit.SECONDS)
        .build()
) : LyricsProvider {

    override val name: String = "KuGou"
    private val TAG = "Lyrics"

    override suspend fun getLyrics(
        trackId: String,
        title: String,
        artist: String,
        durationSeconds: Int,
        album: String?
    ): LyricsResult? {
        Log.i(TAG, "[Lyrics] provider=KuGou fallback search title='$title' artist='$artist'")

        try {
            val keyword = "$artist - $title"
            val searchUri = Uri.parse("https://lyrics.kugou.com/search").buildUpon()
                .appendQueryParameter("ver", "1")
                .appendQueryParameter("man", "yes")
                .appendQueryParameter("client", "pc")
                .appendQueryParameter("keyword", keyword)
            if (durationSeconds > 0) {
                searchUri.appendQueryParameter("duration", (durationSeconds * 1000).toString())
            }

            val searchRequest = Request.Builder()
                .url(searchUri.build().toString())
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                .get()
                .build()

            val candidate = httpClient.newCall(searchRequest).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body?.string() ?: return null
                val obj = JSONObject(body)
                val candidates = obj.optJSONArray("candidates") ?: return null
                if (candidates.length() == 0) return null

                // Pick first candidate
                val first = candidates.getJSONObject(0)
                val id = first.optLong("id", 0L)
                val accessKey = first.optString("accesskey", "")
                if (id == 0L || accessKey.isEmpty()) return null
                Pair(id, accessKey)
            } ?: return null

            // Download LRC
            val downloadUri = Uri.parse("https://lyrics.kugou.com/download").buildUpon()
                .appendQueryParameter("ver", "1")
                .appendQueryParameter("client", "pc")
                .appendQueryParameter("fmt", "lrc")
                .appendQueryParameter("charset", "utf8")
                .appendQueryParameter("id", candidate.first.toString())
                .appendQueryParameter("accesskey", candidate.second)
                .build()

            val downloadRequest = Request.Builder()
                .url(downloadUri.toString())
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                .get()
                .build()

            httpClient.newCall(downloadRequest).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body?.string() ?: return null
                val obj = JSONObject(body)
                val b64Content = obj.optString("content", "")
                if (b64Content.isEmpty()) return null

                val rawLyrics = String(Base64.decode(b64Content, Base64.DEFAULT), Charsets.UTF_8)
                val (isSynced, lines) = LyricsParser.parse(rawLyrics)

                if (lines.isNotEmpty()) {
                    Log.i(TAG, "[Lyrics] provider=KuGou match found synced=$isSynced lines=${lines.size}")
                    return LyricsResult(
                        trackId = trackId,
                        title = title,
                        artist = artist,
                        synced = isSynced,
                        confidence = 0.8,
                        lyrics = lines,
                        rawLyrics = rawLyrics,
                        source = name
                    )
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[Lyrics] KuGou error: ${e.message}")
        }

        return null
    }
}
