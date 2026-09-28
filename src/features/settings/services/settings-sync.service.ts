import { AuraPlayer, AuraDownload } from '../../../services/native-core';
import { useSettingsStore } from '../store/settings.store';
import { useDeviceStateStore } from '../../device/store/device-state.store';

export class SettingsSyncService {
  private static isInitialized = false;

  /**
   * Synchronizes all user settings with native Kotlin engines (AuraPlayer, AuraDownload, Media3).
   */
  static async syncAll() {
    try {
      const settings = useSettingsStore.getState();
      const device = useDeviceStateStore.getState();

      // 1. Streaming Quality (Wi-Fi vs Cellular)
      const streamingQuality = device.isWifi
        ? settings.streamingQualityWifi
        : settings.streamingQualityCellular;
      if (AuraPlayer && typeof AuraPlayer.setStreamingQualityConfig === 'function') {
        await AuraPlayer.setStreamingQualityConfig(
          settings.streamingQualityWifi,
          settings.streamingQualityCellular
        );
      } else if (AuraPlayer && typeof AuraPlayer.setStreamingQuality === 'function') {
        await AuraPlayer.setStreamingQuality(streamingQuality);
      }

      // 2. Download Quality (Wi-Fi vs Cellular)
      const downloadQuality = device.isWifi
        ? settings.downloadQualityWifi
        : settings.downloadQualityCellular;
      if (AuraDownload && typeof AuraDownload.setDownloadQuality === 'function') {
        await AuraDownload.setDownloadQuality(downloadQuality);
      }

      // 3. Wi-Fi-Only Download Constraint
      if (AuraDownload && typeof AuraDownload.setWifiOnly === 'function') {
        await AuraDownload.setWifiOnly(settings.downloadOnlyOnWifi);
      }

      // 4. Maximum Streaming Cache Size
      let cacheBytes = 512 * 1024 * 1024; // default 512MB
      if (settings.maxSongCacheGB === 2) cacheBytes = 2 * 1024 * 1024 * 1024;
      else if (settings.maxSongCacheGB === 5) cacheBytes = 5 * 1024 * 1024 * 1024;
      else if (settings.maxSongCacheGB === 10) cacheBytes = 10 * 1024 * 1024 * 1024;
      else if (settings.maxSongCacheGB === null || settings.maxSongCacheGB === 0) cacheBytes = 0; // Unlimited

      if (AuraPlayer && typeof AuraPlayer.setCacheLimit === 'function') {
        await AuraPlayer.setCacheLimit(cacheBytes);
      }

      // 5. Google Account Sync Preference
      const { AuraRestore } = await import('@/src/services/native-core');
      if (AuraRestore && typeof AuraRestore.setGoogleSyncEnabled === 'function') {
        await AuraRestore.setGoogleSyncEnabled(settings.googleSyncEnabled ?? true);
      }

      // 6. Loudness Normalization
      if (AuraPlayer && typeof AuraPlayer.setNormalizeVolume === 'function') {
        await AuraPlayer.setNormalizeVolume(settings.normalizeVolume ?? true);
      }

      console.log('[SettingsSync] Synced all settings to native successfully:', {
        streamingQuality,
        downloadQuality,
        wifiOnly: settings.downloadOnlyOnWifi,
        cacheBytes,
        googleSyncEnabled: settings.googleSyncEnabled ?? true,
        normalizeVolume: settings.normalizeVolume ?? true,
      });
    } catch (error) {
      console.warn('[SettingsSync] Error syncing settings to native:', error);
    }
  }

  static async syncGoogleSync(enabled: boolean): Promise<void> {
    try {
      const { AuraRestore } = await import('@/src/services/native-core');
      if (AuraRestore && typeof AuraRestore.setGoogleSyncEnabled === 'function') {
        await AuraRestore.setGoogleSyncEnabled(enabled);
        console.log('[SettingsSync] Synced googleSyncEnabled to native:', enabled);
      }
    } catch (error) {
      console.warn('[SettingsSync] Error syncing googleSyncEnabled:', error);
    }
  }

  static async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Deterministic hydration barrier: await restored settings from AsyncStorage
    const { ensureSettingsHydrated } = await import('../store/settings.store');
    await ensureSettingsHydrated();

    // Initial sync after hydration is guaranteed
    await this.syncAll();

    // Re-sync when network state changes
    useDeviceStateStore.subscribe((state, prevState) => {
      if (state.connectionType !== prevState.connectionType || state.isWifi !== prevState.isWifi) {
        this.syncAll();
      }
    });
  }
}
