package com.anonymous.AuraMusic.poc

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer

class Media3PlaybackManager(private val context: Context) {
    private var player: ExoPlayer? = null

    fun playAudio(url: String) {
        Handler(Looper.getMainLooper()).post {
            if (player == null) {
                player = ExoPlayer.Builder(context).build()
            }
            player?.stop()
            player?.clearMediaItems()
            val mediaItem = MediaItem.fromUri(Uri.parse(url))
            player?.setMediaItem(mediaItem)
            player?.prepare()
            player?.play()
        }
    }

    fun stop() {
        Handler(Looper.getMainLooper()).post {
            player?.stop()
            player?.release()
            player = null
        }
    }
}
