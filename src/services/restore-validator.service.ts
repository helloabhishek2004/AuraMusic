import { AuraRestore, AuraDownload } from './native-core';
import { ensureSettingsHydrated } from '../features/settings/store/settings.store';
import { SettingsSyncService } from '../features/settings/services/settings-sync.service';
import { PermissionPromptService } from './permission-prompt.service';
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

    // 3. Permission Reconciliation: Query OS directly
    try {
      await PermissionPromptService.requestInitialPermissionsIfNeeded();
      console.info('[AuraRestore] Permissions verified against Android OS.');
    } catch (e) {
      console.warn('[AuraRestore] Permission check error:', e);
    }

    // 4. Download State Reconciliation (Physical vs Logical)
    let repairedCount = 0;
    if (AuraDownload) {
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

    // 6. Analytics & Recommendation Signal Regeneration
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

    // 7. Checkpoint SQLite WAL safely to guarantee durable persistence
    if (AuraRestore) {
      try {
        await AuraRestore.checkpointWal();
      } catch (e) {
        console.warn('[AuraRestore] Post-validation WAL checkpoint note:', e);
      }
    }

    // 8. Mark installation initialized in context.noBackupFilesDir
    if (AuraRestore) {
      try {
        await AuraRestore.markInstallInitialized();
        console.info('[AuraRestore] Installation marker confirmed.');
      } catch (e) {
        console.warn('[AuraRestore] Failed to mark installation initialized:', e);
      }
    }

    console.info('[AuraRestore] Startup validation & reconciliation complete.');
  }
}
