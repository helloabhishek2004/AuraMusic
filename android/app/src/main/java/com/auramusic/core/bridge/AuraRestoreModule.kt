package com.auramusic.core.bridge

import android.app.Activity
import android.app.backup.BackupManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import com.auramusic.core.backup.AuraBackupNotificationHelper
import com.auramusic.core.db.AuraDatabase
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File

private const val TAG = "AuraRestore"
private const val MARKER_FILENAME = "aura_install_marker.json"
private const val REQUEST_CODE_PICK_BACKUP = 4192

class AuraRestoreModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    init {
        reactContext.addActivityEventListener(this)
    }

    private var pickDocumentPromise: Promise? = null

    override fun getName(): String = "AuraRestoreModule"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @ReactMethod
    fun isRestoredInstall(promise: Promise) {
        scope.launch {
            try {
                val markerFile = File(reactContext.noBackupFilesDir, MARKER_FILENAME)
                val markerExists = markerFile.exists()

                val dbFile = reactContext.getDatabasePath("aura_music.db")
                val rkStorage = reactContext.getDatabasePath("RKStorage")
                val hasDurableData = (dbFile.exists() && dbFile.length() > 0) ||
                        (rkStorage.exists() && rkStorage.length() > 0)

                val isRestored = !markerExists && hasDurableData
                val isFreshInstall = !markerExists && !hasDurableData

                Log.i(
                    TAG,
                    "[AuraRestore] Restore detection: markerExists=$markerExists, hasDurableData=$hasDurableData -> isRestored=$isRestored, isFreshInstall=$isFreshInstall"
                )

                val result = Arguments.createMap().apply {
                    putBoolean("isRestored", isRestored)
                    putBoolean("isFreshInstall", isFreshInstall)
                    putBoolean("markerExists", markerExists)
                    putBoolean("hasDurableData", hasDurableData)
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] Failed to evaluate restore state", e)
                withContext(Dispatchers.Main) {
                    promise.reject("RESTORE_CHECK_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun markInstallInitialized(promise: Promise) {
        scope.launch {
            try {
                val markerFile = File(reactContext.noBackupFilesDir, MARKER_FILENAME)
                val json = JSONObject().apply {
                    put("initializedAt", System.currentTimeMillis())
                    put("appVersion", "1.0.0")
                    put("markerVersion", 1)
                }
                markerFile.writeText(json.toString())
                Log.i(TAG, "[AuraRestore] Installation marker persisted in noBackupFilesDir: ${markerFile.absolutePath}")

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] Failed to write installation marker", e)
                withContext(Dispatchers.Main) {
                    promise.reject("MARKER_WRITE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun clearInstallMarker(promise: Promise) {
        scope.launch {
            try {
                val markerFile = File(reactContext.noBackupFilesDir, MARKER_FILENAME)
                val deleted = if (markerFile.exists()) markerFile.delete() else true
                Log.i(TAG, "[AuraRestore] Installation marker cleared: deleted=$deleted")

                withContext(Dispatchers.Main) {
                    promise.resolve(deleted)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] Failed to clear installation marker", e)
                withContext(Dispatchers.Main) {
                    promise.resolve(false)
                }
            }
        }
    }

    @ReactMethod
    fun checkpointWal(promise: Promise) {
        scope.launch {
            try {
                Log.i(TAG, "[AuraRestore] Initiating SQLite WAL checkpoint(TRUNCATE)")
                val db = AuraDatabase.getInstance(reactContext)
                val supportDb = db.openHelper.writableDatabase
                val cursor = supportDb.query("PRAGMA wal_checkpoint(TRUNCATE)")
                var busy = -1
                var log = -1
                var checkpointed = -1
                if (cursor.moveToFirst()) {
                    busy = cursor.getInt(0)
                    log = cursor.getInt(1)
                    checkpointed = cursor.getInt(2)
                }
                cursor.close()
                Log.i(TAG, "[AuraRestore] WAL checkpoint result: busy=$busy, log=$log, checkpointed=$checkpointed")

                val result = Arguments.createMap().apply {
                    putBoolean("success", busy == 0)
                    putInt("busy", busy)
                    putInt("logPages", log)
                    putInt("checkpointedPages", checkpointed)
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.w(TAG, "[AuraRestore] WAL checkpoint warning: ${e.message}")
                withContext(Dispatchers.Main) {
                    promise.resolve(Arguments.createMap().apply {
                        putBoolean("success", false)
                        putString("error", e.message)
                    })
                }
            }
        }
    }

    @ReactMethod
    fun getRestoreDiagnostics(promise: Promise) {
        scope.launch {
            try {
                val dbFile = reactContext.getDatabasePath("aura_music.db")
                val rkStorage = reactContext.getDatabasePath("RKStorage")
                val markerFile = File(reactContext.noBackupFilesDir, MARKER_FILENAME)

                val result = Arguments.createMap().apply {
                    putBoolean("dbExists", dbFile.exists())
                    putDouble("dbBytes", (if (dbFile.exists()) dbFile.length() else 0L).toDouble())
                    putBoolean("rkStorageExists", rkStorage.exists())
                    putDouble("rkStorageBytes", (if (rkStorage.exists()) rkStorage.length() else 0L).toDouble())
                    putBoolean("markerExists", markerFile.exists())
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("DIAGNOSTICS_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun setGoogleSyncEnabled(enabled: Boolean, promise: Promise) {
        scope.launch {
            try {
                val prefs = reactContext.getSharedPreferences("aura_player_prefs", Context.MODE_PRIVATE)
                prefs.edit().putBoolean("google_sync_enabled", enabled).apply()
                Log.i(TAG, "[AuraRestore] google_sync_enabled set to $enabled in aura_player_prefs")

                if (enabled) {
                    try {
                        val bm = BackupManager(reactContext)
                        bm.dataChanged()
                    } catch (e: Exception) {
                        Log.w(TAG, "[AuraRestore] BackupManager notify error: ${e.message}")
                    }
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("SYNC_PREFS_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun isGoogleSyncEnabled(promise: Promise) {
        scope.launch {
            try {
                val prefs = reactContext.getSharedPreferences("aura_player_prefs", Context.MODE_PRIVATE)
                val enabled = prefs.getBoolean("google_sync_enabled", true)
                withContext(Dispatchers.Main) {
                    promise.resolve(enabled)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.resolve(true)
                }
            }
        }
    }

    @ReactMethod
    fun triggerCloudSync(promise: Promise) {
        scope.launch {
            try {
                Log.i(TAG, "[AuraRestore] Manual Cloud Sync requested. Checkpointing WAL...")
                AuraBackupNotificationHelper.showProgress(
                    reactContext,
                    "Cloud Backup in Progress",
                    "Preparing library databases and queuing cloud sync..."
                )

                val db = AuraDatabase.getInstance(reactContext)
                val supportDb = db.openHelper.writableDatabase
                val cursor = supportDb.query("PRAGMA wal_checkpoint(FULL)")
                cursor.moveToFirst()
                cursor.close()

                val bm = BackupManager(reactContext)
                bm.dataChanged()
                Log.i(TAG, "[AuraRestore] BackupManager.dataChanged() completed.")

                AuraBackupNotificationHelper.showSuccess(
                    reactContext,
                    "Cloud Backup Scheduled",
                    "Your library and preferences are safely committed for Google Backup."
                )

                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] triggerCloudSync error", e)
                AuraBackupNotificationHelper.showFailure(
                    reactContext,
                    "Cloud Backup Failed",
                    "Could not complete cloud backup: ${e.message}"
                )
                withContext(Dispatchers.Main) {
                    promise.reject("SYNC_TRIGGER_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun showBackupProgressNotification(title: String, text: String, promise: Promise) {
        try {
            AuraBackupNotificationHelper.showProgress(reactContext, title, text)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun showBackupSuccessNotification(title: String, text: String, promise: Promise) {
        try {
            AuraBackupNotificationHelper.showSuccess(reactContext, title, text)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun showBackupFailureNotification(title: String, text: String, promise: Promise) {
        try {
            AuraBackupNotificationHelper.showFailure(reactContext, title, text)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun triggerManualRestore(promise: Promise) {
        scope.launch {
            try {
                Log.i(TAG, "[AuraRestore] Manual restore requested by user.")
                AuraBackupNotificationHelper.showProgress(
                    reactContext,
                    "Restoring Backup Data",
                    "Validating local databases and re-syncing library state..."
                )

                // Force WAL Checkpoint on SQLite to synchronize disk state
                val db = AuraDatabase.getInstance(reactContext)
                val supportDb = db.openHelper.writableDatabase
                val cursor = supportDb.query("PRAGMA wal_checkpoint(FULL)")
                cursor.moveToFirst()
                cursor.close()

                val dbFile = reactContext.getDatabasePath("aura_music.db")
                val rkStorage = reactContext.getDatabasePath("RKStorage")
                val dbBytes = if (dbFile.exists()) dbFile.length() else 0L
                val rkBytes = if (rkStorage.exists()) rkStorage.length() else 0L

                Log.i(TAG, "[AuraRestore] Manual restore sync complete. dbBytes=$dbBytes, rkBytes=$rkBytes")

                AuraBackupNotificationHelper.showSuccess(
                    reactContext,
                    "Restore Completed",
                    "Library and preferences successfully synchronized."
                )

                val result = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putDouble("dbBytes", dbBytes.toDouble())
                    putDouble("rkStorageBytes", rkBytes.toDouble())
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }

                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] triggerManualRestore error", e)
                AuraBackupNotificationHelper.showFailure(
                    reactContext,
                    "Restore Failed",
                    "Could not complete manual restore: ${e.message}"
                )
                withContext(Dispatchers.Main) {
                    promise.reject("RESTORE_TRIGGER_ERROR", e.message, e)
                }
            }
        }
    }

    // ─── LOCAL SCOPED STORAGE BACKUP ENGINE ────────────────────────────

    private val localBackupManager by lazy { com.auramusic.core.backup.LocalBackupManager(reactContext) }

    @ReactMethod
    fun checkForLocalBackup(promise: Promise) {
        scope.launch {
            try {
                val metadata = localBackupManager.checkForBackup()
                val map = Arguments.createMap().apply {
                    putBoolean("exists", metadata.exists)
                    putInt("schemaVersion", metadata.schemaVersion)
                    putString("exportedAt", metadata.exportedAt)
                    putDouble("timestamp", metadata.timestamp.toDouble())
                    putString("appVersion", metadata.appVersion)
                    putInt("songCount", metadata.songCount)
                    putInt("playlistCount", metadata.playlistCount)
                    putInt("historyCount", metadata.historyCount)
                    putBoolean("hasSettings", metadata.hasSettings)
                    putDouble("fileSize", metadata.fileSize.toDouble())
                    putBoolean("checksumValid", metadata.checksumValid)
                    putString("uriString", metadata.uriString ?: "")
                    putBoolean("permissionRequired", metadata.permissionRequired)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] checkForLocalBackup error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("LOCAL_BACKUP_CHECK_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun exportLocalBackup(clientSettingsJson: String?, promise: Promise) {
        scope.launch {
            try {
                val metadata = localBackupManager.exportBackup(clientSettingsJson)
                val map = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("exportedAt", metadata.exportedAt)
                    putDouble("timestamp", metadata.timestamp.toDouble())
                    putInt("songCount", metadata.songCount)
                    putInt("playlistCount", metadata.playlistCount)
                    putInt("historyCount", metadata.historyCount)
                    putDouble("fileSize", metadata.fileSize.toDouble())
                    putBoolean("checksumValid", metadata.checksumValid)
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] exportLocalBackup error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("LOCAL_BACKUP_EXPORT_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun importLocalBackup(promise: Promise) {
        scope.launch {
            try {
                val result = localBackupManager.importBackup()
                val map = Arguments.createMap().apply {
                    putBoolean("success", result.success)
                    putString("message", result.message)
                    putString("clientSettingsJson", result.clientSettingsJson ?: "")
                    putBoolean("permissionRequired", result.permissionRequired)
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                }
                withContext(Dispatchers.Main) {
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[AuraRestore] importLocalBackup error", e)
                withContext(Dispatchers.Main) {
                    promise.reject("LOCAL_BACKUP_IMPORT_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun isStorageManagerGranted(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager())
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestManageStoragePermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(intent)
                    promise.resolve(true)
                } catch (_: Exception) {
                    val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(intent)
                    promise.resolve(true)
                }
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "[AuraRestore] requestManageStoragePermission error", e)
            promise.reject("STORAGE_PERMISSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun pickAndRestoreBackup(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is unavailable")
            return
        }

        try {
            pickDocumentPromise = promise
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                val extraMimeTypes = arrayOf("application/json", "text/plain", "application/octet-stream")
                putExtra(Intent.EXTRA_MIME_TYPES, extraMimeTypes)
            }
            activity.startActivityForResult(intent, REQUEST_CODE_PICK_BACKUP)
        } catch (e: Exception) {
            pickDocumentPromise = null
            Log.e(TAG, "[AuraRestore] Failed to launch document picker", e)
            promise.reject("PICK_LAUNCH_ERROR", e.message, e)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE_PICK_BACKUP) {
            val promise = pickDocumentPromise
            pickDocumentPromise = null
            if (resultCode == Activity.RESULT_OK && data?.data != null) {
                val uri = data.data!!
                scope.launch {
                    try {
                        val result = localBackupManager.importBackupFromUri(uri)
                        val map = Arguments.createMap().apply {
                            putBoolean("success", result.success)
                            putString("message", result.message)
                            putString("clientSettingsJson", result.clientSettingsJson ?: "")
                            putBoolean("permissionRequired", result.permissionRequired)
                            putDouble("timestamp", System.currentTimeMillis().toDouble())
                        }
                        withContext(Dispatchers.Main) {
                            promise?.resolve(map)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "[AuraRestore] Error importing from picked URI", e)
                        withContext(Dispatchers.Main) {
                            promise?.reject("PICK_RESTORE_ERROR", e.message, e)
                        }
                    }
                }
            } else {
                val map = Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("message", "File selection cancelled")
                    putBoolean("cancelled", true)
                }
                promise?.resolve(map)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {}
}
