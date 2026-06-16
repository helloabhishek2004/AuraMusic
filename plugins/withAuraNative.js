const { withAppDelegate, withMainApplication, withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * AuraNative Config Plugin
 */
module.exports = function withAuraNative(config) {
  // --- Android Dependencies ---
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('androidx.media3:media3-exoplayer')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        'dependencies {\n    implementation "androidx.media3:media3-exoplayer:1.9.2"'
      );
    }
    return config;
  });

  // --- Android Session Bridge ---
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packagePath = 'com/anonymous/AuraMusic';
      const mainPath = path.join(projectRoot, 'android/app/src/main/java', packagePath);

      if (!fs.existsSync(mainPath)) {
        fs.mkdirSync(mainPath, { recursive: true });
      }

      // 1. AuraAudioSessionModule.kt
      const moduleCode = `package com.anonymous.AuraMusic

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
}`;
      fs.writeFileSync(path.join(mainPath, 'AuraAudioSessionModule.kt'), moduleCode);

      // 2. AuraAudioSessionPackage.kt
      const packageCode = `package com.anonymous.AuraMusic

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

@Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
class AuraAudioSessionPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(AuraAudioSessionModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}`;
      fs.writeFileSync(path.join(mainPath, 'AuraAudioSessionPackage.kt'), packageCode);

      return config;
    },
  ]);

  // --- Register Package in MainApplication.kt ---
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('AuraAudioSessionPackage()')) {
      const packageSearch = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (packageSearch.test(contents)) {
          contents = contents.replace(
            packageSearch,
            'PackageList(this).packages.apply {\n          add(AuraAudioSessionPackage())'
          );
      } else if (contents.includes('return PackageList(this).getPackages().apply {')) {
           contents = contents.replace(
            'return PackageList(this).getPackages().apply {',
            'return PackageList(this).getPackages().apply {\n      add(AuraAudioSessionPackage())'
          );
      }
    }
    config.modResults.contents = contents;
    return config;
  });

  // --- iOS AppDelegate Patch (Optional/Cleaned) ---
  // Removing Mono Audio as per Phase 8.
  config = withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;
    // Remove previous mono logic if exists
    contents = contents.replace(/\n- \(void\)setAppMonoAudio:[\s\S]*?\n\}/g, '');
    config.modResults.contents = contents;
    return config;
  });

  return config;
};
