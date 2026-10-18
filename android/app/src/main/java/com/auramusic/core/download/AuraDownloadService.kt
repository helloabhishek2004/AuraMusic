package com.auramusic.core.download

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.annotation.OptIn
import androidx.media3.common.util.NotificationUtil
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.PlatformScheduler
import androidx.media3.exoplayer.scheduler.Scheduler
import com.anonymous.AuraMusic.R

@OptIn(UnstableApi::class)
class AuraDownloadService : DownloadService(
    NOTIFICATION_ID,
    DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL,
    CHANNEL_ID,
    R.string.download_channel_name,
    0
) {
    override fun onCreate() {
        super.onCreate()
        NotificationUtil.createNotificationChannel(
            this,
            CHANNEL_ID,
            R.string.download_channel_name,
            R.string.download_channel_description,
            NotificationUtil.IMPORTANCE_LOW
        )
    }

    override fun getDownloadManager(): DownloadManager {
        return DownloadUtil.getInstance(this).downloadManager
    }

    override fun getScheduler(): Scheduler? {
        return try {
            PlatformScheduler(this, JOB_ID)
        } catch (e: Exception) {
            null
        }
    }

    override fun getForegroundNotification(
        downloads: MutableList<Download>,
        notMetRequirements: Int
    ): Notification {
        val downloadUtil = DownloadUtil.getInstance(this)
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, com.anonymous.AuraMusic.MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title: String
        val contentText: String?
        if (downloads.size == 1) {
            val download = downloads[0]
            var trackName = getString(R.string.downloading)
            var artistName: String? = null
            if (download.request.data.isNotEmpty()) {
                val rawStr = Util.fromUtf8Bytes(download.request.data)
                try {
                    if (rawStr.startsWith("{")) {
                        val obj = org.json.JSONObject(rawStr)
                        trackName = obj.optString("title", getString(R.string.downloading))
                        val a = obj.optString("artist", "")
                        if (a.isNotEmpty() && a != "Unknown Artist") {
                            artistName = a
                        }
                    } else {
                        trackName = rawStr
                    }
                } catch (_: Exception) { trackName = rawStr }
            }

            val percent = if (download.percentDownloaded != androidx.media3.common.C.PERCENTAGE_UNSET.toFloat()) {
                download.percentDownloaded.toInt().coerceIn(0, 100)
            } else if (download.contentLength > 0) {
                ((download.bytesDownloaded * 100) / download.contentLength).toInt().coerceIn(0, 100)
            } else {
                0
            }

            title = if (percent > 0) {
                "$trackName • $percent%"
            } else {
                trackName
            }
            contentText = artistName
        } else {
            title = "${downloads.size} tracks downloading"
            contentText = null
        }

        val progressNotification = downloadUtil.downloadNotificationHelper.buildProgressNotification(
            this,
            R.drawable.ic_notification,
            contentIntent,
            contentText,
            downloads,
            notMetRequirements
        )

        val cancelAction = Notification.Action.Builder(
            Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel),
            getString(android.R.string.cancel),
            PendingIntent.getService(
                this,
                0,
                Intent(this, AuraDownloadService::class.java).setAction(ACTION_CANCEL_ALL),
                PendingIntent.FLAG_IMMUTABLE
            )
        ).build()

        return Notification.Builder.recoverBuilder(this, progressNotification)
            .setContentTitle(title)
            .apply {
                if (contentText != null) {
                    setContentText(contentText)
                }
            }
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setActions(cancelAction)
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_CANCEL_ALL) {
            val downloadManager = downloadManager
            downloadManager.currentDownloads.forEach { download ->
                downloadManager.removeDownload(download.request.id)
            }
        }
        return super.onStartCommand(intent, flags, startId)
    }

    companion object {
        const val CHANNEL_ID = "aura_downloads"
        const val NOTIFICATION_ID = 2001
        const val JOB_ID = 2001
        const val ACTION_CANCEL_ALL = "com.auramusic.core.download.CANCEL_ALL"
    }
}
