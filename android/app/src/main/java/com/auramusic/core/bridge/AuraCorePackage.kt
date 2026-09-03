package com.auramusic.core.bridge

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage that registers all AuraMusic Native Core bridge modules.
 */
class AuraCorePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            AuraPlayerModule(reactContext),
            AuraYouTubeModule(reactContext),
            AuraHistoryModule(reactContext),
            AuraLyricsModule(reactContext),
            AuraDownloadModule(reactContext),
            AuraPlaylistModule(reactContext),
            AuraRestoreModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
