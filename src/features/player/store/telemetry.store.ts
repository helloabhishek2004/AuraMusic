import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TelemetryState {
  sourceErrorCount: number;
  localRecoveryCount: number;
  streamRecoveryCount: number;
  queueRepairCount: number;
  resolverCooldownHits: number;
}

export interface TelemetryActions {
  incrementMetric: (metric: keyof TelemetryState) => void;
  resetTelemetry: () => void;
  getTelemetryData: () => TelemetryState;
}

export const useTelemetryStore = create<TelemetryState & TelemetryActions>()(
  (set, get) => ({
      sourceErrorCount: 0,
      localRecoveryCount: 0,
      streamRecoveryCount: 0,
      queueRepairCount: 0,
      resolverCooldownHits: 0,

      incrementMetric: (metric) => {
        set((state) => ({
          [metric]: (state[metric] || 0) + 1,
        }));
      },

      resetTelemetry: () => {
        set({
          sourceErrorCount: 0,
          localRecoveryCount: 0,
          streamRecoveryCount: 0,
          queueRepairCount: 0,
          resolverCooldownHits: 0,
        });
      },

      getTelemetryData: () => {
        const state = get();
        return {
          sourceErrorCount: state.sourceErrorCount || 0,
          localRecoveryCount: state.localRecoveryCount || 0,
          streamRecoveryCount: state.streamRecoveryCount || 0,
          queueRepairCount: state.queueRepairCount || 0,
          resolverCooldownHits: state.resolverCooldownHits || 0,
        };
      },
    })
);
