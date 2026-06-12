import { PlayerTrack } from "../../player/types/player";

export type DownloadStatus = 'queued' | 'preparing' | 'downloading' | 'verifying' | 'paused' | 'completed' | 'failed';

export interface DownloadedTrack extends PlayerTrack {
  localAudioPath: string;
  localArtPath: string;
  downloadedAt: number;
  fileSize?: number;
}

export interface DownloadTask {
  track: PlayerTrack;
  status: DownloadStatus;
  progress: number;
  error?: string;
  retryCount: number;
}

export interface DownloadNotification {
  isVisible: boolean;
  title: string;
  progress: number;
  activeCount: number;
  remaining: number;
  isComplete?: boolean;
}

export interface DownloadQueueItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  artwork?: string;
  status: DownloadStatus;
  progress: number;
  fileSize?: number;
  downloadedBytes?: number;
  retryCount: number;
  error?: string;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  speedBytesPerSecond?: number;
  estimatedTimeRemaining?: number;
  lastAttemptAt?: number;
  lastError?: string;
  downloadUrl?: string;
}

export interface DownloadState {
  downloadedTracks: Record<string, DownloadedTrack>;
  downloadQueue: string[]; // backward-compatible
  activeTasks: Record<string, DownloadTask>; // backward-compatible
  queue: DownloadQueueItem[];
  activeDownloads: number;
  maxConcurrentDownloads: number;
  isQueuePaused: boolean;
  notification: DownloadNotification | null;

  // Telemetry
  downloadsStarted: number;
  downloadsCompleted: number;
  downloadsFailed: number;
  averageDownloadSpeed: number;
  averageCompletionTime: number;
}

export interface DownloadActions {
  addDownload: (track: PlayerTrack) => void;
  enqueueDownload: (track: PlayerTrack, priority?: 'HIGH' | 'NORMAL' | 'LOW') => DownloadQueueItem | undefined;
  enqueueAlbum: (albumId: string) => Promise<void>;
  enqueuePlaylist: (playlistId: string) => Promise<void>;
  pauseDownload: (trackId: string) => void;
  resumeDownload: (trackId: string) => void;
  cancelDownload: (trackId: string) => void;
  removeDownload: (trackId: string) => Promise<void>;
  updateProgress: (
    trackId: string,
    progressRatio: number,
    downloadedBytes?: number,
    fileSize?: number,
    speedBytesPerSecond?: number,
    estimatedTimeRemaining?: number
  ) => void;
  updateStatus: (trackId: string, status: DownloadStatus, error?: string) => void;
  setDownloaded: (track: DownloadedTrack) => void;
  clearFailed: () => void;
  clearCompleted: () => void;
  retryDownload: (trackId: string) => void;
  setDownloadNotification: (notification: DownloadNotification | null) => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
  updateTelemetry: (type: 'started' | 'completed' | 'failed', speed?: number, completionTime?: number) => void;
}

export type DownloadStore = DownloadState & DownloadActions;

