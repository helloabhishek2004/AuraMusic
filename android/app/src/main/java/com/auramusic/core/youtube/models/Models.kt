package com.auramusic.core.youtube.models

data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val album: String?,
    val duration: Int,
    val artworkUrl: String?
)

data class SearchResult(
    val tracks: List<Track>
)
