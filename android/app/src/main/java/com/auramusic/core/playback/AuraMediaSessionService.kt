package com.auramusic.core.playback

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.anonymous.AuraMusic.R

private const val TAG = "MediaSessionTrace"
const val PLAYBACK_NOTIFICATION_CHANNEL_ID = "auramusic_playback_channel"

/**
 * AuraMediaSessionService — Media3 MediaSessionService for AuraMusic.
 * Exposes the single authoritative ExoPlayer instance to the Android OS,
 * enabling system media notifications, lock-screen controls, Bluetooth media buttons,
 * and external media device routing without requiring React Native UI to be in the foreground.
 */
class AuraMediaSessionService : MediaSessionService() {

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "[MediaSessionTrace] SERVICE_STARTED")
        createNotificationChannel()

        val notificationProvider = DefaultMediaNotificationProvider.Builder(this)
            .setChannelId(PLAYBACK_NOTIFICATION_CHANNEL_ID)
            .setChannelName(R.string.playback_channel_name)
            .build()
        notificationProvider.setSmallIcon(R.drawable.ic_notification)
        setMediaNotificationProvider(notificationProvider)

        val player = AuraPlayer.getInstance(applicationContext)
        val session = player.getMediaSession()
        if (session != null) {
            try {
                addSession(session)
                Log.i(TAG, "[MediaSessionTrace] Session added to MediaSessionService")
            } catch (e: Exception) {
                Log.w(TAG, "[MediaSessionTrace] addSession error: ${e.message}")
            }
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        val player = AuraPlayer.getInstance(applicationContext)
        val session = player.getMediaSession()
        Log.i(TAG, "[MediaSessionTrace] onGetSession controller=${controllerInfo.packageName} session=${session != null}")
        if (session != null) {
            try {
                addSession(session)
            } catch (e: Exception) {
                // Session might already be added
            }
        }
        return session
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.i(TAG, "[MediaSessionTrace] onTaskRemoved")
        val player = AuraPlayer.getInstance(applicationContext)
        val isPlaying = player.getState().isPlaying
        if (!isPlaying) {
            Log.i(TAG, "[MediaSessionTrace] Playback stopped on task removed -> stopping service")
            stopSelf()
        }
    }

    override fun onDestroy() {
        Log.i(TAG, "[MediaSessionTrace] SERVICE_DESTROYED")
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = getString(R.string.playback_channel_name)
            val descriptionText = getString(R.string.playback_channel_description)
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(PLAYBACK_NOTIFICATION_CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
