import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SourceHealthRecord {
  trackId: string;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  consecutiveFailures: number;
}

interface SourceHealthState {
  records: Record<string, SourceHealthRecord>;
}

interface SourceHealthActions {
  registerSuccess: (trackId: string) => void;
  registerFailure: (trackId: string) => void;
  isCooldownActive: (trackId: string) => boolean;
  clearHealthHistory: () => void;
}

export const useSourceHealthStore = create<SourceHealthState & SourceHealthActions>()(
  (set, get) => ({
      records: {},

      registerSuccess: (trackId) => {
        set((state) => {
          const record = state.records[trackId] || { trackId, lastSuccessAt: null, lastFailureAt: null, consecutiveFailures: 0 };
          return {
            records: {
              ...state.records,
              [trackId]: {
                ...record,
                lastSuccessAt: Date.now(),
                consecutiveFailures: 0,
              },
            },
          };
        });
      },

      registerFailure: (trackId) => {
        set((state) => {
          const record = state.records[trackId] || { trackId, lastSuccessAt: null, lastFailureAt: null, consecutiveFailures: 0 };
          return {
            records: {
              ...state.records,
              [trackId]: {
                ...record,
                lastFailureAt: Date.now(),
                consecutiveFailures: record.consecutiveFailures + 1,
              },
            },
          };
        });
      },

      isCooldownActive: (trackId) => {
        const record = get().records[trackId];
        if (!record || record.consecutiveFailures < 3) {
          return false;
        }
        if (record.lastFailureAt) {
          const timeSinceFailure = Date.now() - record.lastFailureAt;
          return timeSinceFailure < 5 * 60 * 1000;
        }
        return false;
      },

      clearHealthHistory: () => {
        set({ records: {} });
      },
    })
);
