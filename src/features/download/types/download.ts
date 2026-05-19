import { PlayerTrack } from "../../player/types/player";

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';

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

export interface DownloadState {
  downloadedTracks: Record<string, DownloadedTrack>;
  downloadQueue: string[];
  activeTasks: Record<string, DownloadTask>;
  notification: DownloadNotification | null;
}

export interface DownloadActions {
  addDownload: (track: PlayerTrack) => void;
  pauseDownload: (trackId: string) => void;
  resumeDownload: (trackId: string) => void;
  cancelDownload: (trackId: string) => void;
  removeDownload: (trackId: string) => Promise<void>;
  updateProgress: (trackId: string, progress: number) => void;
  updateStatus: (trackId: string, status: DownloadStatus, error?: string) => void;
  setDownloaded: (track: DownloadedTrack) => void;
  clearFailed: () => void;
  setDownloadNotification: (notification: DownloadNotification | null) => void;
}

export type DownloadStore = DownloadState & DownloadActions;
