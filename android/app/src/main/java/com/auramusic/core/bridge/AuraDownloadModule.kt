package com.auramusic.core.bridge

import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import com.auramusic.core.db.AuraDatabase
import com.auramusic.core.db.TrackEntity
import com.auramusic.core.download.DownloadUtil
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

private const val TAG = "AuraDownloadModule"

@OptIn(UnstableApi::class)
class AuraDownloadModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    DownloadUtil.DownloadProgressListener {

    override fun getName() = "AuraDownloadModule"

    private val downloadUtil by lazy { DownloadUtil.getInstance(reactContext) }
    private val database by lazy { AuraDatabase.getInstance(reactContext) }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun initialize() {
        super.initialize()
        downloadUtil.addListener(this)
    }

    override fun invalidate() {
        super.invalidate()
        downloadUtil.removeListener(this)
        scope.cancel()
    }

    override fun onDownloadProgress(
        trackId: String,
        bytesDownloaded: Long,
        totalBytes: Long,
        percentage: Float
    ) {
        val params = Arguments.createMap().apply {
            putString("trackId", trackId)
            putDouble("bytesDownloaded", bytesDownloaded.toDouble())
            putDouble("totalBytes", totalBytes.toDouble())
            putDouble("percentage", percentage.toDouble())
        }
        sendEvent("onDownloadProgress", params)
    }

    override fun onDownloadStateChanged(trackId: String, state: Int, error: String?) {
        val stateName = when (state) {
            Download.STATE_QUEUED -> "QUEUED"
            Download.STATE_STOPPED -> "PAUSED"
            Download.STATE_DOWNLOADING -> "DOWNLOADING"
            Download.STATE_COMPLETED -> "COMPLETED"
            Download.STATE_FAILED -> "FAILED"
            Download.STATE_REMOVING -> "REMOVING"
            Download.STATE_RESTARTING -> "RESTARTING"
            else -> "UNKNOWN"
        }

        scope.launch(Dispatchers.IO) {
            val trackEntity = if (state == Download.STATE_COMPLETED) {
                try {
                    database.trackDao().getById(trackId)
                } catch (_: Exception) {
                    null
                }
            } else null

            val params = Arguments.createMap().apply {
                putString("trackId", trackId)
                putInt("state", state)
                putString("stateName", stateName)
                putBoolean("isDownloaded", state == Download.STATE_COMPLETED)
                if (error != null) {
                    putString("error", error)
                }
                trackEntity?.let { t ->
                    putString("title", t.title)
                    putString("artist", t.artist)
                    putString("album", t.album)
                    putString("albumId", t.albumId)
                    putString("artistId", t.artistId)
                    putInt("duration", t.duration)
                    val localFile = downloadUtil.getLocalArtworkFile(t.id)
                    val resolvedArtworkUrl = if (localFile != null) {
                        "file://${localFile.absolutePath}"
                    } else {
                        t.artworkUrl
                    }
                    putString("artworkUrl", resolvedArtworkUrl)
                    putDouble("contentLength", (t.contentLength ?: 0L).toDouble())
                }
            }
            sendEvent("onDownloadStateChanged", params)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (!reactContext.hasActiveReactInstance()) return
        mainHandler.post {
            try {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit(eventName, params)
            } catch (e: Exception) {
                Log.w(TAG, "Error emitting event $eventName: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun startDownload(trackMap: ReadableMap, promise: Promise) {
        try {
            val id = try {
                if (trackMap.hasKey("id") && trackMap.getType("id") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("id")
                } else if (trackMap.hasKey("trackId") && trackMap.getType("trackId") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("trackId")
                } else {
                    null
                }
            } catch (_: Exception) { null } ?: run {
                promise.reject("INVALID_ARGS", "Track must have an 'id' or 'trackId'")
                return
            }

            val title = try {
                if (trackMap.hasKey("title") && trackMap.getType("title") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("title") ?: "Unknown Title"
                } else "Unknown Title"
            } catch (_: Exception) { "Unknown Title" }

            val artist = try {
                if (trackMap.hasKey("artist") && trackMap.getType("artist") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("artist") ?: "Unknown Artist"
                } else "Unknown Artist"
            } catch (_: Exception) { "Unknown Artist" }

            val album = try {
                if (trackMap.hasKey("album") && trackMap.getType("album") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("album")
                } else null
            } catch (_: Exception) { null }

            val duration = try {
                if (trackMap.hasKey("duration")) {
                    when (trackMap.getType("duration")) {
                        com.facebook.react.bridge.ReadableType.Number -> trackMap.getInt("duration")
                        com.facebook.react.bridge.ReadableType.String -> {
                            val str = trackMap.getString("duration") ?: "0"
                            if (str.contains(":")) {
                                val parts = str.split(":")
                                if (parts.size == 2) {
                                    (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0)
                                } else {
                                    0
                                }
                            } else {
                                str.toDoubleOrNull()?.toInt() ?: 0
                            }
                        }
                        else -> 0
                    }
                } else 0
            } catch (_: Exception) { 0 }

            val artworkUrl = try {
                if (trackMap.hasKey("artworkUrl") && trackMap.getType("artworkUrl") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("artworkUrl")
                } else if (trackMap.hasKey("artwork") && trackMap.getType("artwork") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("artwork")
                } else if (trackMap.hasKey("art") && trackMap.getType("art") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("art")
                } else {
                    null
                }
            } catch (_: Exception) { null }

            val albumId = try {
                if (trackMap.hasKey("albumId") && trackMap.getType("albumId") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("albumId")
                } else null
            } catch (_: Exception) { null }

            val artistId = try {
                if (trackMap.hasKey("artistId") && trackMap.getType("artistId") == com.facebook.react.bridge.ReadableType.String) {
                    trackMap.getString("artistId")
                } else null
            } catch (_: Exception) { null }

            val track = TrackEntity(
                id = id,
                title = title,
                artist = artist,
                album = album,
                duration = duration,
                artworkUrl = artworkUrl,
                albumId = albumId,
                artistId = artistId
            )

            downloadUtil.startDownload(track)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting download: ${e.message}", e)
            promise.reject("DOWNLOAD_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun removeDownload(trackId: String, promise: Promise) {
        try {
            downloadUtil.removeDownload(trackId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REMOVE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun pauseDownload(trackId: String, promise: Promise) {
        try {
            downloadUtil.pauseDownload(trackId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun resumeDownload(trackId: String, promise: Promise) {
        try {
            downloadUtil.resumeDownload(trackId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESUME_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getDownloadState(trackId: String, promise: Promise) {
        try {
            val download = downloadUtil.getDownload(trackId)
            val map = Arguments.createMap().apply {
                putString("trackId", trackId)
                if (download != null) {
                    putInt("state", download.state)
                    val stateName = when (download.state) {
                        Download.STATE_QUEUED -> "QUEUED"
                        Download.STATE_STOPPED -> "PAUSED"
                        Download.STATE_DOWNLOADING -> "DOWNLOADING"
                        Download.STATE_COMPLETED -> "COMPLETED"
                        Download.STATE_FAILED -> "FAILED"
                        Download.STATE_REMOVING -> "REMOVING"
                        Download.STATE_RESTARTING -> "RESTARTING"
                        else -> "UNKNOWN"
                    }
                    putString("stateName", stateName)
                    putBoolean("isDownloaded", download.state == Download.STATE_COMPLETED)
                    putDouble("bytesDownloaded", download.bytesDownloaded.toDouble())
                    putDouble("contentLength", download.contentLength.toDouble())
                    val percent = if (download.percentDownloaded != androidx.media3.common.C.PERCENTAGE_UNSET.toFloat()) {
                        download.percentDownloaded
                    } else if (download.contentLength > 0) {
                        (download.bytesDownloaded * 100f / download.contentLength).coerceIn(0f, 100f)
                    } else {
                        0f
                    }
                    putDouble("percentage", percent.toDouble())
                } else {
                    putInt("state", -1)
                    putString("stateName", "NOT_DOWNLOADED")
                    putBoolean("isDownloaded", false)
                    putDouble("bytesDownloaded", 0.0)
                    putDouble("contentLength", 0.0)
                    putDouble("percentage", 0.0)
                }
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_STATE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isTrackDownloaded(trackId: String, promise: Promise) {
        try {
            promise.resolve(downloadUtil.isTrackDownloaded(trackId))
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getDownloadedTracks(promise: Promise) {
        scope.launch(Dispatchers.IO) {
            try {
                val tracks = database.trackDao().getDownloadedTracks()
                val array = Arguments.createArray()
                tracks.forEach { t ->
                    // == FIX #4c: Prefer local artwork file URI when available ==
                    // Room artworkUrl stores the original remote URL (not modified).
                    // We resolve the local file at runtime and override artworkUrl only
                    // in the JS payload — not in Room — preserving backward compatibility.
                    val localFile = downloadUtil.getLocalArtworkFile(t.id)
                    val resolvedArtworkUrl = if (localFile != null) {
                        // Local file exists and is non-empty — use file:// URI
                        "file://${localFile.absolutePath}"
                    } else {
                        // No local artwork (not yet downloaded, or artwork download failed)
                        // Fall back to remote URL — works when online, shows placeholder offline
                        t.artworkUrl
                    }
                    // == END FIX #4c ==
                    array.pushMap(Arguments.createMap().apply {
                        putString("id", t.id)
                        putString("title", t.title)
                        putString("artist", t.artist)
                        putString("album", t.album)
                        putString("albumId", t.albumId)
                        putString("artistId", t.artistId)
                        putInt("duration", t.duration)
                        putString("artworkUrl", resolvedArtworkUrl)
                        putBoolean("isDownloaded", t.isDownloaded)
                        putDouble("downloadedAt", (t.downloadedAt ?: 0L).toDouble())
                        putDouble("contentLength", (t.contentLength ?: 0L).toDouble())
                    })
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(array)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("GET_DOWNLOADED_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun reconcileDownloads(promise: Promise) {
        scope.launch(Dispatchers.IO) {
            try {
                val result = downloadUtil.reconcileDownloads()
                val map = Arguments.createMap().apply {
                    putInt("checkedCount", result.checkedCount)
                    putInt("repairedCount", result.repairedCount)
                    putInt("orphanedDownloadCount", result.orphanedDownloadCount)
                    val missingArray = Arguments.createArray()
                    result.missingTrackIds.forEach { missingArray.pushString(it) }
                    putArray("missingTrackIds", missingArray)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                android.util.Log.e("AuraRestore", "[AuraRestore] Failed to reconcile downloads", e)
                withContext(Dispatchers.Main) {
                    promise.reject("RECONCILE_DOWNLOADS_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun hydrateDownloads(promise: Promise) {
        scope.launch(Dispatchers.IO) {
            try {
                val hydrationManager = com.auramusic.core.download.DownloadHydrationManager.getInstance(reactContext)
                val report = hydrationManager.hydrateAll()
                val map = Arguments.createMap().apply {
                    putInt("totalChecked", report.totalChecked)
                    putInt("artworkHydrated", report.artworkHydrated)
                    putInt("metadataHydrated", report.metadataHydrated)
                    putInt("repairedTracks", report.repairedTracks)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to hydrate downloads: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    promise.reject("HYDRATE_DOWNLOADS_ERROR", e.message, e)
                }
            }
        }
    }

    private fun getFolderSize(dir: java.io.File): Long {
        if (!dir.exists()) return 0L
        var size = 0L
        try {
            val files = dir.listFiles() ?: return 0L
            for (f in files) {
                size += if (f.isDirectory) getFolderSize(f) else f.length()
            }
        } catch (_: Exception) {}
        return size
    }

    @ReactMethod
    fun getNativeStorageStats(promise: Promise) {
        scope.launch(Dispatchers.IO) {
            try {
                // 1. Download bytes from Media3 downloadCache / directory
                val downloadDir = java.io.File(reactContext.filesDir, "download")
                val downloadBytes = if (downloadDir.exists()) {
                    getFolderSize(downloadDir)
                } else {
                    downloadUtil.downloadCache.cacheSpace
                }

                // 2. Streaming cache from AuraPlayer mediaCache / directory
                val cacheDir = java.io.File(reactContext.cacheDir, "aura_media_cache")
                val cacheBytes = if (cacheDir.exists()) {
                    getFolderSize(cacheDir)
                } else {
                    com.auramusic.core.playback.AuraPlayer.getMediaCache(reactContext).cacheSpace
                }

                // 3. Database bytes (aura_music.db + wal + shm)
                var dbBytes = 0L
                val dbFile = reactContext.getDatabasePath("aura_music.db")
                if (dbFile.exists()) dbBytes += dbFile.length()
                val dbWal = java.io.File(dbFile.parentFile, "aura_music.db-wal")
                if (dbWal.exists()) dbBytes += dbWal.length()
                val dbShm = java.io.File(dbFile.parentFile, "aura_music.db-shm")
                if (dbShm.exists()) dbBytes += dbShm.length()

                // 4. Artwork / Image cache
                var artworkBytes = 0L
                val imgCache1 = java.io.File(reactContext.cacheDir, "image_cache")
                if (imgCache1.exists()) artworkBytes += getFolderSize(imgCache1)
                val expoImgCache = java.io.File(reactContext.cacheDir, "expo-image-cache")
                if (expoImgCache.exists()) artworkBytes += getFolderSize(expoImgCache)
                val legacyArtwork = java.io.File(reactContext.filesDir, "aura/artwork")
                if (legacyArtwork.exists()) artworkBytes += getFolderSize(legacyArtwork)

                // 5. AsyncStorage bytes
                var asyncStorageBytes = 0L
                val rkStorage = reactContext.getDatabasePath("RKStorage")
                if (rkStorage.exists()) asyncStorageBytes += rkStorage.length()
                val rkWal = java.io.File(rkStorage.parentFile, "RKStorage-wal")
                if (rkWal.exists()) asyncStorageBytes += rkWal.length()
                val rkShm = java.io.File(rkStorage.parentFile, "RKStorage-shm")
                if (rkShm.exists()) asyncStorageBytes += rkShm.length()

                val total = downloadBytes + cacheBytes + dbBytes + artworkBytes + asyncStorageBytes

                val map = Arguments.createMap().apply {
                    putDouble("downloadsBytes", downloadBytes.toDouble())
                    putDouble("songCacheBytes", cacheBytes.toDouble())
                    putDouble("databaseBytes", dbBytes.toDouble())
                    putDouble("artworkCacheBytes", artworkBytes.toDouble())
                    putDouble("asyncStorageBytes", asyncStorageBytes.toDouble())
                    putDouble("totalBytes", total.toDouble())
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("STORAGE_STATS_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun clearAllDownloads(promise: Promise) {
        scope.launch(Dispatchers.IO) {
            try {
                downloadUtil.downloadManager.removeAllDownloads()
                
                // Also remove physical files in download directory
                val downloadDir = java.io.File(reactContext.filesDir, "download")
                var deletedBytes = 0L
                if (downloadDir.exists()) {
                    deletedBytes = getFolderSize(downloadDir)
                    downloadDir.listFiles()?.forEach { file ->
                        if (file.name != "exoplayer_internal.db" && !file.name.startsWith("exoplayer_internal.db")) {
                            file.deleteRecursively()
                        }
                    }
                }
                
                // Update Room database
                database.trackDao().clearAllDownloads()

                withContext(Dispatchers.Main) {
                    val result = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putDouble("deletedBytes", deletedBytes.toDouble())
                    }
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("CLEAR_DOWNLOADS_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun setWifiOnly(wifiOnly: Boolean, promise: Promise) {
        try {
            downloadUtil.setWifiOnly(wifiOnly)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_WIFI_ONLY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setDownloadQuality(quality: String, promise: Promise) {
        try {
            downloadUtil.setDownloadQuality(quality)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_DOWNLOAD_QUALITY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for React Native built-in EventEmitter calls
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for React Native built-in EventEmitter calls
    }
}
