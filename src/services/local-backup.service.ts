import { AppState, AppStateStatus } from 'react-native';
import { AuraRestore } from '@/src/services/native-core';
import { useSettingsStore } from '@/src/features/settings/store/settings.store';
import { useLikesStore } from '@/src/features/likes/store/likes.store';
import { usePlaylistStore } from '@/src/features/playlist/store/playlist.store';
import { useAnalyticsStore } from '@/src/features/analytics/store/analytics.store';
import { useTasteProfileStore } from '@/src/features/taste-profile/store/taste-profile.store';

export interface LocalBackupMetadata {
  exists: boolean;
  schemaVersion?: number;
  exportedAt?: string;
  timestamp?: number;
  appVersion?: string;
  songCount?: number;
  playlistCount?: number;
  historyCount?: number;
  hasSettings?: boolean;
  fileSize?: number;
  checksumValid?: boolean;
  uriString?: string;
  permissionRequired?: boolean;
}

/**
 * Service orchestrating automatic and manual local Scoped Storage backups
 * to Documents/AuraMusic/backup.json.
 */
export class LocalBackupService {
  private static isInitialized = false;
  private static debounceTimer: any = null;
  private static isExporting = false;
  private static DEBOUNCE_MS = 6000; // 6 second debounce for database entity changes

  /**
   * Initializes listeners for auto-backup:
   * 1. Subscribes to AppState changes (triggers backup on app entering background).
   * 2. Subscribes to Likes, Playlist, and Settings store changes (debounced silent sync).
   */
  static initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. App background lifecycle transition
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const autoBackup = useSettingsStore.getState().localAutoBackupEnabled;
        if (autoBackup) {
          console.info('[LocalBackupService] App transitioning to background -> triggering auto-backup');
          this.triggerAutoBackup(true); // immediate
        }
      }
    });

    // 2. Debounced store subscriptions
    const onStoreChange = () => {
      const autoBackup = useSettingsStore.getState().localAutoBackupEnabled;
      if (autoBackup) {
        this.scheduleDebouncedBackup();
      }
    };

    useLikesStore.subscribe(onStoreChange);
    usePlaylistStore.subscribe(onStoreChange);
    useSettingsStore.subscribe(onStoreChange);
    console.info('[LocalBackupService] Local backup engine initialized with scoped storage sync');
  }

  private static scheduleDebouncedBackup() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.triggerAutoBackup(false);
    }, this.DEBOUNCE_MS);
  }

  /**
   * Triggers an automatic silent backup in the background.
   */
  static async triggerAutoBackup(immediate = false): Promise<void> {
    if (!AuraRestore || typeof AuraRestore.exportLocalBackup !== 'function') return;
    if (this.isExporting) return;

    this.isExporting = true;
    try {
      const clientSettings = this.gatherClientPayload();
      const result = await AuraRestore.exportLocalBackup(JSON.stringify(clientSettings));
      console.info('[LocalBackupService] Auto backup completed successfully:', result);
    } catch (e: any) {
      console.warn('[LocalBackupService] Auto backup failed silently:', e?.message || e);
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Triggers a manual user backup now with full result returned.
   */
  static async exportManualBackup(): Promise<{
    success: boolean;
    exportedAt: string;
    timestamp: number;
    songCount: number;
    playlistCount: number;
    historyCount: number;
    fileSize: number;
    checksumValid: boolean;
  }> {
    if (!AuraRestore || typeof AuraRestore.exportLocalBackup !== 'function') {
      throw new Error('Native Local Backup engine is not available on this device');
    }

    const clientSettings = this.gatherClientPayload();
    return await AuraRestore.exportLocalBackup(JSON.stringify(clientSettings));
  }

  /**
   * Checks public Documents/AuraMusic/backup.json for existing backup files.
   */
  static async checkForBackup(): Promise<LocalBackupMetadata> {
    if (!AuraRestore || typeof AuraRestore.checkForLocalBackup !== 'function') {
      return { exists: false };
    }
    try {
      return await AuraRestore.checkForLocalBackup();
    } catch (e) {
      console.warn('[LocalBackupService] Failed to check for backup:', e);
      return { exists: false };
    }
  }

  /**
   * Restores data from Documents/AuraMusic/backup.json into Room and synchronizes Zustand stores.
   */
  static async restoreBackup(): Promise<{
    success: boolean;
    message: string;
    timestamp: number;
    permissionRequired?: boolean;
  }> {
    if (!AuraRestore || typeof AuraRestore.importLocalBackup !== 'function') {
      throw new Error('Native Local Backup engine is not available on this device');
    }

    const result = await AuraRestore.importLocalBackup();
    if (!result.success) {
      if (result.permissionRequired) {
        return {
          success: false,
          permissionRequired: true,
          message: result.message,
          timestamp: Date.now(),
        };
      }
      throw new Error(result.message || 'Local backup restore failed');
    }

    // Force WAL Checkpoint
    try {
      if (typeof AuraRestore.checkpointWal === 'function') {
        await AuraRestore.checkpointWal();
      }
    } catch (_) {}

    // Resynchronize client Zustand stores from Room and client settings
    await this.resyncStoresAfterRestore(result.clientSettingsJson);

    return result;
  }

  /**
   * Restores data by opening the Android system document picker (SAF),
   * allowing the user to select any backup.json file without requiring broad permissions.
   */
  static async pickAndRestoreBackup(): Promise<{
    success: boolean;
    message: string;
    timestamp: number;
    cancelled?: boolean;
  }> {
    if (!AuraRestore || typeof AuraRestore.pickAndRestoreBackup !== 'function') {
      throw new Error('Document Picker is not available on this device');
    }

    const result = await AuraRestore.pickAndRestoreBackup();
    if (result.cancelled) {
      return {
        success: false,
        cancelled: true,
        message: result.message || 'File selection cancelled',
        timestamp: Date.now(),
      };
    }

    if (!result.success) {
      throw new Error(result.message || 'Selected backup restore failed');
    }

    try {
      if (typeof AuraRestore.checkpointWal === 'function') {
        await AuraRestore.checkpointWal();
      }
    } catch (_) {}

    await this.resyncStoresAfterRestore(result.clientSettingsJson);

    return {
      success: true,
      message: result.message || 'Backup restored successfully from selected file.',
      timestamp: Date.now(),
    };
  }

  static async requestManageStoragePermission(): Promise<boolean> {
    if (!AuraRestore || typeof AuraRestore.requestManageStoragePermission !== 'function') {
      return false;
    }
    return await AuraRestore.requestManageStoragePermission();
  }

  static async isStorageManagerGranted(): Promise<boolean> {
    if (!AuraRestore || typeof AuraRestore.isStorageManagerGranted !== 'function') {
      return true;
    }
    return await AuraRestore.isStorageManagerGranted();
  }

  /**
   * Collects client preferences and state to bundle into the JSON backup.
   */
  private static gatherClientPayload() {
    const settings = useSettingsStore.getState();
    const likes = useLikesStore.getState();
    const taste = useTasteProfileStore.getState();

    return {
      settings: {
        streamingQualityWifi: settings.streamingQualityWifi,
        streamingQualityCellular: settings.streamingQualityCellular,
        downloadQualityWifi: settings.downloadQualityWifi,
        downloadQualityCellular: settings.downloadQualityCellular,
        downloadOnlyOnWifi: settings.downloadOnlyOnWifi,
        autoDownloadLikedSongs: settings.autoDownloadLikedSongs,
        normalizeVolume: settings.normalizeVolume,
        autoplayEnabled: settings.autoplayEnabled,
        smartShuffleEnabled: settings.smartShuffleEnabled,
        maxSongCacheGB: settings.maxSongCacheGB,
        reduceMotion: settings.reduceMotion,
        accentColor: settings.accentColor,
        hapticsEnabled: settings.hapticsEnabled,
        localAutoBackupEnabled: settings.localAutoBackupEnabled,
      },
      likedTrackIds: likes.likedTrackIds || {},
      likedAt: likes.likedAt || {},
      likedMetadata: likes.trackMetadata || {},
      tasteProfile: {
        name: taste.name,
        favoriteArtists: taste.favoriteArtists,
        songLanguages: taste.songLanguages,
        genres: taste.genres,
        onboardingCompleted: taste.onboardingCompleted,
      },
    };
  }

  /**
   * Refreshes client-side Zustand stores after a database import.
   */
  private static async resyncStoresAfterRestore(clientSettingsJson?: string) {
    try {
      // 1. Re-initialize playlists from Room
      await usePlaylistStore.getState().initialize();
      console.info('[LocalBackupService] Playlists store resynchronized');
    } catch (e) {
      console.warn('[LocalBackupService] Failed to resync playlists store:', e);
    }

    try {
      // 2. Re-initialize analytics / history from Room
      await useAnalyticsStore.getState().initialize();
      console.info('[LocalBackupService] Analytics store resynchronized');
    } catch (e) {
      console.warn('[LocalBackupService] Failed to resync analytics store:', e);
    }

    // 3. Unpack client settings, likes, and taste profile if available
    if (clientSettingsJson) {
      try {
        const clientData = JSON.parse(clientSettingsJson);

        // Restore Settings
        if (clientData.settings) {
          useSettingsStore.getState().restoreSettings(clientData.settings);
          console.info('[LocalBackupService] Settings store resynchronized');
        }

        // Restore Likes
        if (clientData.likedTrackIds) {
          useLikesStore.getState().restoreLikes(
            clientData.likedTrackIds,
            clientData.likedAt || {},
            clientData.likedMetadata || {}
          );
          console.info('[LocalBackupService] Likes store resynchronized');
        }

        // Restore Taste Profile
        if (clientData.tasteProfile) {
          const tp = clientData.tasteProfile;
          await useTasteProfileStore.getState().markCompletedFromRestore({
            name: tp.name || 'Music Lover',
            favoriteArtists: tp.favoriteArtists || [],
            songLanguages: tp.songLanguages || [],
            genres: tp.genres || [],
            onboardingCompleted: true,
          });
          console.info('[LocalBackupService] Taste profile restored and marked completed');
        }
      } catch (e) {
        console.warn('[LocalBackupService] Failed to unpack restored client settings:', e);
      }
    } else {
      try {
        // Fallback: ensure taste profile is marked completed if it was not completed
        const taste = useTasteProfileStore.getState();
        if (!taste.onboardingCompleted) {
          await taste.markCompletedFromRestore();
        }
      } catch (e) {
        console.warn('[LocalBackupService] Failed to update taste profile state:', e);
      }
    }
  }
}
