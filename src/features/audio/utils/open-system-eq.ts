import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export interface EQLaunchResult {
  success: boolean;
  opened: 'system_eq' | 'oem_eq' | 'sound_settings' | 'none';
  error?: string;
}

/**
 * Robust equalizer launcher utilizing expo-intent-launcher for Android 
 * and deep links for iOS.
 */
export async function openSystemEqualizer(): Promise<EQLaunchResult> {
  if (Platform.OS === 'ios') {
    try {
      // Direct path to Music EQ settings on iOS
      await Linking.openURL('App-Prefs:MUSIC&path=EQ');
      return { success: true, opened: 'system_eq' };
    } catch (e) {
      // Fallback to general music settings
      try {
        await Linking.openURL('App-Prefs:MUSIC');
        return { success: true, opened: 'system_eq' };
      } catch (err) {
        return { success: false, opened: 'none', error: 'iOS settings blocked' };
      }
    }
  }

  if (Platform.OS === 'android') {
    try {
      const { Application } = require('expo-constants');
      const packageName = Application?.applicationId || 'com.anonymous.AuraMusic';

      await IntentLauncher.startActivityAsync('android.media.action.DISPLAY_AUDIO_EFFECT_CONTROL_PANEL', {
          extra: {
              'android.media.extra.PACKAGE_NAME': packageName,
              // 'android.media.extra.AUDIO_SESSION': sessionId, // Optional if we had session ID
              'android.media.extra.CONTENT_TYPE': 0 // music
          }
      });
      return { success: true, opened: 'system_eq' };
    } catch (e) {
      // Fallback for OEMs that block the standard action
      try {
        await IntentLauncher.startActivityAsync('android.settings.SOUND_SETTINGS');
        return { success: true, opened: 'sound_settings' };
      } catch (err) {
        return { success: false, opened: 'none', error: 'All intents failed' };
      }
    }
  }

  return { success: false, opened: 'none', error: 'Unsupported platform' };
}
