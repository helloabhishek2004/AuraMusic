package com.auramusic.core.backup

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import androidx.room.withTransaction
import com.auramusic.core.db.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.*

private const val TAG = "LocalBackupManager"
private const val APP_DOCS_SUBDIR = "AuraMusic"
private const val BACKUP_FILE_NAME = "backup.json"
private const val SCHEMA_VERSION = 1

data class BackupMetadata(
    val exists: Boolean,
    val schemaVersion: Int = 0,
    val exportedAt: String = "",
    val timestamp: Long = 0L,
    val appVersion: String = "",
    val songCount: Int = 0,
    val playlistCount: Int = 0,
    val historyCount: Int = 0,
    val hasSettings: Boolean = false,
    val fileSize: Long = 0L,
    val checksumValid: Boolean = false,
    val uriString: String? = null,
    val permissionRequired: Boolean = false
)

data class ImportResult(
    val success: Boolean,
    val message: String,
    val clientSettingsJson: String? = null,
    val permissionRequired: Boolean = false
)

class LocalBackupManager(private val context: Context) {

    private val contentResolver: ContentResolver get() = context.contentResolver
    private val database: AuraDatabase by lazy { AuraDatabase.getInstance(context) }

    /**
     * Compute SHA-256 hash of a string.
     */
    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Formats current time as ISO 8601 string.
     */
    private fun nowIso(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    /**
     * Resolves the app version safely.
     */
    private fun getAppVersion(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "3.1.0"
        } catch (_: Exception) {
            "3.1.0"
        }
    }

    /**
     * Scans for Documents/AuraMusic/backup.json using MediaStore on API 29+ or File on API < 29.
     * Returns BackupMetadata if found and readable, or empty metadata if not.
     */
    suspend fun checkForBackup(): BackupMetadata = withContext(Dispatchers.IO) {
        try {
            val docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
            val auraDir = File(docsDir, APP_DOCS_SUBDIR)
            val backupFile = File(auraDir, BACKUP_FILE_NAME)

            val inputStreamPair = openBackupInputStream()
            if (inputStreamPair == null) {
                if (backupFile.exists() && backupFile.length() > 0) {
                    Log.i(TAG, "[checkForBackup] Backup file exists at ${backupFile.absolutePath} but direct access requires permission.")
                    return@withContext BackupMetadata(
                        exists = true,
                        hasSettings = true,
                        fileSize = backupFile.length(),
                        permissionRequired = true,
                        uriString = backupFile.absolutePath
                    )
                }
                return@withContext BackupMetadata(exists = false)
            }

            val (inputStream, fileSize, uriString) = inputStreamPair
            val content = inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }

            if (content.isBlank()) {
                return@withContext BackupMetadata(exists = false)
            }

            val root = JSONObject(content)
            val schemaVersion = root.optInt("schemaVersion", 1)
            val exportedAt = root.optString("exportedAt", "")
            val appVersion = root.optString("appVersion", "")
            val declaredChecksum = root.optString("checksum", "")

            // Validate checksum over data string
            val dataObj = root.optJSONObject("data")
            val computedChecksum = if (dataObj != null) sha256(dataObj.toString()) else ""
            val checksumValid = declaredChecksum.isNotEmpty() && declaredChecksum == computedChecksum

            var songCount = 0
            var playlistCount = 0
            var historyCount = 0
            var hasSettings = false

            if (dataObj != null) {
                val likedSongs = dataObj.optJSONArray("likedSongs")
                val allTracks = dataObj.optJSONArray("tracks")
                songCount = likedSongs?.length() ?: allTracks?.length() ?: 0

                val playlists = dataObj.optJSONArray("playlists")
                playlistCount = playlists?.length() ?: 0

                val history = dataObj.optJSONArray("history")
                historyCount = history?.length() ?: 0

                hasSettings = dataObj.has("settings") || dataObj.has("userPreferences")
            }

            val timestamp = try {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                sdf.parse(exportedAt)?.time ?: 0L
            } catch (_: Exception) {
                0L
            }

            Log.i(TAG, "[checkForBackup] Found valid backup: songs=$songCount, playlists=$playlistCount, checksumValid=$checksumValid")

            BackupMetadata(
                exists = true,
                schemaVersion = schemaVersion,
                exportedAt = exportedAt,
                timestamp = timestamp,
                appVersion = appVersion,
                songCount = songCount,
                playlistCount = playlistCount,
                historyCount = historyCount,
                hasSettings = hasSettings,
                fileSize = fileSize,
                checksumValid = checksumValid,
                uriString = uriString,
                permissionRequired = false
            )
        } catch (e: Exception) {
            Log.w(TAG, "[checkForBackup] Error scanning for backup: ${e.message}")
            BackupMetadata(exists = false)
        }
    }

    /**
     * Opens an InputStream for backup.json from Scoped Storage / Documents.
     */
    private fun openBackupInputStream(): Triple<InputStream, Long, String>? {
        val docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
        val auraDir = File(docsDir, APP_DOCS_SUBDIR)
        val backupFile = File(auraDir, BACKUP_FILE_NAME)

        // Trigger media scan so MediaStore can discover externally placed / reinstalled files
        if (backupFile.exists()) {
            try {
                MediaScannerConnection.scanFile(context, arrayOf(backupFile.absolutePath), null, null)
            } catch (_: Exception) {}
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val projection = arrayOf(
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.RELATIVE_PATH
            )
            val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ?"
            val selectionArgs = arrayOf(BACKUP_FILE_NAME)

            val volumeUris = listOf(
                MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
                MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL)
            )

            for (queryUri in volumeUris) {
                try {
                    contentResolver.query(queryUri, projection, selection, selectionArgs, "${MediaStore.MediaColumns.DATE_MODIFIED} DESC")?.use { cursor ->
                        val relPathIdx = cursor.getColumnIndex(MediaStore.MediaColumns.RELATIVE_PATH)
                        while (cursor.moveToNext()) {
                            val relPath = if (relPathIdx >= 0) cursor.getString(relPathIdx) ?: "" else ""
                            if (relPath.contains(APP_DOCS_SUBDIR, ignoreCase = true) || relPath.contains("Documents", ignoreCase = true)) {
                                val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
                                val size = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE))
                                val fileUri = Uri.withAppendedPath(queryUri, id.toString())
                                try {
                                    val stream = contentResolver.openInputStream(fileUri)
                                    if (stream != null) {
                                        Log.i(TAG, "[openBackupInputStream] Opened backup via MediaStore URI: $fileUri")
                                        return Triple(stream, size, fileUri.toString())
                                    }
                                } catch (se: Exception) {
                                    Log.w(TAG, "[openBackupInputStream] MediaStore openInputStream failed for $fileUri: ${se.message}")
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "[openBackupInputStream] MediaStore query failed on $queryUri: ${e.message}")
                }
            }
        }

        // Direct File access (granted via MANAGE_EXTERNAL_STORAGE, API <= 29, or direct access)
        try {
            if (backupFile.exists() && backupFile.length() > 0) {
                val fis = FileInputStream(backupFile)
                Log.i(TAG, "[openBackupInputStream] Opened backup directly from file: ${backupFile.absolutePath}")
                return Triple(fis, backupFile.length(), backupFile.absolutePath)
            }
        } catch (e: Exception) {
            Log.w(TAG, "[openBackupInputStream] Direct file access denied: ${e.message}")
        }

        return null
    }

    /**
     * Exports Room DB and User Preferences to Documents/AuraMusic/backup.json
     * with atomic file writing and SHA-256 verification.
     */
    suspend fun exportBackup(clientSettingsJson: String? = null): BackupMetadata = withContext(Dispatchers.IO) {
        Log.i(TAG, "[exportBackup] Starting local scoped storage backup...")

        // 1. Gather all database entities (metadata only, no media binaries)
        val trackDao = database.trackDao()
        val playlistDao = database.playlistDao()
        val historyDao = database.historyDao()

        val tracks = trackDao.getAllTracks()
        val playlists = playlistDao.getAllPlaylists()
        val historyEntries = historyDao.getAllHistory()

        val tracksArray = JSONArray()
        val likedSongsArray = JSONArray()
        for (t in tracks) {
            val trackJson = JSONObject().apply {
                put("id", t.id)
                put("title", t.title)
                put("artist", t.artist)
                put("album", t.album ?: "")
                put("albumId", t.albumId ?: "")
                put("artistId", t.artistId ?: "")
                put("duration", t.duration)
                put("artworkUrl", t.artworkUrl ?: "")
                put("createdAt", t.createdAt)
                put("lastPlayedAt", t.lastPlayedAt ?: 0L)
                put("playCount", t.playCount)
                put("isDownloaded", false) // Never restore download state blindly
            }
            tracksArray.put(trackJson)
        }

        val playlistsArray = JSONArray()
        for (p in playlists) {
            val pJson = JSONObject().apply {
                put("id", p.id)
                put("title", p.title)
                put("description", p.description ?: "")
                put("mood", p.mood ?: "")
                put("coverArt", p.coverArt ?: "")
                put("createdAt", p.createdAt)
                put("updatedAt", p.updatedAt)
                put("pinned", p.pinned)
                put("liked", p.liked)
                put("gradientPrimary", p.gradientPrimary ?: "")
                put("gradientSecondary", p.gradientSecondary ?: "")

                val trackDetails = playlistDao.getPlaylistTracksWithDetails(p.id)
                val tracksInPlaylist = JSONArray()
                for (td in trackDetails) {
                    val cr = td.crossRef
                    val t = td.track
                    val ptJson = JSONObject().apply {
                        put("trackId", cr.trackId)
                        put("position", cr.position)
                        put("addedAt", cr.addedAt)
                        if (t != null) {
                            put("title", t.title)
                            put("artist", t.artist)
                            put("album", t.album ?: "")
                            put("artworkUrl", t.artworkUrl ?: "")
                            put("duration", t.duration)
                        }
                    }
                    tracksInPlaylist.put(ptJson)
                }
                put("tracks", tracksInPlaylist)
            }
            playlistsArray.put(pJson)
        }

        val historyArray = JSONArray()
        for (h in historyEntries) {
            val hJson = JSONObject().apply {
                put("id", h.id)
                put("trackId", h.trackId)
                put("timestamp", h.timestamp)
                put("listenDuration", h.listenDuration)
                put("completed", h.completed)
                put("skipped", h.skipped)
            }
            historyArray.put(hJson)
        }

        // SharedPreferences settings
        val prefs = context.getSharedPreferences("aura_player_prefs", Context.MODE_PRIVATE)
        val prefsJson = JSONObject()
        prefs.all.forEach { (k, v) ->
            if (v != null) prefsJson.put(k, v)
        }

        // Parse any additional client settings passed from React Native (e.g., Zustand store states)
        val mergedSettings = if (!clientSettingsJson.isNullOrBlank()) {
            try {
                val clientObj = JSONObject(clientSettingsJson)
                // Merge prefs
                val keys = clientObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    prefsJson.put(k, clientObj.get(k))
                }
                prefsJson
            } catch (_: Exception) {
                prefsJson
            }
        } else {
            prefsJson
        }

        val clientPayloadObj = if (!clientSettingsJson.isNullOrBlank()) {
            try { JSONObject(clientSettingsJson) } catch (_: Exception) { null }
        } else null

        // 2. Assemble Data Object
        val dataObject = JSONObject().apply {
            put("tracks", tracksArray)
            put("playlists", playlistsArray)
            put("history", historyArray)
            put("settings", mergedSettings)
            if (clientPayloadObj != null) {
                put("clientPayload", clientPayloadObj)
            }
        }

        val dataString = dataObject.toString()
        val checksum = sha256(dataString)
        val exportedAt = nowIso()
        val appVersion = getAppVersion()

        // 3. Assemble Root Payload
        val rootPayload = JSONObject().apply {
            put("schemaVersion", SCHEMA_VERSION)
            put("exportedAt", exportedAt)
            put("appVersion", appVersion)
            put("checksum", checksum)
            put("data", dataObject)
        }

        val fullPayloadString = rootPayload.toString(2)
        val payloadBytes = fullPayloadString.toByteArray(Charsets.UTF_8)

        // 4. Atomic Write to Documents/AuraMusic/backup.json
        writePayloadToDocuments(payloadBytes)

        Log.i(TAG, "[exportBackup] Backup export successful. Size: ${payloadBytes.size} bytes. Tracks: ${tracks.size}, Playlists: ${playlists.size}")

        BackupMetadata(
            exists = true,
            schemaVersion = SCHEMA_VERSION,
            exportedAt = exportedAt,
            timestamp = System.currentTimeMillis(),
            appVersion = appVersion,
            songCount = tracks.size,
            playlistCount = playlists.size,
            historyCount = historyEntries.size,
            hasSettings = true,
            fileSize = payloadBytes.size.toLong(),
            checksumValid = true
        )
    }

    /**
     * Atomically writes payload to Documents/AuraMusic/backup.json via MediaStore or File.
     */
    private fun writePayloadToDocuments(payloadBytes: ByteArray) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val relativePath = "${Environment.DIRECTORY_DOCUMENTS}/$APP_DOCS_SUBDIR/"

            // Check if existing file exists to overwrite or update
            val projection = arrayOf(MediaStore.MediaColumns._ID)
            val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} LIKE ?"
            val selectionArgs = arrayOf(BACKUP_FILE_NAME, "%$APP_DOCS_SUBDIR%")
            val queryUri = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)

            var existingUri: Uri? = null
            contentResolver.query(queryUri, projection, selection, selectionArgs, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
                    existingUri = Uri.withAppendedPath(queryUri, id.toString())
                }
            }

            if (existingUri != null) {
                // Overwrite existing content
                contentResolver.openOutputStream(existingUri!!, "wt")?.use { output ->
                    output.write(payloadBytes)
                    output.flush()
                } ?: error("Failed to open output stream for existing backup URI")
                Log.i(TAG, "[writePayloadToDocuments] Overwrote existing backup MediaStore file: $existingUri")
            } else {
                // Create new MediaStore entry
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, BACKUP_FILE_NAME)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/json")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }

                val newUri = contentResolver.insert(queryUri, contentValues)
                    ?: error("Failed to create MediaStore entry in Documents/$APP_DOCS_SUBDIR")

                contentResolver.openOutputStream(newUri, "w")?.use { output ->
                    output.write(payloadBytes)
                    output.flush()
                } ?: error("Failed to write data to newly created backup URI")

                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                contentResolver.update(newUri, contentValues, null, null)
                Log.i(TAG, "[writePayloadToDocuments] Created new backup MediaStore file: $newUri")
            }
        } else {
            // Direct File write for older Android versions
            val docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
            val auraDir = File(docsDir, APP_DOCS_SUBDIR)
            if (!auraDir.exists()) auraDir.mkdirs()

            val tempFile = File(auraDir, "$BACKUP_FILE_NAME.tmp")
            val targetFile = File(auraDir, BACKUP_FILE_NAME)

            FileOutputStream(tempFile).use { fos ->
                fos.write(payloadBytes)
                fos.flush()
            }

            if (targetFile.exists()) targetFile.delete()
            if (!tempFile.renameTo(targetFile)) {
                tempFile.copyTo(targetFile, overwrite = true)
                tempFile.delete()
            }
            Log.i(TAG, "[writePayloadToDocuments] Wrote backup file directly to ${targetFile.absolutePath}")
        }
    }

    /**
     * Imports and unpacks Documents/AuraMusic/backup.json into Room database and preferences
     * inside a single atomic database transaction. If any error occurs, cleanly rolls back.
     */
    suspend fun importBackup(): ImportResult = withContext(Dispatchers.IO) {
        val streamPair = openBackupInputStream()
        if (streamPair == null) {
            val docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
            val auraDir = File(docsDir, APP_DOCS_SUBDIR)
            val backupFile = File(auraDir, BACKUP_FILE_NAME)
            if (backupFile.exists() && backupFile.length() > 0) {
                return@withContext ImportResult(
                    false,
                    "Storage permission required to read Documents/$APP_DOCS_SUBDIR/$BACKUP_FILE_NAME across app re-installs. Please grant All Files Access or select the backup file.",
                    permissionRequired = true
                )
            }
            return@withContext ImportResult(false, "No backup file found in Documents/$APP_DOCS_SUBDIR/$BACKUP_FILE_NAME")
        }

        val (inputStream, _, _) = streamPair
        return@withContext importBackupFromInputStream(inputStream)
    }

    suspend fun importBackupFromUri(uri: Uri): ImportResult = withContext(Dispatchers.IO) {
        val inputStream = try {
            contentResolver.openInputStream(uri)
        } catch (e: Exception) {
            Log.e(TAG, "[importBackupFromUri] Failed to open URI: $uri", e)
            null
        } ?: return@withContext ImportResult(false, "Failed to open selected backup file: $uri")

        return@withContext importBackupFromInputStream(inputStream)
    }

    suspend fun importBackupFromInputStream(inputStream: InputStream): ImportResult = withContext(Dispatchers.IO) {
        val rawJson = try {
            inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } catch (e: Exception) {
            return@withContext ImportResult(false, "Error reading backup file: ${e.message}")
        }

        if (rawJson.isBlank()) {
            return@withContext ImportResult(false, "Backup file is empty")
        }

        val root = JSONObject(rawJson)
        val declaredChecksum = root.optString("checksum", "")
        val dataObj = root.optJSONObject("data")
            ?: return@withContext ImportResult(false, "Missing data block in backup payload")

        // Verify SHA-256 Checksum
        val computedChecksum = sha256(dataObj.toString())
        if (declaredChecksum.isNotEmpty() && declaredChecksum != computedChecksum) {
            Log.e(TAG, "[importBackup] Checksum mismatch! Declared=$declaredChecksum, Computed=$computedChecksum")
            return@withContext ImportResult(false, "Backup file checksum verification failed (corrupted or truncated file)")
        }

        // Database Transactional Restore
        try {
            database.withTransaction {
                val trackDao = database.trackDao()
                val playlistDao = database.playlistDao()
                val historyDao = database.historyDao()

                // 1. Unpack Tracks
                val tracksArray = dataObj.optJSONArray("tracks")
                if (tracksArray != null && tracksArray.length() > 0) {
                    val tracksToInsert = mutableListOf<TrackEntity>()
                    for (i in 0 until tracksArray.length()) {
                        val tj = tracksArray.getJSONObject(i)
                        val track = TrackEntity(
                            id = tj.getString("id"),
                            title = tj.optString("title", "Unknown Title"),
                            artist = tj.optString("artist", "Unknown Artist"),
                            album = tj.optString("album").takeIf { it.isNotEmpty() },
                            duration = tj.optInt("duration", 0),
                            artworkUrl = tj.optString("artworkUrl").takeIf { it.isNotEmpty() },
                            createdAt = tj.optLong("createdAt", System.currentTimeMillis()),
                            lastPlayedAt = tj.optLong("lastPlayedAt", 0L).takeIf { it > 0 },
                            playCount = tj.optInt("playCount", 0),
                            isDownloaded = false, // Never set downloaded without physical media
                            downloadedAt = null,
                            contentLength = null,
                            albumId = tj.optString("albumId").takeIf { it.isNotEmpty() },
                            artistId = tj.optString("artistId").takeIf { it.isNotEmpty() }
                        )
                        tracksToInsert.add(track)
                    }
                    trackDao.upsertAll(tracksToInsert)
                    Log.i(TAG, "[importBackup] Restored ${tracksToInsert.size} tracks into Room.")
                }

                // 2. Unpack Playlists & CrossRefs
                val playlistsArray = dataObj.optJSONArray("playlists")
                if (playlistsArray != null && playlistsArray.length() > 0) {
                    val playlistsToInsert = mutableListOf<PlaylistEntity>()
                    val crossRefsToInsert = mutableListOf<PlaylistTrackCrossRef>()

                    for (i in 0 until playlistsArray.length()) {
                        val pj = playlistsArray.getJSONObject(i)
                        val pId = pj.getString("id")
                        val playlist = PlaylistEntity(
                            id = pId,
                            title = pj.optString("title", "Playlist"),
                            description = pj.optString("description").takeIf { it.isNotEmpty() },
                            mood = pj.optString("mood").takeIf { it.isNotEmpty() },
                            coverArt = pj.optString("coverArt").takeIf { it.isNotEmpty() },
                            createdAt = pj.optLong("createdAt", System.currentTimeMillis()),
                            updatedAt = pj.optLong("updatedAt", System.currentTimeMillis()),
                            pinned = pj.optBoolean("pinned", false),
                            liked = pj.optBoolean("liked", false),
                            gradientPrimary = pj.optString("gradientPrimary").takeIf { it.isNotEmpty() },
                            gradientSecondary = pj.optString("gradientSecondary").takeIf { it.isNotEmpty() }
                        )
                        playlistsToInsert.add(playlist)

                        // Clear existing tracks for this playlist before re-adding
                        playlistDao.clearPlaylistTracks(pId)

                        val tracksInPlaylist = pj.optJSONArray("tracks")
                        if (tracksInPlaylist != null) {
                            for (j in 0 until tracksInPlaylist.length()) {
                                val pt = tracksInPlaylist.getJSONObject(j)
                                val trackId = pt.getString("trackId")
                                val position = pt.optInt("position", j)
                                val addedAt = pt.optLong("addedAt", System.currentTimeMillis())
                                crossRefsToInsert.add(PlaylistTrackCrossRef(pId, trackId, position, addedAt))
                            }
                        }
                    }

                    playlistDao.upsertPlaylists(playlistsToInsert)
                    if (crossRefsToInsert.isNotEmpty()) {
                        playlistDao.insertPlaylistTracks(crossRefsToInsert)
                    }
                    Log.i(TAG, "[importBackup] Restored ${playlistsToInsert.size} playlists and ${crossRefsToInsert.size} track cross-refs.")
                }

                // 3. Unpack History
                val historyArray = dataObj.optJSONArray("history")
                if (historyArray != null && historyArray.length() > 0) {
                    val historyToInsert = mutableListOf<HistoryEntity>()
                    for (i in 0 until historyArray.length()) {
                        val hj = historyArray.getJSONObject(i)
                        val h = HistoryEntity(
                            id = hj.optString("id", UUID.randomUUID().toString()),
                            trackId = hj.getString("trackId"),
                            timestamp = hj.optLong("timestamp", System.currentTimeMillis()),
                            listenDuration = hj.optLong("listenDuration", 0L),
                            completed = hj.optBoolean("completed", false),
                            skipped = hj.optBoolean("skipped", false)
                        )
                        historyToInsert.add(h)
                    }
                    historyDao.insertAll(historyToInsert)
                    Log.i(TAG, "[importBackup] Restored ${historyToInsert.size} history items.")
                }
            }

            // 4. Restore Preferences into SharedPreferences
            val settingsObj = dataObj.optJSONObject("settings")
            if (settingsObj != null) {
                val prefs = context.getSharedPreferences("aura_player_prefs", Context.MODE_PRIVATE)
                val editor = prefs.edit()
                val keys = settingsObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    val v = settingsObj.get(k)
                    when (v) {
                        is Boolean -> editor.putBoolean(k, v)
                        is Int -> editor.putInt(k, v)
                        is Long -> editor.putLong(k, v)
                        is Double -> editor.putFloat(k, v.toFloat())
                        is String -> editor.putString(k, v)
                    }
                }
                editor.apply()
                Log.i(TAG, "[importBackup] Restored user preferences into aura_player_prefs.")
            }

            val clientPayloadStr = dataObj.optJSONObject("clientPayload")?.toString()
            ImportResult(true, "Restore completed successfully", clientPayloadStr)
        } catch (e: Exception) {
            Log.e(TAG, "[importBackup] Transaction failed and rolled back cleanly: ${e.message}", e)
            ImportResult(false, "Restore failed: ${e.message}")
        }
    }
}
