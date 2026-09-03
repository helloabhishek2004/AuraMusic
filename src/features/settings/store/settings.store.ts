import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AudioQuality = 'low' | 'normal' | 'high' | 'best';

export interface SettingsState {
  // STREAMING
  streamingQualityWifi: AudioQuality;
  streamingQualityCellular: AudioQuality;

  // DOWNLOADS
  downloadQualityWifi: AudioQuality;
  downloadQualityCellular: AudioQuality;
  downloadOnlyOnWifi: boolean;
  autoDownloadLikedSongs: boolean;

  // PLAYBACK
  crossfadeEnabled: boolean;
  crossfadeDuration: number; // 0–12
  gaplessPlayback: boolean;
  normalizeVolume: boolean;
  autoplayEnabled: boolean;
  smartShuffleEnabled: boolean;

  // STORAGE
  maxSongCacheGB: number | 'unlimited';

  // UI
  reduceMotion: boolean;
  accentColor: string;

  // CLOUD BACKUP & SYNC
  googleSyncEnabled: boolean;

  // ACTIONS
  setStreamingQuality: (type: 'wifi' | 'cellular', quality: AudioQuality) => void;
  setDownloadQuality: (type: 'wifi' | 'cellular', quality: AudioQuality) => void;
  toggleSetting: (key: keyof Omit<SettingsState, 'streamingQualityWifi' | 'streamingQualityCellular' | 'downloadQualityWifi' | 'downloadQualityCellular' | 'crossfadeDuration' | 'maxSongCacheGB' | 'accentColor' | 'setStreamingQuality' | 'setDownloadQuality' | 'toggleSetting' | 'setCrossfadeDuration' | 'setMaxSongCache' | 'setAccentColor' | 'setGoogleSyncEnabled'>) => void;
  setCrossfadeDuration: (duration: number) => void;
  setMaxSongCache: (limit: number | 'unlimited') => void;
  setAccentColor: (color: string) => void;
  setGoogleSyncEnabled: (enabled: boolean) => void;
}

let _settingsHydrated = false;
let _resolveSettingsHydrated: () => void = () => {};
const _settingsHydrationPromise = new Promise<void>((resolve) => {
  _resolveSettingsHydrated = resolve;
});

export function isSettingsHydrated(): boolean {
  return _settingsHydrated;
}

export function ensureSettingsHydrated(): Promise<void> {
  if (_settingsHydrated) return Promise.resolve();
  return _settingsHydrationPromise;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default values
      streamingQualityWifi: 'high',
      streamingQualityCellular: 'normal',
      downloadQualityWifi: 'best',
      downloadQualityCellular: 'high',
      downloadOnlyOnWifi: true,
      autoDownloadLikedSongs: false,
      crossfadeEnabled: false,
      crossfadeDuration: 3,
      gaplessPlayback: true,
      normalizeVolume: true,
      autoplayEnabled: true,
      smartShuffleEnabled: true,
      maxSongCacheGB: 5,
      reduceMotion: false,
      accentColor: '#B19CD9',
      googleSyncEnabled: true,

      // Actions
      setStreamingQuality: (type, quality) => {
        if (type === 'wifi') set({ streamingQualityWifi: quality });
        else set({ streamingQualityCellular: quality });
        try {
          const { SettingsSyncService } = require('../services/settings-sync.service');
          SettingsSyncService.syncAll();
        } catch (_) {}
      },
      setDownloadQuality: (type, quality) => {
        if (type === 'wifi') set({ downloadQualityWifi: quality });
        else set({ downloadQualityCellular: quality });
        try {
          const { SettingsSyncService } = require('../services/settings-sync.service');
          SettingsSyncService.syncAll();
        } catch (_) {}
      },
      toggleSetting: (key) => set((state: any) => {
        const newValue = !state[key];
        const updates: any = { [key]: newValue };
        
        // Mutual Exclusivity: Crossfade vs Gapless
        if (key === 'crossfadeEnabled' && newValue === true) {
          updates.gaplessPlayback = false;
        } else if (key === 'gaplessPlayback' && newValue === true) {
          updates.crossfadeEnabled = false;
        }

        // Auto-download liked songs backfill
        if (key === 'autoDownloadLikedSongs' && newValue === true) {
          try {
            const { useLikesStore } = require('../../likes/store/likes.store');
            useLikesStore.getState().backfillAutoDownloads();
          } catch (_) {}
        }
        
        setTimeout(() => {
          try {
            const { SettingsSyncService } = require('../services/settings-sync.service');
            SettingsSyncService.syncAll();
          } catch (_) {}
        }, 0);

        return updates;
      }),
      setCrossfadeDuration: (duration) => set({ 
          crossfadeDuration: duration,
          gaplessPlayback: duration > 0 ? false : true 
      }),
      setMaxSongCache: (limit) => {
        set({ maxSongCacheGB: limit });
        try {
          const { SettingsSyncService } = require('../services/settings-sync.service');
          SettingsSyncService.syncAll();
        } catch (_) {}
      },
      setAccentColor: (color) => set({ accentColor: color }),
      setGoogleSyncEnabled: (enabled) => {
        set({ googleSyncEnabled: enabled });
        try {
          const { SettingsSyncService } = require('../services/settings-sync.service');
          SettingsSyncService.syncGoogleSync(enabled);
        } catch (_) {}
      },
    }),
    {
      name: 'aura-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.warn('[AuraRestore] Settings hydration error:', error);
          } else {
            console.info('[AuraRestore] Settings hydration complete');
          }
          _settingsHydrated = true;
          _resolveSettingsHydrated();
          try {
            const { SettingsSyncService } = require('../services/settings-sync.service');
            SettingsSyncService.syncAll();
          } catch (_) {}
        };
      },
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Perform migrations if needed
        }
        return persistedState as SettingsState;
      },
    }
  )
);
