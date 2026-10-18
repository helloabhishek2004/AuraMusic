package com.auramusic.core.lyrics.parser

import com.auramusic.core.lyrics.models.LyricsLine
import java.util.regex.Pattern

object LyricsParser {
    // Matches [mm:ss.xx] or [mm:ss.xxx] timestamps
    private val TIMESTAMP_REGEX = Regex("""\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]""")
    
    // Metadata tags like [ar:Adele], [ti:Skyfall], [al:...], [by:...], [offset:0]
    private val METADATA_TAG_REGEX = Regex("""^\[(ar|ti|al|by|offset|re|ve|length):.*\]$""", RegexOption.IGNORE_CASE)


    /**
     * Parses raw lyrics string (LRC format or plain text) into a list of LyricsLine.
     */
    fun parse(raw: String): Pair<Boolean, List<LyricsLine>> {
        if (raw.isBlank()) return Pair(false, emptyList())

        val lines = raw.lines()
        val parsedLines = mutableListOf<LyricsLine>()
        var isSynced = false

        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.isEmpty()) continue

            // Skip ID3 / LRC metadata tags
            if (METADATA_TAG_REGEX.matches(trimmed)) {
                continue
            }

            val matches = TIMESTAMP_REGEX.findAll(trimmed).toList()
            val timestamps = mutableListOf<Long>()
            var lastMatchEnd = 0

            for (match in matches) {
                val minStr = match.groupValues.getOrNull(1) ?: "0"
                val secStr = match.groupValues.getOrNull(2) ?: "0"
                val fracStr = match.groupValues.getOrNull(3) ?: "0"

                try {
                    val minutes = minStr.toLong()
                    val seconds = secStr.toLong()
                    val ms = when (fracStr.length) {
                        1 -> fracStr.toLong() * 100
                        2 -> fracStr.toLong() * 10
                        3 -> fracStr.toLong()
                        else -> 0L
                    }
                    val totalMs = (minutes * 60 + seconds) * 1000 + ms
                    timestamps.add(totalMs)
                    lastMatchEnd = match.range.last + 1
                    isSynced = true
                } catch (_: Exception) {}
            }

            if (timestamps.isNotEmpty()) {
                val lyricText = trimmed.substring(lastMatchEnd).trim()
                for (ts in timestamps) {
                    parsedLines.add(LyricsLine(time = ts, text = lyricText))
                }
            } else {
                // Plain line without timestamps
                parsedLines.add(LyricsLine(time = 0L, text = trimmed))
            }
        }

        if (isSynced) {
            // Sort by time ascending
            parsedLines.sortBy { it.time }
        }

        return Pair(isSynced, parsedLines)
    }
}
