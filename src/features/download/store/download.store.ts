import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadStore, DownloadedTrack, DownloadStatus, DownloadQueueItem, DownloadTask, DownloadState } from '../types/download';
import { PlayerTrack } from '../../player/types/player';

const pruneQueue = (queue: DownloadQueueItem[]): DownloadQueueItem[] => {
  const activeOrQueued = queue.filter(item => ['queued', 'preparing', 'downloading', 'verifying', 'paused'].includes(item.status));
  const completed = queue.filter(item => item.status === 'completed');
  const failed = queue.filter(item => item.status === 'failed');

  let newCompleted = [...completed];
  if (newCompleted.length > 500) {
    newCompleted.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
    newCompleted = newCompleted.slice(newCompleted.length - 500);
  }

  let newFailed = [...failed];
  if (newFailed.length > 100) {
    newFailed.sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
    newFailed = newFailed.slice(newFailed.length - 100);
  }

  const finished = [...newCompleted, ...newFailed];
  if (finished.length > 500) {
    finished.sort((a, b) => {
      const timeA = a.completedAt || a.queuedAt;
      const timeB = b.completedAt || b.queuedAt;
      return timeA - timeB;
    });
    const prunedFinished = finished.slice(finished.length - 500);
    return [...activeOrQueued, ...prunedFinished];
  }

  return [...activeOrQueued, ...newCompleted, ...newFailed];
};

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      // State
      downloadedTracks: {},
      downloadQueue: [],
      activeTasks: {},
      queue: [],
      activeDownloads: 0,
      maxConcurrentDownloads: 3,
      isQueuePaused: false,
      notification: null,

      // Telemetry
      downloadsStarted: 0,
      downloadsCompleted: 0,
      downloadsFailed: 0,
      averageDownloadSpeed: 0,
      averageCompletionTime: 0,

      // Actions
      addDownload: (track: PlayerTrack) => {
        get().enqueueDownload(track, 'HIGH');
      },

      enqueueDownload: (track: PlayerTrack, priority: 'HIGH' | 'NORMAL' | 'LOW' = 'HIGH') => {
        const { downloadedTracks, queue } = get();

        // Check duplicates: Queued, Preparing, Downloading, Verifying, or Completed
        const existingItem = queue.find(
          (item) =>
            (item.trackId === track.id || (item.downloadUrl && track.url && item.downloadUrl === track.url)) &&
            ['queued', 'preparing', 'downloading', 'verifying', 'completed'].includes(item.status)
        );

        if (existingItem) {
          return existingItem;
        }

        const isCompleted = !!downloadedTracks[track.id];
        if (isCompleted) {
          const completedItem = queue.find(item => item.trackId === track.id && item.status === 'completed');
          if (completedItem) return completedItem;
          
          // If in downloadedTracks but not in queue list, create completed item in queue
          const newItem: DownloadQueueItem = {
            id: track.id,
            trackId: track.id,
            title: track.title,
            artist: track.artist,
            artwork: track.art,
            status: 'completed',
            progress: 100,
            retryCount: 0,
            queuedAt: Date.now(),
            completedAt: Date.now(),
            priority,
            downloadUrl: track.url,
          };
          set((state) => ({
            queue: pruneQueue([...state.queue, newItem]),
          }));
          return newItem;
        }

        const newItem: DownloadQueueItem = {
          id: track.id,
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          artwork: track.art,
          status: 'queued',
          progress: 0,
          retryCount: 0,
          queuedAt: Date.now(),
          priority,
          downloadUrl: track.url,
        };

        const newTask: DownloadTask = {
          track,
          status: 'queued',
          progress: 0,
          retryCount: 0,
        };

        set((state) => ({
          queue: pruneQueue([...state.queue, newItem]),
          // Keep backward compatibility in sync
          downloadQueue: [...state.downloadQueue, track.id],
          activeTasks: {
            ...state.activeTasks,
            [track.id]: newTask,
          },
        }));

        // Trigger scheduler
        import('../services/download-queue-manager').then(({ DownloadQueueManager }) => {
          DownloadQueueManager.processQueue();
        }).catch(() => {});

        return newItem;
      },

      enqueueAlbum: async (albumId: string) => {
        try {
          const { musicService } = await import('../../../services/api/music');
          const albumDetails = await musicService.getAlbumDetails(albumId);
          if (!albumDetails || !albumDetails.tracks) return;

          const { enqueueDownload } = get();
          
          // Preserving order
          albumDetails.tracks.forEach((track) => {
            const playerTrack: PlayerTrack = {
              id: track.id,
              title: track.title,
              artist: track.artist,
              art: track.art || albumDetails.thumbnail,
              url: track.url || '',
              duration: typeof track.duration === 'number' ? track.duration : 0,
              albumId: albumDetails.id,
              album: albumDetails.title,
              artistId: albumDetails.artistId,
              source: track.source || 'ytmusic',
            };
            enqueueDownload(playerTrack, 'HIGH');
          });
        } catch (error) {
          console.error('[DownloadStore] Failed to enqueue album:', error);
        }
      },

      enqueuePlaylist: async (playlistId: string) => {
        try {
          const { usePlaylistStore } = await import('../../playlist/store/playlist.store');
          const playlistTracks = usePlaylistStore.getState().resolveTracks(playlistId);
          if (!playlistTracks) return;

          const { enqueueDownload } = get();

          // Preserve order, skip already downloaded tracks (handled inside enqueueDownload check)
          playlistTracks.forEach((track) => {
            enqueueDownload(track, 'HIGH');
          });
        } catch (error) {
          console.error('[DownloadStore] Failed to enqueue playlist:', error);
        }
      },

      pauseDownload: (trackId: string) => {
        set((state) => {
          const updatedQueue = state.queue.map((item) =>
            item.trackId === trackId ? { ...item, status: 'paused' as const } : item
          );
          const task = state.activeTasks[trackId];
          return {
            queue: updatedQueue,
            activeTasks: {
              ...state.activeTasks,
              ...(task ? { [trackId]: { ...task, status: 'paused' as const } } : {}),
            },
          };
        });
      },

      resumeDownload: (trackId: string) => {
        set((state) => {
          const updatedQueue = state.queue.map((item) =>
            item.trackId === trackId ? { ...item, status: 'queued' as const, error: undefined } : item
          );
          const task = state.activeTasks[trackId];
          return {
            queue: updatedQueue,
            activeTasks: {
              ...state.activeTasks,
              ...(task ? { [trackId]: { ...task, status: 'queued' as const, error: undefined } } : {}),
            },
          };
        });

        // Trigger scheduler
        import('../services/download-queue-manager').then(({ DownloadQueueManager }) => {
          DownloadQueueManager.processQueue();
        }).catch(() => {});
      },

      cancelDownload: (trackId: string) => {
        set((state) => {
          const newQueue = state.queue.filter((item) => item.trackId !== trackId);
          const newDownloadQueue = state.downloadQueue.filter((id) => id !== trackId);
          const newActiveTasks = { ...state.activeTasks };
          delete newActiveTasks[trackId];
          
          return {
            queue: newQueue,
            downloadQueue: newDownloadQueue,
            activeTasks: newActiveTasks,
          };
        });

        // Trigger scheduler
        import('../services/download-queue-manager').then(({ DownloadQueueManager }) => {
          DownloadQueueManager.processQueue();
        }).catch(() => {});
      },

      removeDownload: async (trackId: string) => {
        const state = get();
        const isInQueue = state.queue.some(item => item.trackId === trackId && item.status !== 'completed' && item.status !== 'failed');
        
        if (isInQueue) {
          const { DownloadManager } = await import('../services/download.manager');
          await DownloadManager.cancelDownload(trackId);
        } else {
          const track = state.downloadedTracks[trackId];
          if (track) {
            const { StorageService } = await import('../services/storage.service');
            await StorageService.deleteFile(track.localAudioPath);
            if (track.localArtPath) {
              await StorageService.deleteFile(track.localArtPath);
            }
          }
          set((state) => {
            const newDownloadedTracks = { ...state.downloadedTracks };
            delete newDownloadedTracks[trackId];
            return {
              downloadedTracks: newDownloadedTracks,
              queue: state.queue.filter(item => item.trackId !== trackId),
            };
          });
        }
      },

      updateProgress: (
        trackId: string,
        progressRatio: number,
        downloadedBytes?: number,
        fileSize?: number,
        speedBytesPerSecond?: number,
        estimatedTimeRemaining?: number
      ) => {
        set((state) => {
          const pPercent = Math.round(progressRatio * 100);
          
          const updatedQueue = state.queue.map((item) => {
            if (item.trackId === trackId) {
              const fSize = fileSize !== undefined ? fileSize : item.fileSize;
              const dBytes = downloadedBytes !== undefined ? downloadedBytes : Math.round(progressRatio * (fSize || 0));
              return {
                ...item,
                progress: pPercent,
                downloadedBytes: dBytes,
                fileSize: fSize,
                speedBytesPerSecond: speedBytesPerSecond !== undefined ? speedBytesPerSecond : item.speedBytesPerSecond,
                estimatedTimeRemaining: estimatedTimeRemaining !== undefined ? estimatedTimeRemaining : item.estimatedTimeRemaining,
              };
            }
            return item;
          });

          const task = state.activeTasks[trackId];
          const updatedTasks = task
            ? {
                ...state.activeTasks,
                [trackId]: { ...task, progress: progressRatio },
              }
            : state.activeTasks;

          return {
            queue: updatedQueue,
            activeTasks: updatedTasks,
          };
        });
      },

      updateStatus: (trackId: string, status: DownloadStatus, error?: string) => {
        set((state) => {
          const updatedQueue = state.queue.map((item) => {
            if (item.trackId === trackId) {
              const update: Partial<DownloadQueueItem> = { status, error };
              if (status === 'downloading') {
                update.startedAt = Date.now();
              } else if (status === 'completed') {
                update.completedAt = Date.now();
                update.progress = 100;
              }
              return { ...item, ...update };
            }
            return item;
          });

          const task = state.activeTasks[trackId];
          let updatedTasks = { ...state.activeTasks };
          
          if (task) {
            if (status === 'completed') {
              delete updatedTasks[trackId];
            } else {
              updatedTasks[trackId] = { ...task, status, error };
            }
          }

          const newDownloadQueue = status === 'completed' 
            ? state.downloadQueue.filter(id => id !== trackId)
            : state.downloadQueue;

          const prunedQueue = (status === 'completed' || status === 'failed')
            ? pruneQueue(updatedQueue)
            : updatedQueue;

          return {
            queue: prunedQueue,
            activeTasks: updatedTasks,
            downloadQueue: newDownloadQueue,
          };
        });

        // Trigger scheduler
        import('../services/download-queue-manager').then(({ DownloadQueueManager }) => {
          DownloadQueueManager.processQueue();
        }).catch(() => {});

        if (status === 'completed') {
          import('@/src/services/library-health.service').then(({ LibraryHealthService }) => {
            LibraryHealthService.registerNewDownloadedTrack(trackId);
          }).catch(() => {});
        }
      },

      setDownloaded: (track: DownloadedTrack) => {
        set((state) => {
          const updatedQueue = state.queue.map((item) =>
            item.trackId === track.id ? { ...item, status: 'completed' as const, progress: 100, completedAt: Date.now() } : item
          );
          
          const newActiveTasks = { ...state.activeTasks };
          delete newActiveTasks[track.id];

          return {
            downloadedTracks: {
              ...state.downloadedTracks,
              [track.id]: track,
            },
            queue: pruneQueue(updatedQueue),
            downloadQueue: state.downloadQueue.filter((id) => id !== track.id),
            activeTasks: newActiveTasks,
          };
        });

        // Trigger scheduler
        import('../services/download-queue-manager').then(({ DownloadQueueManager }) => {
          DownloadQueueManager.processQueue();
        }).catch(() => {});

        // Trigger queue repair when download completes
        import('@/src/features/player/services/queue-repair.service').then(({ QueueRepairService }) => {
          QueueRepairService.repairQueue(true).catch(err => console.error(err));
        }).catch(err => console.warn(err));

        // Trigger library health incremental scan
        import('@/src/services/library-health.service').then(({ LibraryHealthService }) => {
          LibraryHealthService.registerNewDownloadedTrack(track.id);
        }).catch(() => {});
      },

      clearCompleted: () => {
        set((state) => ({
          queue: state.queue.filter((item) => item.status !== 'completed'),
        }));
      },

      clearFailed: () => {
        set((state) => {
          const failedIds = state.queue.filter(item => item.status === 'failed').map(item => item.trackId);
          const newActiveTasks = { ...state.activeTasks };
          failedIds.forEach(id => {
            delete newActiveTasks[id];
          });
          return {
            queue: state.queue.filter((item) => item.status !== 'failed'),
            downloadQueue: state.downloadQueue.filter((id) => !failedIds.includes(id)),
            activeTasks: newActiveTasks,
          };
        });
      },

      retryDownload: (trackId: string) => {
        set((state) => {
          const updatedQueue = state.queue.map((item) =>
            item.trackId === trackId ? { ...item, status: 'queued' as const, error: undefined, retryCount: 0, progress: 0 } : item
          );
          const task = state.activeTasks[trackId];
          const updatedTasks = { ...state.activeTasks };
          if (task) {
            updatedTasks[trackId] = { ...task, status: 'queued' as const, error: undefined, retryCount: 0, progress: 0 };
          }
          return {
            queue: updatedQueue,
            activeTasks: updatedTasks,
            downloadQueue: state.downloadQueue.includes(trackId) ? state.downloadQueue : [...state.downloadQueue, trackId],
          };
        });

        // Trigger scheduler
        import('../services/download-queue-manager').then(({ DownloadQueueManager }) => {
          DownloadQueueManager.processQueue();
        }).catch(() => {});
      },

      setDownloadNotification: (notification) => {
        set({ notification });
      },

      pauseQueue: () => {
        set({ isQueuePaused: true });
      },

      resumeQueue: () => {
        set({ isQueuePaused: false });
        import('../services/download-queue-manager').then(({ DownloadQueueManager }) => {
          DownloadQueueManager.processQueue();
        }).catch(() => {});
      },

      updateTelemetry: (type: 'started' | 'completed' | 'failed', speed?: number, completionTime?: number) => {
        set((state) => {
          const updates: Partial<DownloadState> = {};
          if (type === 'started') {
            updates.downloadsStarted = state.downloadsStarted + 1;
          } else if (type === 'completed') {
            updates.downloadsCompleted = state.downloadsCompleted + 1;
            if (speed !== undefined && speed > 0) {
              const N = updates.downloadsCompleted || (state.downloadsCompleted + 1);
              updates.averageDownloadSpeed = Math.round(((state.averageDownloadSpeed * (N - 1)) + speed) / N);
            }
            if (completionTime !== undefined && completionTime > 0) {
              const N = updates.downloadsCompleted || (state.downloadsCompleted + 1);
              updates.averageCompletionTime = parseFloat((((state.averageCompletionTime * (N - 1)) + completionTime) / N).toFixed(2));
            }
          } else if (type === 'failed') {
            updates.downloadsFailed = state.downloadsFailed + 1;
          }
          return updates;
        });
      },
    }),
    {
      name: 'aura-downloads',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        downloadedTracks: state.downloadedTracks,
        queue: state.queue || [],
        maxConcurrentDownloads: state.maxConcurrentDownloads || 3,
        isQueuePaused: state.isQueuePaused || false,
        // Persist Telemetry
        downloadsStarted: state.downloadsStarted || 0,
        downloadsCompleted: state.downloadsCompleted || 0,
        downloadsFailed: state.downloadsFailed || 0,
        averageDownloadSpeed: state.averageDownloadSpeed || 0,
        averageCompletionTime: state.averageCompletionTime || 0,
      }),
    }
  )
);

