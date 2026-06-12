import { MusicTrack } from '@/src/types/music';

export interface LocalTrack extends Omit<MusicTrack, 'duration'> {
  duration?: string | number;
  fileSize: number;
  addedAt: number;
  bitrate?: number;
  sampleRate?: number;
  exists: boolean;
}

export type ScanMode = 'startup' | 'download' | 'manual' | 'full';

export type ScanStage = 'idle' | 'loading' | 'grouping' | 'analyzing' | 'completed';

export interface DuplicateGroup {
  id: string;
  confidence: number;
  reason: 'exact' | 'metadata' | 'duration';
  tracks: LocalTrack[];
  recommendedTrackId: string;
  severity: 'low' | 'medium' | 'high';
}

export interface LibraryHealthReport {
  totalTracks: number;
  duplicateTracks: number;
  duplicateGroups: number;
  storageWasteBytes: number;
  generatedAt: number;
  libraryHash: string;
  healthScore: number; // 0 to 100
}

export interface PendingDeletion {
  groupId: string;
  trackId: string;
  filePath: string;
  isDownload: boolean;
  mediaAssetId?: string;
}

export interface HealthHistoryEntry {
  timestamp: number;
  score: number;
}

export interface LibraryHealthState {
  healthReport: LibraryHealthReport | null;
  duplicateGroups: DuplicateGroup[];
  ignoredDuplicateGroups: string[];
  healthHistory: HealthHistoryEntry[];
  lastScanAt: number;
  libraryHash: string;
  isScanning: boolean;
  scanProgress: number; // 0 to 100
  scanStage: ScanStage;
  pendingDeletions: PendingDeletion[];
  undoExpiresAt: number | null;
  duplicateIndex: Record<string, string[]>;
  telemetry: {
    duplicatesFound: number;
    duplicatesRemoved: number;
    storageRecovered: number;
  };
}

export interface LibraryHealthActions {
  setScanningState: (isScanning: boolean, scanProgress: number, scanStage: ScanStage) => void;
  setScanResult: (report: LibraryHealthReport, groups: DuplicateGroup[], lastScanAt: number, libraryHash: string) => void;
  setDuplicateIndex: (index: Record<string, string[]>) => void;
  ignoreGroup: (groupId: string) => void;
  registerPendingDeletions: (deletions: PendingDeletion[], timeoutMs: number) => void;
  clearPendingDeletions: () => void;
  clearScanCache: () => void;
  addHistoryEntry: (score: number) => void;
}

export type LibraryHealthStore = LibraryHealthState & LibraryHealthActions;
