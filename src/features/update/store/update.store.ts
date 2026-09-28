import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UpdateService } from '../services/update.service';
import { ParsedReleaseInfo } from '../utils/release-notes-parser';
import { getInstalledAppVersion } from '../utils/app-version';

export type UpdatePhase =
  | 'IDLE'
  | 'CHECKING'
  | 'UP_TO_DATE'
  | 'UPDATE_AVAILABLE'
  | 'DOWNLOADING'
  | 'READY_TO_INSTALL'
  | 'INSTALLING'
  | 'COMPLETE'
  | 'ERROR';

export interface UpdateDownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedText: string;
}

export interface UpdateState {
  phase: UpdatePhase;
  installedVersion: string;
  releaseInfo: ParsedReleaseInfo | null;
  hasUpdate: boolean;
  isChecking: boolean;
  lastCheckedTimestamp: number | null;
  errorMessage: string | null;
  dismissedTag: string | null;

  // Download state
  downloadProgress: UpdateDownloadProgress;
  downloadedApkUri: string | null;

  // Actions
  checkForUpdates: (force?: boolean) => Promise<void>;
  startDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissNotification: () => void;
  markComplete: () => void;
  setSimulatedPhase: (phase: UpdatePhase) => void;
}

// Minimum duration between automated background checks (4 hours)
const AUTO_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export const useUpdateStore = create<UpdateState>()(
  persist(
    (set, get) => ({
      phase: 'IDLE',
      installedVersion: getInstalledAppVersion(),
      releaseInfo: null,
      hasUpdate: false,
      isChecking: false,
      lastCheckedTimestamp: null,
      errorMessage: null,
      dismissedTag: null,
      downloadProgress: {
        bytesDownloaded: 0,
        totalBytes: 0,
        percentage: 0,
        speedText: '0 MB/s',
      },
      downloadedApkUri: null,

      checkForUpdates: async (force = false) => {
        const state = get();
        const now = Date.now();

        // If not forced and recently checked within 4 hours, avoid spamming GitHub
        if (!force && state.lastCheckedTimestamp && now - state.lastCheckedTimestamp < AUTO_CHECK_INTERVAL_MS) {
          return;
        }

        if (state.isChecking) return;

        set({ isChecking: true, errorMessage: null });
        if (state.phase === 'IDLE' || force) {
          set({ phase: 'CHECKING' });
        }

        try {
          const result = await UpdateService.checkForLatestRelease();

          if (result.error && !result.releaseInfo) {
            set({
              isChecking: false,
              errorMessage: result.error,
              phase: 'ERROR',
            });
            return;
          }

          const hasUpdate = result.hasUpdate;
          set({
            isChecking: false,
            hasUpdate,
            installedVersion: result.installedVersion,
            releaseInfo: result.releaseInfo,
            lastCheckedTimestamp: now,
            errorMessage: null,
            phase: hasUpdate ? 'UPDATE_AVAILABLE' : 'UP_TO_DATE',
          });
        } catch (err: any) {
          set({
            isChecking: false,
            errorMessage: err?.message || 'Failed to check for updates',
            phase: 'ERROR',
          });
        }
      },

      startDownload: async () => {
        const { releaseInfo } = get();
        if (!releaseInfo || !releaseInfo.apkAsset) {
          set({ errorMessage: 'No APK package available for this release', phase: 'ERROR' });
          return;
        }

        set({
          phase: 'DOWNLOADING',
          downloadProgress: {
            bytesDownloaded: 0,
            totalBytes: releaseInfo.apkAsset.sizeBytes,
            percentage: 0,
            speedText: 'Connecting...',
          },
          errorMessage: null,
        });

        let lastTime = Date.now();
        let lastBytes = 0;

        try {
          const uri = await UpdateService.startApkDownload(
            releaseInfo.apkAsset.downloadUrl,
            releaseInfo.apkAsset.name,
            ({ bytesDownloaded, totalBytes, percentage }) => {
              const now = Date.now();
              const dt = (now - lastTime) / 1000;
              let speedText = 'Downloading...';
              if (dt >= 0.5) {
                const diffBytes = bytesDownloaded - lastBytes;
                const bytesPerSec = diffBytes / dt;
                const mbPerSec = (bytesPerSec / (1024 * 1024)).toFixed(1);
                speedText = `${mbPerSec} MB/s`;
                lastTime = now;
                lastBytes = bytesDownloaded;
              }

              set({
                downloadProgress: {
                  bytesDownloaded,
                  totalBytes,
                  percentage,
                  speedText,
                },
              });
            }
          );

          set({
            downloadedApkUri: uri,
            phase: 'READY_TO_INSTALL',
            downloadProgress: {
              ...get().downloadProgress,
              percentage: 100,
            },
          });
        } catch (err: any) {
          console.error('[UpdateStore] Download error:', err);
          set({
            errorMessage: err?.message || 'Download failed',
            phase: 'ERROR',
          });
        }
      },

      cancelDownload: async () => {
        await UpdateService.cancelDownload();
        const hasUpdate = get().hasUpdate;
        set({
          phase: hasUpdate ? 'UPDATE_AVAILABLE' : 'IDLE',
          downloadProgress: {
            bytesDownloaded: 0,
            totalBytes: 0,
            percentage: 0,
            speedText: '0 MB/s',
          },
        });
      },

      installUpdate: async () => {
        const { downloadedApkUri } = get();
        if (!downloadedApkUri) {
          set({ errorMessage: 'Update package not found. Please re-download.', phase: 'ERROR' });
          return;
        }

        set({ phase: 'INSTALLING' });
        try {
          await UpdateService.installApk(downloadedApkUri);
          // Android will take over and display the system package installer.
          // When the user returns to the app, it will either be running the new version
          // or remain ready to install.
        } catch (err: any) {
          set({
            errorMessage: err?.message || 'Failed to launch installer',
            phase: 'ERROR',
          });
        }
      },

      dismissNotification: () => {
        const { releaseInfo } = get();
        set({ dismissedTag: releaseInfo?.tag ?? null });
      },

      markComplete: () => {
        set({ phase: 'COMPLETE' });
      },

      setSimulatedPhase: (phase: UpdatePhase) => {
        // Only enabled in dev builds
        set({ phase });
      },
    }),
    {
      name: '@auramusic_update_store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastCheckedTimestamp: state.lastCheckedTimestamp,
        dismissedTag: state.dismissedTag,
        releaseInfo: state.releaseInfo,
        hasUpdate: state.hasUpdate,
      }),
    }
  )
);
