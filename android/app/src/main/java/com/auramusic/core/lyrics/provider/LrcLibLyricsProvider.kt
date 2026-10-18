package com.auramusic.core.lyrics.provider

import android.net.Uri
import android.util.Log
import com.auramusic.core.lyrics.models.LyricsResult
import com.auramusic.core.lyrics.parser.LyricsParser
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class LrcLibLyricsProvider(
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()
) : LyricsProvider {

    override val name: String = "LRCLIB"
    private val TAG = "Lyrics"

    private val titleCleanupPatterns = listOf(
        Regex("""\s*\(.*?(official|video|audio|lyrics|lyric|visualizer|hd|hq|4k|remaster|remastered|extended|radio|clean|explicit).*?\)""", RegexOption.IGNORE_CASE),
        Regex("""\s*\[.*?(official|video|audio|lyrics|lyric|visualizer|hd|hq|4k|remaster|remastered|extended|radio|clean|explicit).*?\]""", RegexOption.IGNORE_CASE),
        Regex("""\s*【.*?】"""),
        Regex("""\s*\|.*$"""),
        Regex("""\s*-\s*(official|video|audio|lyrics|lyric|visualizer).*$""", RegexOption.IGNORE_CASE),
        Regex("""\s*\(feat\..*?\)""", RegexOption.IGNORE_CASE),
        Regex("""\s*\(ft\..*?\)""", RegexOption.IGNORE_CASE),
        Regex("""\s*feat\..*$""", RegexOption.IGNORE_CASE),
        Regex("""\s*ft\..*$""", RegexOption.IGNORE_CASE)
    )

    private val artistSeparators = listOf(" & ", " and ", ", ", " x ", " X ", " feat. ", " feat ", " ft. ", " ft ", " featuring ", " with ")

    private fun cleanTitle(title: String): String {
        var cleaned = title.trim()
        for (pattern in titleCleanupPatterns) {
            cleaned = cleaned.replace(pattern, "")
        }
        return cleaned.trim()
    }

    private fun cleanArtist(artist: String): String {
        var cleaned = artist.trim()
        for (sep in artistSeparators) {
            if (cleaned.contains(sep, ignoreCase = true)) {
                cleaned = cleaned.split(sep, ignoreCase = true, limit = 2)[0]
                break
            }
        }
        return cleaned.trim()
    }

    override suspend fun getLyrics(
        trackId: String,
        title: String,
        artist: String,
        durationSeconds: Int,
        album: String?
    ): LyricsResult? {
        val cleanedTitle = cleanTitle(title)
        val cleanedArtist = cleanArtist(artist)

        Log.i(TAG, "[Lyrics] provider=LRCLIB search title='$cleanedTitle' artist='$cleanedArtist' duration=${durationSeconds}s")

        // 1. Direct GET exact lookup
        try {
            val getUriBuilder = Uri.parse("https://lrclib.net/api/get").buildUpon()
                .appendQueryParameter("track_name", cleanedTitle)
                .appendQueryParameter("artist_name", cleanedArtist)
            if (durationSeconds > 0) {
                getUriBuilder.appendQueryParameter("duration", durationSeconds.toString())
            }
            if (!album.isNullOrBlank()) {
                getUriBuilder.appendQueryParameter("album_name", album)
            }

            val request = Request.Builder()
                .url(getUriBuilder.build().toString())
                .header("User-Agent", "AuraMusic/1.0 (Android; native on-device)")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (!body.isNullOrBlank()) {
                        val obj = JSONObject(body)
                        val synced = obj.optString("syncedLyrics", "").trim()
                        val plain = obj.optString("plainLyrics", "").trim()
                        val raw = if (synced.isNotEmpty()) synced else plain

                        if (raw.isNotEmpty()) {
                            val (isSynced, lines) = LyricsParser.parse(raw)
                            Log.i(TAG, "[Lyrics] provider=LRCLIB exact match found synced=$isSynced lines=${lines.size}")
                            return LyricsResult(
                                trackId = trackId,
                                title = obj.optString("trackName", title),
                                artist = obj.optString("artistName", artist),
                                synced = isSynced,
                                confidence = 1.0,
                                lyrics = lines,
                                rawLyrics = raw,
                                source = name
                            )
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[Lyrics] LRCLIB /api/get error: ${e.message}")
        }

        // 2. Fallback to /api/search with fuzzy scoring
        try {
            val searchUri = Uri.parse("https://lrclib.net/api/search").buildUpon()
                .appendQueryParameter("track_name", cleanedTitle)
                .appendQueryParameter("artist_name", cleanedArtist)
                .build()

            val request = Request.Builder()
                .url(searchUri.toString())
                .header("User-Agent", "AuraMusic/1.0 (Android; native on-device)")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body?.string() ?: return null
                val arr = JSONArray(body)
                if (arr.length() == 0) return null

                Log.i(TAG, "[Lyrics] provider=LRCLIB candidate count=${arr.length()}")

                var bestObj: JSONObject? = null
                var bestConfidence = 0.0

                for (i in 0 until arr.length()) {
                    val candidate = arr.getJSONObject(i)
                    val candTrack = candidate.optString("trackName", "")
                    val candArtist = candidate.optString("artistName", "")
                    val candDuration = candidate.optDouble("duration", 0.0).toInt()
                    val synced = candidate.optString("syncedLyrics", "").trim()
                    val plain = candidate.optString("plainLyrics", "").trim()
                    if (synced.isEmpty() && plain.isEmpty()) continue

                    val confidence = calculateConfidence(
                        targetTitle = cleanedTitle,
                        targetArtist = cleanedArtist,
                        targetDuration = durationSeconds,
                        candTitle = candTrack,
                        candArtist = candArtist,
                        candDuration = candDuration,
                        hasSynced = synced.isNotEmpty()
                    )

                    if (confidence > bestConfidence) {
                        bestConfidence = confidence
                        bestObj = candidate
                    }
                }

                Log.i(TAG, "[Lyrics] provider=LRCLIB best match confidence=$bestConfidence")

                if (bestObj != null && bestConfidence >= 0.45) {
                    val synced = bestObj.optString("syncedLyrics", "").trim()
                    val plain = bestObj.optString("plainLyrics", "").trim()
                    val raw = if (synced.isNotEmpty()) synced else plain
                    val (isSynced, lines) = LyricsParser.parse(raw)

                    return LyricsResult(
                        trackId = trackId,
                        title = bestObj.optString("trackName", title),
                        artist = bestObj.optString("artistName", artist),
                        synced = isSynced,
                        confidence = bestConfidence,
                        lyrics = lines,
                        rawLyrics = raw,
                        source = name
                    )
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[Lyrics] LRCLIB /api/search error: ${e.message}")
        }

        return null
    }

    private fun calculateConfidence(
        targetTitle: String,
        targetArtist: String,
        targetDuration: Int,
        candTitle: String,
        candArtist: String,
        candDuration: Int,
        hasSynced: Boolean
    ): Double {
        val titleSim = stringSimilarity(targetTitle, candTitle)
        val artistSim = stringSimilarity(targetArtist, candArtist)

        if (titleSim < 0.4 || artistSim < 0.4) {
            return 0.0
        }

        var score = (titleSim * 0.5) + (artistSim * 0.3)
        if (hasSynced) score += 0.1

        if (targetDuration > 0 && candDuration > 0) {
            val diff = abs(targetDuration - candDuration)
            if (diff <= 3) score += 0.1
            else if (diff <= 7) score += 0.05
            else if (diff > 20) score -= 0.15
        }

        return score.coerceIn(0.0, 1.0)
    }

    private fun stringSimilarity(s1: String, s2: String): Double {
        val a = s1.trim().lowercase()
        val b = s2.trim().lowercase()
        if (a == b) return 1.0
        if (a.isEmpty() || b.isEmpty()) return 0.0
        if (a.contains(b) || b.contains(a)) return 0.85

        val maxLen = maxOf(a.length, b.length)
        val dist = levenshtein(a, b)
        return (1.0 - (dist.toDouble() / maxLen)).coerceAtLeast(0.0)
    }

    private fun levenshtein(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j
        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = minOf(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                )
            }
        }
        return dp[s1.length][s2.length]
    }
}
