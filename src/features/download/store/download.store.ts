import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadStore, DownloadedTrack, DownloadStatus } from '../types/download';
import { PlayerTrack } from '../../player/types/player';

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      // State
      downloadedTracks: {},
      downloadQueue: [],
      activeTasks: {},
      notification: null,

      // Actions
      addDownload: (track: PlayerTrack) => {
        const { downloadedTracks, activeTasks, downloadQueue } = get();
        
        // Prevent duplicate downloads
        if (downloadedTracks[track.id] || activeTasks[track.id]) return;

        set((state) => ({
          downloadQueue: [...state.downloadQueue, track.id],
          activeTasks: {
            ...state.activeTasks,
            [track.id]: {
              track,
              status: 'queued',
              progress: 0,
              retryCount: 0,
            },
          },
        }));
      },

      pauseDownload: (trackId: string) => {
        set((state) => {
          const task = state.activeTasks[trackId];
          if (!task) return state;
          return {
            activeTasks: {
              ...state.activeTasks,
              [trackId]: { ...task, status: 'paused' },
            },
          };
        });
      },

      resumeDownload: (trackId: string) => {
        set((state) => {
          const task = state.activeTasks[trackId];
          if (!task) return state;
          return {
            activeTasks: {
              ...state.activeTasks,
              [trackId]: { ...task, status: 'queued' },
            },
          };
        });
      },

      cancelDownload: (trackId: string) => {
        set((state) => {
          const newQueue = state.downloadQueue.filter((id) => id !== trackId);
          const newActiveTasks = { ...state.activeTasks };
          delete newActiveTasks[trackId];
          return {
            downloadQueue: newQueue,
            activeTasks: newActiveTasks,
          };
        });
      },

      removeDownload: async (trackId: string) => {
        set((state) => {
          const newDownloadedTracks = { ...state.downloadedTracks };
          delete newDownloadedTracks[trackId];
          return {
            downloadedTracks: newDownloadedTracks,
          };
        });
      },

      updateProgress: (trackId: string, progress: number) => {
        set((state) => {
          const task = state.activeTasks[trackId];
          if (!task) return state;
          return {
            activeTasks: {
              ...state.activeTasks,
              [trackId]: { ...task, progress },
            },
          };
        });
      },

      updateStatus: (trackId: string, status: DownloadStatus, error?: string) => {
        set((state) => {
          const task = state.activeTasks[trackId];
          if (!task) return state;

          const newState = {
            activeTasks: {
              ...state.activeTasks,
              [trackId]: { ...task, status, error },
            },
          };

          if (status === 'completed' || status === 'failed' || status === 'paused') {
            newState.activeTasks = { ...state.activeTasks };
            if (status === 'completed') {
                delete newState.activeTasks[trackId];
                return {
                    ...newState,
                    downloadQueue: state.downloadQueue.filter(id => id !== trackId)
                };
            }
          }
          
          return newState;
        });
      },

      setDownloaded: (track: DownloadedTrack) => {
        set((state) => ({
          downloadedTracks: {
            ...state.downloadedTracks,
            [track.id]: track,
          },
          downloadQueue: state.downloadQueue.filter((id) => id !== track.id),
        }));
      },

      clearFailed: () => {
        set((state) => {
          const newActiveTasks = { ...state.activeTasks };
          Object.keys(newActiveTasks).forEach((id) => {
            if (newActiveTasks[id].status === 'failed') {
              delete newActiveTasks[id];
            }
          });
          return {
            activeTasks: newActiveTasks,
            downloadQueue: state.downloadQueue.filter((id) => newActiveTasks[id]),
          };
        });
      },

      setDownloadNotification: (notification) => {
        set({ notification });
      },
    }),
    {
      name: 'aura-downloads',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        downloadedTracks: state.downloadedTracks,
        // We don't persist activeTasks or downloadQueue to avoid weird states on restart,
        // unless we want to resume them. The requirement says "app restart restores download states".
        // Let's persist them but set status to 'queued' or 'paused' on load?
        // Actually, let's persist them and the DownloadManager will handle initialization.
        downloadQueue: state.downloadQueue,
        activeTasks: state.activeTasks,
      }),
    }
  )
);
