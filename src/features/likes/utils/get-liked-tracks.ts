import { useLikesStore } from '../store/likes.store';
import { useDownloadStore } from '../../download/store/download.store';
import { PlayerTrack } from '../../player/types/player';

/**
 * Resolves liked track IDs into full PlayerTrack objects.
 * 
 * Resolution priority:
 * 1. DownloadStore (most authoritative - local file)
 * 2. LikesStore metadata snapshot (offline fallback)
 * 
 * Note: Stream URLs are resolved at playback time by PlaybackService.
 */
export function getLikedTracks(): PlayerTrack[] {
  const { getLikedIds, trackMetadata } = useLikesStore.getState();
  const { downloadedTracks } = useDownloadStore.getState();
  const likedIds = getLikedIds();

  return likedIds.map((id) => {
    // Priority 1: Downloaded track
    const downloaded = downloadedTracks[id];
    if (downloaded) {
      return downloaded as PlayerTrack;
    }

    // Priority 2: Snapshot metadata
    const meta = trackMetadata[id];
    return {
      id,
      title: meta?.title || 'Unknown Track',
      artist: meta?.artist || 'Unknown Artist',
      art: meta?.art || '',
      url: '', // Resolved at playback time
      duration: meta?.duration || 0,
      isLocal: meta?.isLocal || false,
      source: meta?.source || 'ytmusic',
    } as PlayerTrack;
  });
}
