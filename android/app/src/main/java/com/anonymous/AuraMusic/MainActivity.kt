package com.anonymous.AuraMusic
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle
import androidx.activity.OnBackPressedCallback

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private val backPressedCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      // Temporarily disable to prevent recursive loops if super.onBackPressed() is invoked
      isEnabled = false
      try {
        onBackPressed()
      } finally {
        isEnabled = true
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
    onBackPressedDispatcher.addCallback(this, backPressedCallback)
    enableOptimalRefreshRate()
  }

  override fun onResume() {
    super.onResume()
    enableOptimalRefreshRate()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      enableOptimalRefreshRate()
    }
  }

  private fun enableOptimalRefreshRate() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val currentDisplay = this.display ?: return
        val currentMode = currentDisplay.mode
        val maxMode = currentDisplay.supportedModes
          ?.filter { it.physicalWidth == currentMode.physicalWidth && it.physicalHeight == currentMode.physicalHeight }
          ?.maxByOrNull { it.refreshRate } ?: return

        val layoutParams = window.attributes
        layoutParams.preferredDisplayModeId = maxMode.modeId
        layoutParams.preferredRefreshRate = maxMode.refreshRate
        window.attributes = layoutParams
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        @Suppress("DEPRECATION")
        val windowManager = getSystemService(android.content.Context.WINDOW_SERVICE) as? android.view.WindowManager
        @Suppress("DEPRECATION")
        val currentDisplay = windowManager?.defaultDisplay ?: return
        @Suppress("DEPRECATION")
        val currentMode = currentDisplay.mode
        val maxMode = currentDisplay.supportedModes
          ?.filter { it.physicalWidth == currentMode.physicalWidth && it.physicalHeight == currentMode.physicalHeight }
          ?.maxByOrNull { it.refreshRate } ?: return

        val layoutParams = window.attributes
        layoutParams.preferredDisplayModeId = maxMode.modeId
        layoutParams.preferredRefreshRate = maxMode.refreshRate
        window.attributes = layoutParams
      }
    } catch (_: Throwable) {
      // Gracefully fall back to system defaults
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
    ){}
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      backPressedCallback.isEnabled = false
      try {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            if (!moveTaskToBack(false)) {
                // For non-root activities, use the default implementation to finish them.
                super.invokeDefaultOnBackPressed()
            }
            return
        }

        // Use the default back button implementation on Android S
        // because it's doing more than [Activity.moveTaskToBack] in fact.
        super.invokeDefaultOnBackPressed()
      } finally {
        backPressedCallback.isEnabled = true
      }
  }
}
