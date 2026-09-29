import { AuraRestore, AuraDownload } from './native-core';
import { ensureSettingsHydrated } from '../features/settings/store/settings.store';
import { SettingsSyncService } from '../features/settings/services/settings-sync.service';
import { useDownloadStore } from '../features/download/store/download.store';
import { useAnalyticsStore } from '../features/analytics/store/analytics.store';
import { useRecommendationsStore } from '../features/recommendations/store/recommendations.store';

export interface RestoreNotice {
  isRestored: boolean;
  missingDownloadsCount: number;
  message: string | null;
}

export class RestoreValidatorService {
  private static isInitialized = false;
  private static restoreNotice: RestoreNotice = {
    isRestored: false,
    missingDownloadsCount: 0,
    message: null,
  };
  private static listeners: Set<(notice: RestoreNotice) => void> = new Set();

  static getNotice(): RestoreNotice {
    return this.restoreNotice;
  }

  static subscribe(listener: (notice: RestoreNotice) => void): () => void {
    this.listeners.add(listener);
    listener(this.restoreNotice);
    return () => this.listeners.delete(listener);
  }

  static dismissNotice(): void {
    this.restoreNotice = {
      ...this.restoreNotice,
      message: null,
    };
    this.notifyListeners();
  }

  private static notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.restoreNotice);
      } catch (e) {
        console.warn('[AuraRestore] Error in restore notice listener:', e);
      }
    });
  }

  /**
   * Deterministic startup restoration and validation pipeline.
   * Idempotent: safe to run on every launch, but only acts when appropriate.
   */
  static async runStartupValidation(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.info('[AuraRestore] Starting startup validation & reconciliation...');

    let isRestored = false;
    let isFresh = false;

    // 1. Detect whether installation was restored via Google Backup
    if (AuraRestore) {
      try {
        const detection = await AuraRestore.isRestoredInstall();
        isRestored = detection.isRestored;
        isFresh = detection.isFreshInstall;
        console.info('[AuraRestore] Install status:', {
          isRestored,
          isFreshInstall: isFresh,
          markerExists: detection.markerExists,
          hasDurableData: detection.hasDurableData,
        });
      } catch (e) {
        console.warn('[AuraRestore] Failed to query native restore detector:', e);
      }
    }

    // 2. Hydration Barrier: Ensure settings are fully hydrated from AsyncStorage
    try {
      await ensureSettingsHydrated();
      await SettingsSyncService.initialize();
      console.info('[AuraRestore] Settings hydrated and synced to native engines.');
    } catch (e) {
      console.warn('[AuraRestore] Settings hydration error:', e);
    }

    // 3. Permission Reconciliation: Permissions are requested strictly contextually when relevant features are accessed in Home
    // Zero runtime permissions are prompted on startup or during onboarding

    // 4. Download State Reconciliation (Physical vs Logical)
    // ONLY executed on actual cloud restore to recover from missing physical media
    let repairedCount = 0;
    if (isRestored && AuraDownload) {
      try {
        const reconcileResult = await AuraDownload.reconcileDownloads();
        repairedCount = reconcileResult.repairedCount;
        if (repairedCount > 0) {
          console.info(`[AuraRestore] Download reconciliation repaired ${repairedCount} missing tracks.`);
          
          // Purge repaired missing tracks from Zustand download store
          const currentTracks = { ...useDownloadStore.getState().downloadedTracks };
          for (const trackId of reconcileResult.missingTrackIds) {
            delete currentTracks[trackId];
          }
          useDownloadStore.setState({ downloadedTracks: currentTracks });
        }
      } catch (e) {
        console.warn('[AuraRestore] Download reconciliation error:', e);
      }
    }

    // 5. If this was a restored install and offline files are missing, inform the user truthfully
    if (isRestored && repairedCount > 0) {
      this.restoreNotice = {
        isRestored: true,
        missingDownloadsCount: repairedCount,
        message: `Your library was restored. ${repairedCount} offline download${repairedCount > 1 ? 's' : ''} need to be downloaded again.`,
      };
      this.notifyListeners();
    }

    // 6. Analytics & Recommendation Signal Regeneration (Only on restored install; normal launches defer this to idle)
    if (isRestored) {
      try {
        await useAnalyticsStore.getState().initialize();
        console.info('[AuraRestore] Analytics affinities rebuilt from Room history.');
      } catch (e) {
        console.warn('[AuraRestore] Analytics affinity rebuild error:', e);
      }

      try {
        const recStore = useRecommendationsStore.getState();
        if (typeof recStore.generateRecommendations === 'function') {
          await recStore.generateRecommendations();
          console.info('[AuraRestore] Fresh recommendations generated from restored signals.');
        }
      } catch (e) {
        console.warn('[AuraRestore] Recommendation generation error:', e);
      }
    }

    // 7. Checkpoint SQLite WAL safely to guarantee durable persistence (Only on restored install)
    if (isRestored && AuraRestore) {
      try {
        await AuraRestore.checkpointWal();
      } catch (e) {
        console.warn('[AuraRestore] Post-validation WAL checkpoint note:', e);
      }
    }

    console.info('[AuraRestore] Startup validation & reconciliation complete.');
  }

  /**
   * Manually trigger full restoration and validation pipeline from Settings.
   * Can be invoked by the user at any time to re-synchronize local state with backup data.
   */
  static async triggerManualRestore(): Promise<{
    success: boolean;
    repairedCount: number;
    dbBytes?: number;
    message: string;
  }> {
    console.info('[AuraRestore] Manual restore initiated by user.');
    let repairedCount = 0;
    let dbBytes = 0;

    // 1. Native restore sync & notification
    if (AuraRestore && typeof AuraRestore.triggerManualRestore === 'function') {
      try {
        const nativeRes = await AuraRestore.triggerManualRestore();
        dbBytes = nativeRes.dbBytes || 0;
      } catch (e) {
        console.warn('[AuraRestore] Native manual restore notice:', e);
      }
    }

    // 2. Hydrate & Sync Settings
    try {
      await ensureSettingsHydrated();
      await SettingsSyncService.initialize();
      console.info('[AuraRestore] Settings re-hydrated and synced to native engines.');
    } catch (e) {
      console.warn('[AuraRestore] Settings hydration error during manual restore:', e);
    }

    // 3. Re-initialize playlists from Room DB
    try {
      const { usePlaylistStore } = await import('../features/playlist/store/playlist.store');
      await usePlaylistStore.getState().initialize();
      console.info('[AuraRestore] Playlists re-synchronized from Room database.');
    } catch (e) {
      console.warn('[AuraRestore] Playlist store re-sync error:', e);
    }

    // 4. Download State Reconciliation (Physical vs Logical)
    if (AuraDownload) {
      try {
        const reconcileResult = await AuraDownload.reconcileDownloads();
        repairedCount = reconcileResult.repairedCount;
        if (repairedCount > 0) {
          console.info(`[AuraRestore] Manual restore repaired ${repairedCount} missing download tracks.`);
          const currentTracks = { ...useDownloadStore.getState().downloadedTracks };
          for (const trackId of reconcileResult.missingTrackIds) {
            delete currentTracks[trackId];
          }
          useDownloadStore.setState({ downloadedTracks: currentTracks });
        }
      } catch (e) {
        console.warn('[AuraRestore] Download reconciliation error during manual restore:', e);
      }
    }

    // 5. Rebuild Analytics affinities and regenerate fresh recommendations
    try {
      await useAnalyticsStore.getState().initialize();
      console.info('[AuraRestore] Analytics affinities refreshed.');
    } catch (e) {
      console.warn('[AuraRestore] Analytics refresh error during manual restore:', e);
    }

    try {
      const recStore = useRecommendationsStore.getState();
      if (typeof recStore.generateRecommendations === 'function') {
        await recStore.generateRecommendations();
        console.info('[AuraRestore] Fresh recommendations generated from restored signals.');
      }
    } catch (e) {
      console.warn('[AuraRestore] Recommendations generation error during manual restore:', e);
    }

    // 5b. Re-synchronize Music Taste Profile & Preference Priors
    try {
      const { ensureTasteProfileHydrated, useTasteProfileStore } = await import('../features/taste-profile/store/taste-profile.store');
      await ensureTasteProfileHydrated();
      const tasteStore = useTasteProfileStore.getState();
      if (tasteStore.favoriteArtists.length > 0 || tasteStore.songLanguages.length > 0) {
        await tasteStore.markCompletedFromRestore();
        console.info('[AuraRestore] Taste profile re-synchronized from backup.');
      }
    } catch (e) {
      console.warn('[AuraRestore] Taste profile sync error during manual restore:', e);
    }

    // 6. Checkpoint SQLite WAL safely to guarantee durable persistence
    if (AuraRestore) {
      try {
        await AuraRestore.checkpointWal();
      } catch (e) {
        console.warn('[AuraRestore] Post-restore WAL checkpoint notice:', e);
      }
    }

    // 7. Update notice if any downloads were missing
    if (repairedCount > 0) {
      this.restoreNotice = {
        isRestored: true,
        missingDownloadsCount: repairedCount,
        message: `Library re-synced. ${repairedCount} offline download${repairedCount > 1 ? 's' : ''} need to be downloaded again.`,
      };
      this.notifyListeners();
    }

    const message = repairedCount > 0
      ? `Library, playlists, and settings re-synchronized. ${repairedCount} missing download${repairedCount > 1 ? 's were' : ' was'} reconciled.`
      : 'Your library, playlists, listening history, and preferences are fully synchronized.';

    return {
      success: true,
      repairedCount,
      dbBytes,
      message,
    };
  }
}
