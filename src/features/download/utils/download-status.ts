import { useDownloadStore } from "../store/download.store";
import { useMemo } from "react";

export type DownloadState = 'not_downloaded' | 'downloading' | 'downloaded' | 'failed' | 'paused';

export const useDownloadState = (trackId: string): DownloadState => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const activeTasks = useDownloadStore(s => s.activeTasks);

  return useMemo(() => {
    if (downloadedTracks[trackId]) {
      return 'downloaded';
    }
    if (activeTasks[trackId]) {
      const status = activeTasks[trackId].status;
      if (status === 'downloading' || status === 'preparing' || status === 'verifying') return 'downloading';
      if (status === 'paused') return 'paused';
      if (status === 'failed') return 'failed';
      if (status === 'queued') return 'downloading';
    }
    return 'not_downloaded';
  }, [trackId, downloadedTracks, activeTasks]);
};

export const useDownloadProgress = (trackId: string): number => {
  const activeTasks = useDownloadStore(s => s.activeTasks);
  
  return useMemo(() => {
    const task = activeTasks[trackId];
    return task?.progress || 0;
  }, [trackId, activeTasks]);
};

export const isTrackDownloaded = (trackId: string, downloadedTracks: Record<string, any>): boolean => {
  return !!downloadedTracks[trackId];
};

export const useIsTrackDownloaded = (trackId: string): boolean => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  return useMemo(() => !!downloadedTracks[trackId], [trackId, downloadedTracks]);
};

export const useIsAlbumDownloaded = (albumId: string): { isFullyDownloaded: boolean; downloadedCount: number; totalCount: number } => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  
  return useMemo(() => {
    const albumTracks = Object.values(downloadedTracks).filter(t => t.albumId === albumId);
    return {
      isFullyDownloaded: false,
      downloadedCount: albumTracks.length,
      totalCount: 0,
    };
  }, [albumId, downloadedTracks]);
};

export const useMultipleDownloadStates = (trackIds: string[]): Record<string, DownloadState> => {
  const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
  const activeTasks = useDownloadStore(s => s.activeTasks);

  return useMemo(() => {
    const result: Record<string, DownloadState> = {};
    for (const trackId of trackIds) {
      if (downloadedTracks[trackId]) {
        result[trackId] = 'downloaded';
      } else if (activeTasks[trackId]) {
        const status = activeTasks[trackId].status;
        if (status === 'downloading' || status === 'queued' || status === 'preparing' || status === 'verifying') result[trackId] = 'downloading';
        else if (status === 'paused') result[trackId] = 'paused';
        else if (status === 'failed') result[trackId] = 'failed';
      } else {
        result[trackId] = 'not_downloaded';
      }
    }
    return result;
  }, [trackIds, downloadedTracks, activeTasks]);
};