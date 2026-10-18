package com.anonymous.AuraMusic

import android.content.Context
import android.content.Intent
import android.media.audiofx.AudioEffect
import com.facebook.react.bridge.*
import com.doublesymmetry.trackplayer.TrackPlayerPlaybackService

class AuraAudioSessionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AuraAudioSession"
    }

    @ReactMethod
    fun getAudioSessionId(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val player = TrackPlayerPlaybackService.sharedExoPlayer
                val sessionId = player?.audioSessionId ?: 0
                promise.resolve(sessionId)
            } catch (e: Exception) {
                promise.reject("ERR_SESSION", e.message)
            }
        }
    }

    @ReactMethod
    fun openSystemEqualizer(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("ERR_ACTIVITY", "No activity")
                return@runOnUiThread
            }

            val player = TrackPlayerPlaybackService.sharedExoPlayer
            val sessionId = player?.audioSessionId ?: 0
            val packageName = reactApplicationContext.packageName

            val intent = Intent(AudioEffect.ACTION_DISPLAY_AUDIO_EFFECT_CONTROL_PANEL).apply {
                putExtra(AudioEffect.EXTRA_PACKAGE_NAME, packageName)
                putExtra(AudioEffect.EXTRA_AUDIO_SESSION, sessionId)
                putExtra(AudioEffect.EXTRA_CONTENT_TYPE, 0)
            }

            try {
                if (intent.resolveActivity(activity.packageManager) != null) {
                    activity.startActivityForResult(intent, 1001)
                    promise.resolve(writableMapOf(
                        "success" to true,
                        "type" to "session_eq",
                        "sessionId" to sessionId
                    ))
                } else {
                    attemptOEMEqualizers(promise)
                }
            } catch (e: Exception) {
                attemptOEMEqualizers(promise)
            }
        }
    }

    @ReactMethod
    fun getDisplaySpecs(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val activity = reactApplicationContext.currentActivity
                if (activity == null) {
                    promise.reject("ERR_ACTIVITY", "No activity")
                    return@runOnUiThread
                }

                val window = activity.window
                val layoutParams = window.attributes

                val display = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                    activity.display
                } else {
                    @Suppress("DEPRECATION")
                    activity.windowManager.defaultDisplay
                }

                if (display == null) {
                    promise.reject("ERR_DISPLAY", "No display found")
                    return@runOnUiThread
                }

                val currentMode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    display.mode
                } else {
                    null
                }

                val map = Arguments.createMap()
                
                // Get current refresh rate
                val currentRefreshRate = @Suppress("DEPRECATION") display.refreshRate.toDouble()
                map.putDouble("currentRefreshRate", currentRefreshRate)

                // Get current mode specs
                if (currentMode != null) {
                    map.putInt("modeId", currentMode.modeId)
                    map.putDouble("modeRefreshRate", currentMode.refreshRate.toDouble())
                    map.putInt("modeWidth", currentMode.physicalWidth)
                    map.putInt("modeHeight", currentMode.physicalHeight)
                }

                // Window preferred settings
                map.putDouble("preferredRefreshRate", layoutParams.preferredRefreshRate.toDouble())
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    map.putInt("preferredDisplayModeId", layoutParams.preferredDisplayModeId)
                }

                val supportedModesArray = Arguments.createArray()
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    val modes = display.supportedModes
                    for (mode in modes) {
                        val m = Arguments.createMap()
                        m.putInt("modeId", mode.modeId)
                        m.putDouble("refreshRate", mode.refreshRate.toDouble())
                        m.putInt("width", mode.physicalWidth)
                        m.putInt("height", mode.physicalHeight)
                        supportedModesArray.pushMap(m)
                    }
                }
                map.putArray("supportedModes", supportedModesArray)

                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("ERR_DISPLAY_SPECS", e.message)
            }
        }
    }

    private fun attemptOEMEqualizers(promise: Promise) {
        val activity = reactApplicationContext.currentActivity ?: return
        val oemIntents = listOf(
            "com.sec.android.app.soundalive.SETTING" to "Samsung",
            "com.miui.player.AUDIO_EFFECTS" to "Xiaomi",
            "com.sonyericsson.audioeffect.SrsLoudness" to "Sony"
        )

        for ((action, name) in oemIntents) {
            try {
                val intent = Intent(action)
                if (intent.resolveActivity(activity.packageManager) != null) {
                    activity.startActivity(intent)
                    promise.resolve(writableMapOf(
                        "success" to true,
                        "type" to "oem_eq",
                        "packageName" to action
                    ))
                    return
                }
            } catch (e: Exception) {}
        }

        try {
            val intent = Intent(android.provider.Settings.ACTION_SOUND_SETTINGS)
            activity.startActivity(intent)
            promise.resolve(writableMapOf(
                "success" to true,
                "type" to "sound_settings"
            ))
        } catch (e: Exception) {
            promise.resolve(writableMapOf(
                "success" to false,
                "type" to "unavailable"
            ))
        }
    }

    private fun writableMapOf(vararg pairs: Pair<String, Any>): WritableMap {
        val map = Arguments.createMap()
        for ((key, value) in pairs) {
            when (value) {
                is String -> map.putString(key, value)
                is Int -> map.putInt(key, value)
                is Boolean -> map.putBoolean(key, value)
                is Double -> map.putDouble(key, value)
            }
        }
        return map
    }
}