import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryHealthStore, LibraryHealthReport, DuplicateGroup, PendingDeletion, HealthHistoryEntry, ScanStage } from '../types/library-health';

export const useLibraryHealthStore = create<LibraryHealthStore>()(
  (set, get) => ({
      // State
      healthReport: null,
      duplicateGroups: [],
      ignoredDuplicateGroups: [],
      healthHistory: [],
      lastScanAt: 0,
      libraryHash: '',
      isScanning: false,
      scanProgress: 0,
      scanStage: 'idle',
      pendingDeletions: [],
      undoExpiresAt: null,
      duplicateIndex: {},
      telemetry: {
        duplicatesFound: 0,
        duplicatesRemoved: 0,
        storageRecovered: 0,
      },

      // Actions
      setScanningState: (isScanning: boolean, scanProgress: number, scanStage: ScanStage) => {
        set({ isScanning, scanProgress, scanStage });
      },

      setScanResult: (report: LibraryHealthReport, groups: DuplicateGroup[], lastScanAt: number, libraryHash: string) => {
        // Track history if health score changed
        const currentReport = get().healthReport;
        if (!currentReport || currentReport.healthScore !== report.healthScore) {
          get().addHistoryEntry(report.healthScore);
        }

        // Keep telemetry duplicatesFound updated
        const currentTelemetry = get().telemetry;
        const totalFound = currentTelemetry.duplicatesFound + report.duplicateTracks;

        set({
          healthReport: report,
          duplicateGroups: groups,
          lastScanAt,
          libraryHash,
          telemetry: {
            ...currentTelemetry,
            duplicatesFound: totalFound,
          },
        });
      },

      setDuplicateIndex: (index: Record<string, string[]>) => {
        set({ duplicateIndex: index });
      },

      ignoreGroup: (groupId: string) => {
        set((state) => ({
          ignoredDuplicateGroups: [...state.ignoredDuplicateGroups, groupId],
        }));
      },

      registerPendingDeletions: (deletions: PendingDeletion[], timeoutMs: number) => {
        set({
          pendingDeletions: deletions,
          undoExpiresAt: Date.now() + timeoutMs,
        });
      },

      clearPendingDeletions: () => {
        set({
          pendingDeletions: [],
          undoExpiresAt: null,
        });
      },

      clearScanCache: () => {
        set({
          healthReport: null,
          duplicateGroups: [],
          lastScanAt: 0,
          libraryHash: '',
        });
      },

      addHistoryEntry: (score: number) => {
        const timestamp = Date.now();
        const newEntry: HealthHistoryEntry = { timestamp, score };
        
        set((state) => {
          // Keep only the last 50 entries to avoid store bloat
          const updatedHistory = [...state.healthHistory, newEntry]
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-50);
          return { healthHistory: updatedHistory };
        });
      },
    })
);
