import { Platform, PermissionsAndroid, Permission } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';

const FIRST_INSTALL_PERMISSIONS_KEY = '@aura_first_install_permissions_requested_v1';

export class PermissionPromptService {
  /**
   * Checks if initial permissions have been requested on first install.
   * Prompts the user with standard Android system dialogs for:
   * 1. Notifications (POST_NOTIFICATIONS on Android 13+ / API 33+)
   * 2. Audio Files & Media Storage (READ_MEDIA_AUDIO on Android 13+, READ_EXTERNAL_STORAGE on <= 12)
   */
  static async requestInitialPermissionsIfNeeded(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const alreadyRequested = await AsyncStorage.getItem(FIRST_INSTALL_PERMISSIONS_KEY);
      if (alreadyRequested === 'true') {
        return;
      }

      const permissionsToRequest: Permission[] = [];

      // 1. Notification Permission (Android 13+ / API 33+)
      if (Platform.Version >= 33) {
        const hasNotif = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (!hasNotif) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
      }

      // 2. Audio Files / Media Permission
      if (Platform.Version >= 33) {
        const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
        if (!hasAudio) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
        }
      } else {
        const hasStorage = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        if (!hasStorage) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }
      }

      // Prompt with default Android OS system popups
      if (permissionsToRequest.length > 0) {
        await PermissionsAndroid.requestMultiple(permissionsToRequest);
      }

      // Also ensure Expo MediaLibrary permission state is synced
      try {
        await MediaLibrary.requestPermissionsAsync();
      } catch (err) {
        // Safe fallback
      }

      // Mark as requested so user is not prompted repeatedly on every launch
      await AsyncStorage.setItem(FIRST_INSTALL_PERMISSIONS_KEY, 'true');
    } catch (error) {
      console.warn('[PermissionPromptService] Failed to request initial permissions:', error);
    }
  }
}
