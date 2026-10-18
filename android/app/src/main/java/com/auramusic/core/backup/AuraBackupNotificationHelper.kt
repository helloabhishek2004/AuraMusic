package com.auramusic.core.backup

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Manages native Android status notifications for Google Cloud Backup operations.
 * Displays progress, completion, and failure state notifications.
 */
object AuraBackupNotificationHelper {
    private const val TAG = "AuraBackupNotification"
    private const val CHANNEL_ID = "aura_backup_sync_channel"
    private const val NOTIFICATION_ID = 2004

    private fun createChannelIfNeeded(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (notificationManager?.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Cloud Backup & Sync",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Displays Google Cloud Backup progress and sync status."
                    setShowBadge(false)
                }
                notificationManager?.createNotificationChannel(channel)
            }
        }
    }

    fun showProgress(context: Context, title: String, text: String) {
        try {
            createChannelIfNeeded(context)
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle(title)
                .setContentText(text)
                .setProgress(0, 0, true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)

            notificationManager.notify(NOTIFICATION_ID, builder.build())
            Log.i(TAG, "[AuraBackupNotification] Progress notification displayed: $title - $text")
        } catch (e: Exception) {
            Log.w(TAG, "[AuraBackupNotification] Failed to show progress notification: ${e.message}")
        }
    }

    fun showSuccess(context: Context, title: String, text: String) {
        try {
            createChannelIfNeeded(context)
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle(title)
                .setContentText(text)
                .setProgress(0, 0, false)
                .setOngoing(false)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)

            notificationManager.notify(NOTIFICATION_ID, builder.build())
            Log.i(TAG, "[AuraBackupNotification] Success notification displayed: $title - $text")
        } catch (e: Exception) {
            Log.w(TAG, "[AuraBackupNotification] Failed to show success notification: ${e.message}")
        }
    }

    fun showFailure(context: Context, title: String, text: String) {
        try {
            createChannelIfNeeded(context)
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle(title)
                .setContentText(text)
                .setProgress(0, 0, false)
                .setOngoing(false)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)

            notificationManager.notify(NOTIFICATION_ID, builder.build())
            Log.w(TAG, "[AuraBackupNotification] Failure notification displayed: $title - $text")
        } catch (e: Exception) {
            Log.w(TAG, "[AuraBackupNotification] Failed to show failure notification: ${e.message}")
        }
    }
}
