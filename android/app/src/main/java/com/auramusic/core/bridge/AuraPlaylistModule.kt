package com.auramusic.core.bridge

import com.auramusic.core.db.*
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject

class AuraPlaylistModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AuraPlaylistModule"

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val database by lazy { AuraDatabase.getInstance(reactApplicationContext) }
    private val playlistDao by lazy { database.playlistDao() }
    private val trackDao by lazy { database.trackDao() }

    @ReactMethod
    fun getPlaylists(promise: Promise) {
        scope.launch {
            try {
                val playlists = withContext(Dispatchers.IO) {
                    val entities = playlistDao.getAllPlaylists()
                    entities.map { entity ->
                        val trackDetails = playlistDao.getPlaylistTracksWithDetails(entity.id)
                        Pair(entity, trackDetails)
                    }
                }

                val array = Arguments.createArray()
                for ((entity, trackDetails) in playlists) {
                    val map = Arguments.createMap().apply {
                        putString("id", entity.id)
                        putString("name", entity.title)
                        putString("title", entity.title)
                        putString("description", entity.description ?: "")
                        putString("mood", entity.mood ?: "")
                        putString("coverArt", entity.coverArt ?: "")
                        putDouble("createdAt", entity.createdAt.toDouble())
                        putDouble("updatedAt", entity.updatedAt.toDouble())
                        putBoolean("pinned", entity.pinned)
                        putBoolean("liked", entity.liked)

                        val gradArray = Arguments.createArray().apply {
                            pushString(entity.gradientPrimary ?: "#bf5af2")
                            pushString(entity.gradientSecondary ?: "#6f2bbe")
                        }
                        putArray("gradientColors", gradArray)

                        val trackIds = Arguments.createArray()
                        val trackSnapshots = Arguments.createMap()

                        for (detail in trackDetails) {
                            trackIds.pushString(detail.crossRef.trackId)
                            val t = detail.track
                            if (t != null) {
                                val tMap = Arguments.createMap().apply {
                                    putString("id", t.id)
                                    putString("title", t.title)
                                    putString("artist", t.artist)
                                    putString("album", t.album ?: "")
                                    putInt("duration", t.duration)
                                    putString("art", t.artworkUrl ?: "")
                                    putString("artworkUrl", t.artworkUrl ?: "")
                                    putBoolean("isDownloaded", t.isDownloaded)
                                    putBoolean("isLocal", t.isDownloaded)
                                }
                                trackSnapshots.putMap(t.id, tMap)
                            }
                        }

                        putArray("trackIds", trackIds)
                        putMap("trackSnapshots", trackSnapshots)
                    }
                    array.pushMap(map)
                }

                promise.resolve(array)
            } catch (e: Exception) {
                promise.reject("GET_PLAYLISTS_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getPlaylist(playlistId: String, promise: Promise) {
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val entity = playlistDao.getPlaylistById(playlistId) ?: return@withContext null
                    val trackDetails = playlistDao.getPlaylistTracksWithDetails(playlistId)
                    Pair(entity, trackDetails)
                }

                if (result == null) {
                    promise.resolve(null)
                    return@launch
                }

                val (entity, trackDetails) = result
                val map = Arguments.createMap().apply {
                    putString("id", entity.id)
                    putString("name", entity.title)
                    putString("title", entity.title)
                    putString("description", entity.description ?: "")
                    putString("mood", entity.mood ?: "")
                    putString("coverArt", entity.coverArt ?: "")
                    putDouble("createdAt", entity.createdAt.toDouble())
                    putDouble("updatedAt", entity.updatedAt.toDouble())
                    putBoolean("pinned", entity.pinned)
                    putBoolean("liked", entity.liked)

                    val gradArray = Arguments.createArray().apply {
                        pushString(entity.gradientPrimary ?: "#bf5af2")
                        pushString(entity.gradientSecondary ?: "#6f2bbe")
                    }
                    putArray("gradientColors", gradArray)

                    val trackIds = Arguments.createArray()
                    val trackSnapshots = Arguments.createMap()

                    for (detail in trackDetails) {
                        trackIds.pushString(detail.crossRef.trackId)
                        val t = detail.track
                        if (t != null) {
                            val tMap = Arguments.createMap().apply {
                                putString("id", t.id)
                                putString("title", t.title)
                                putString("artist", t.artist)
                                putString("album", t.album ?: "")
                                putInt("duration", t.duration)
                                putString("art", t.artworkUrl ?: "")
                                putString("artworkUrl", t.artworkUrl ?: "")
                                putBoolean("isDownloaded", t.isDownloaded)
                                putBoolean("isLocal", t.isDownloaded)
                            }
                            trackSnapshots.putMap(t.id, tMap)
                        }
                    }

                    putArray("trackIds", trackIds)
                    putMap("trackSnapshots", trackSnapshots)
                }

                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("GET_PLAYLIST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun createPlaylist(
        id: String,
        title: String,
        description: String?,
        mood: String?,
        coverArt: String?,
        gradientPrimary: String?,
        gradientSecondary: String?,
        promise: Promise
    ) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val entity = PlaylistEntity(
                        id = id,
                        title = title,
                        description = description,
                        mood = mood,
                        coverArt = coverArt,
                        gradientPrimary = gradientPrimary,
                        gradientSecondary = gradientSecondary
                    )
                    playlistDao.upsertPlaylist(entity)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CREATE_PLAYLIST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun renamePlaylist(playlistId: String, newName: String, promise: Promise) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    playlistDao.renamePlaylist(playlistId, newName)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("RENAME_PLAYLIST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun deletePlaylist(playlistId: String, promise: Promise) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    playlistDao.deletePlaylist(playlistId)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DELETE_PLAYLIST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun addTrack(playlistId: String, trackMap: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val trackId = trackMap.getString("id") ?: throw IllegalArgumentException("Track id is required")
                val title = trackMap.getString("title") ?: "Unknown Title"
                val artist = trackMap.getString("artist") ?: "Unknown Artist"
                val album = if (trackMap.hasKey("album")) trackMap.getString("album") else null
                val duration = if (trackMap.hasKey("duration")) {
                    val rawDur = trackMap.getDouble("duration")
                    if (rawDur > 1000) (rawDur / 1000).toInt() else rawDur.toInt()
                } else 0
                val artworkUrl = if (trackMap.hasKey("artworkUrl")) {
                    trackMap.getString("artworkUrl")
                } else if (trackMap.hasKey("art")) {
                    trackMap.getString("art")
                } else null

                val track = TrackEntity(
                    id = trackId,
                    title = title,
                    artist = artist,
                    album = album,
                    duration = duration,
                    artworkUrl = artworkUrl
                )

                val added = withContext(Dispatchers.IO) {
                    playlistDao.addTrackWithSnapshot(trackDao, track, playlistId)
                }

                promise.resolve(added)
            } catch (e: Exception) {
                promise.reject("ADD_TRACK_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun addTracks(playlistId: String, tracksArray: ReadableArray, promise: Promise) {
        scope.launch {
            try {
                val tracks = mutableListOf<TrackEntity>()
                for (i in 0 until tracksArray.size()) {
                    val trackMap = tracksArray.getMap(i) ?: continue
                    val trackId = trackMap.getString("id") ?: continue
                    val title = trackMap.getString("title") ?: "Unknown Title"
                    val artist = trackMap.getString("artist") ?: "Unknown Artist"
                    val album = if (trackMap.hasKey("album")) trackMap.getString("album") else null
                    val duration = if (trackMap.hasKey("duration")) {
                        val rawDur = trackMap.getDouble("duration")
                        if (rawDur > 1000) (rawDur / 1000).toInt() else rawDur.toInt()
                    } else 0
                    val artworkUrl = if (trackMap.hasKey("artworkUrl")) {
                        trackMap.getString("artworkUrl")
                    } else if (trackMap.hasKey("art")) {
                        trackMap.getString("art")
                    } else null

                    tracks.add(
                        TrackEntity(
                            id = trackId,
                            title = title,
                            artist = artist,
                            album = album,
                            duration = duration,
                            artworkUrl = artworkUrl
                        )
                    )
                }

                val count = withContext(Dispatchers.IO) {
                    playlistDao.addTracksWithSnapshots(trackDao, tracks, playlistId)
                }

                promise.resolve(count)
            } catch (e: Exception) {
                promise.reject("ADD_TRACKS_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun removeTrack(playlistId: String, trackId: String, promise: Promise) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    playlistDao.removeTrack(playlistId, trackId)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("REMOVE_TRACK_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun reorderTracks(playlistId: String, trackIdsArray: ReadableArray, promise: Promise) {
        scope.launch {
            try {
                val trackIds = mutableListOf<String>()
                for (i in 0 until trackIdsArray.size()) {
                    val tid = trackIdsArray.getString(i)
                    if (tid != null) {
                        trackIds.add(tid)
                    }
                }

                withContext(Dispatchers.IO) {
                    playlistDao.reorderTracks(playlistId, trackIds)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("REORDER_TRACKS_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun clearPlaylist(playlistId: String, promise: Promise) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    playlistDao.clearPlaylistTracks(playlistId)
                    playlistDao.touchPlaylist(playlistId)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CLEAR_PLAYLIST_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun syncPlaylistsFromJs(playlistsJson: String, promise: Promise) {
        scope.launch {
            try {
                var importedCount = 0
                withContext(Dispatchers.IO) {
                    val root = JSONObject(playlistsJson)
                    val keys = root.keys()
                    while (keys.hasNext()) {
                        val playlistId = keys.next()
                        val plObj = root.optJSONObject(playlistId) ?: continue

                        val existing = playlistDao.getPlaylistById(playlistId)
                        if (existing == null) {
                            val title = plObj.optString("name", plObj.optString("title", "My Playlist"))
                            val desc = plObj.optString("description", "")
                            val mood = plObj.optString("mood", "")
                            val coverArt = plObj.optString("coverArt", "")
                            val createdAt = plObj.optLong("createdAt", System.currentTimeMillis())
                            val updatedAt = plObj.optLong("updatedAt", System.currentTimeMillis())
                            val pinned = plObj.optBoolean("pinned", false)
                            val liked = plObj.optBoolean("liked", false)
                            
                            val gradArr = plObj.optJSONArray("gradientColors")
                            val gradPrimary = if (gradArr != null && gradArr.length() > 0) gradArr.optString(0) else null
                            val gradSecondary = if (gradArr != null && gradArr.length() > 1) gradArr.optString(1) else null

                            val entity = PlaylistEntity(
                                id = playlistId,
                                title = title,
                                description = desc.ifEmpty { null },
                                mood = mood.ifEmpty { null },
                                coverArt = coverArt.ifEmpty { null },
                                createdAt = createdAt,
                                updatedAt = updatedAt,
                                pinned = pinned,
                                liked = liked,
                                gradientPrimary = gradPrimary,
                                gradientSecondary = gradSecondary
                            )
                            playlistDao.upsertPlaylist(entity)

                            val trackSnapshots = plObj.optJSONObject("trackSnapshots")
                            val trackIds = plObj.optJSONArray("trackIds")

                            if (trackIds != null) {
                                val tracksToInsert = mutableListOf<TrackEntity>()
                                val crossRefs = mutableListOf<PlaylistTrackCrossRef>()

                                for (i in 0 until trackIds.length()) {
                                    val tid = trackIds.optString(i) ?: continue
                                    val tObj = trackSnapshots?.optJSONObject(tid)
                                    val tTitle = tObj?.optString("title", "Unknown Title") ?: "Unknown Title"
                                    val tArtist = tObj?.optString("artist", "Unknown Artist") ?: "Unknown Artist"
                                    val tAlbumStr = tObj?.optString("album", "")
                                    val tAlbum = if (tAlbumStr != null && tAlbumStr.isNotEmpty()) tAlbumStr else null
                                    val tDuration = tObj?.optInt("duration", 0) ?: 0
                                    val tArt = if (tObj != null) {
                                        val a = tObj.optString("art", "")
                                        if (a.isNotEmpty()) a else tObj.optString("artworkUrl", "")
                                    } else ""

                                    val tEntity = TrackEntity(
                                        id = tid,
                                        title = tTitle,
                                        artist = tArtist,
                                        album = tAlbum,
                                        duration = tDuration,
                                        artworkUrl = if (tArt.isNotEmpty()) tArt else null
                                    )
                                    trackDao.upsert(tEntity)
                                    crossRefs.add(PlaylistTrackCrossRef(playlistId, tid, i))
                                }

                                if (crossRefs.isNotEmpty()) {
                                    playlistDao.insertPlaylistTracks(crossRefs)
                                }
                            }
                            importedCount++
                        }
                    }
                }
                promise.resolve(importedCount)
            } catch (e: Exception) {
                promise.reject("SYNC_PLAYLISTS_ERROR", e.message, e)
            }
        }
    }
}
