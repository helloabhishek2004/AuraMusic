package com.auramusic.core.backup

import android.app.backup.BackupAgent
import android.app.backup.BackupDataInput
import android.app.backup.BackupDataOutput
import android.app.backup.FullBackupDataOutput
import android.content.Context
import android.os.ParcelFileDescriptor
import android.util.Log
import com.auramusic.core.db.AuraDatabase
import java.io.File

/**
 * Production-grade BackupAgent for AuraMusic.
 * Respects user's Google Account Sync toggle and checkpoints SQLite WAL prior to full backup.
 */
class AuraBackupAgent : BackupAgent() {

    override fun onFullBackup(data: FullBackupDataOutput) {
        val prefs = getSharedPreferences("aura_player_prefs", Context.MODE_PRIVATE)
        val isSyncEnabled = prefs.getBoolean("google_sync_enabled", true)

        if (!isSyncEnabled) {
            Log.i(TAG, "[AuraBackupAgent] Google Account Sync is disabled in AuraMusic settings. Aborting full backup.")
            return
        }

        Log.i(TAG, "[AuraBackupAgent] Google Account Sync is active. Checkpointing SQLite WAL before backup...")
        AuraBackupNotificationHelper.showProgress(
            this,
            "Cloud Backup in Progress",
            "Backing up library, playlists, and preferences to Google Account..."
        )

        try {
            AuraDatabase.checkpoint(this)
            Log.i(TAG, "[AuraBackupAgent] Proceeding with allowlist full backup extraction.")
            super.onFullBackup(data)
            Log.i(TAG, "[AuraBackupAgent] Full backup successfully dispatched.")
            AuraBackupNotificationHelper.showSuccess(
                this,
                "Cloud Backup Finished",
                "Your AuraMusic library and settings are safely synced to Google Account."
            )
        } catch (e: Exception) {
            Log.e(TAG, "[AuraBackupAgent] Backup failed: ${e.message}", e)
            AuraBackupNotificationHelper.showFailure(
                this,
                "Cloud Backup Failed",
                "Google Account Backup encountered an error: ${e.message}"
            )
            throw e
        }
    }

    override fun onBackup(
        oldState: ParcelFileDescriptor?,
        data: BackupDataOutput?,
        newState: ParcelFileDescriptor?
    ) {
        // Full backup mechanism is used via data_extraction_rules / backup_rules
    }

    override fun onRestore(
        data: BackupDataInput?,
        appVersionCode: Int,
        newState: ParcelFileDescriptor?
    ) {
        // Full backup mechanism is used
    }

    override fun onRestoreFile(
        data: ParcelFileDescriptor?,
        size: Long,
        destination: File?,
        type: Int,
        mode: Long,
        mtime: Long
    ) {
        super.onRestoreFile(data, size, destination, type, mode, mtime)
    }

    companion object {
        private const val TAG = "AuraBackupAgent"
    }
}
