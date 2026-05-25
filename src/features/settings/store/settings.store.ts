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
  monoAudio: boolean;

  // STORAGE
  maxSongCacheGB: number | 'unlimited';

  // UI
  reduceMotion: boolean;
  accentColor: string;

  // ACTIONS
  setStreamingQuality: (type: 'wifi' | 'cellular', quality: AudioQuality) => void;
  setDownloadQuality: (type: 'wifi' | 'cellular', quality: AudioQuality) => void;
  toggleSetting: (key: keyof Omit<SettingsState, 'streamingQualityWifi' | 'streamingQualityCellular' | 'downloadQualityWifi' | 'downloadQualityCellular' | 'crossfadeDuration' | 'maxSongCacheGB' | 'accentColor' | 'setStreamingQuality' | 'setDownloadQuality' | 'toggleSetting' | 'setCrossfadeDuration' | 'setMaxSongCache' | 'setAccentColor'>) => void;
  setCrossfadeDuration: (duration: number) => void;
  setMaxSongCache: (limit: number | 'unlimited') => void;
  setAccentColor: (color: string) => void;
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
      crossfadeDuration: 6,
      gaplessPlayback: true,
      normalizeVolume: true,
      monoAudio: false,
      maxSongCacheGB: 5,
      reduceMotion: false,
      accentColor: '#B19CD9',

      // Actions
      setStreamingQuality: (type, quality) => {
        if (type === 'wifi') set({ streamingQualityWifi: quality });
        else set({ streamingQualityCellular: quality });
      },
      setDownloadQuality: (type, quality) => {
        if (type === 'wifi') set({ downloadQualityWifi: quality });
        else set({ downloadQualityCellular: quality });
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
        
        return updates;
      }),
      setCrossfadeDuration: (duration) => set({ 
          crossfadeDuration: duration,
          gaplessPlayback: duration > 0 ? false : true 
      }),
      setMaxSongCache: (limit) => set({ maxSongCacheGB: limit }),
      setAccentColor: (color) => set({ accentColor: color }),
    }),
    {
      name: 'aura-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Perform migrations if needed
        }
        return persistedState as SettingsState;
      },
    }
  )
);
