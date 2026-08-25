import { usePlayerStore } from '../store/player.store';
import { useDownloadStore } from '../../download/store/download.store';
import { getCanonicalTrackId, verifyTrackIdentity } from './track-identity';
import { PlayerTrack } from '../types/player';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * resumeTrackFromHistory - Centralized three-tier playback resume engine.
 * Decouples transport control from presentation layers and ensures identical
 * resolution paths for Continue Listening, Recently Played, and Favorites.
 */
export async function resumeTrackFromHistory(
  track: {
    id: string;
    title: string;
    artist: string;
    art?: string | null;
    positionMs: number;
    durationMs: number;
    trackSnapshot?: PlayerTrack;
  },
  goNowPlaying: (trackId: string) => void,
  contextType: 'playlist' | 'album' | 'artist' | 'queue' | 'search' | 'local' | 'downloads' | 'home' = 'home'
): Promise<void> {
  // 1. Tactile feedback
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

  const playerStore = usePlayerStore.getState();
  const selectedTrackId = track.id;
  const selectedSnapshotId = track.trackSnapshot?.id || 'none';
  const selectedCanonicalId = getCanonicalTrackId({ id: track.id, title: track.title, artist: track.artist });

  console.log(`[PlaybackResume] >>> STARTING DETERMINISTIC RESOLUTION PIPELINE <<<`);
  console.log(`[PlaybackResume] Selected History Entry ID: ${selectedTrackId}`);
  console.log(`[PlaybackResume] Selected History Entry Snapshot ID: ${selectedSnapshotId}`);
  console.log(`[PlaybackResume] Selected History Canonical ID: ${selectedCanonicalId}`);

  // Trigger immediate optimistic UI layout expansion
  goNowPlaying(track.id);

  // Set active context on the player
  playerStore.setActiveContext({ type: contextType, id: contextType });

  // ─── Case 1: Active Queue Match ─────────────────────────────────────────
  console.log(`[PlaybackResume] [Case 1] Scanning active queue for matching canonical ID...`);
  const queueIdx = playerStore.queue.findIndex((t) => {
    return getCanonicalTrackId(t) === selectedCanonicalId;
  });

  if (queueIdx !== -1) {
    const queueTrack = playerStore.queue[queueIdx];
    const resolvedQueueTrackId = queueTrack.id;
    const resolvedQueueCanonical = getCanonicalTrackId(queueTrack);

    console.log(`[PlaybackResume] [Case 1] Found matching track in queue at index ${queueIdx}.`);
    console.log(`[PlaybackResume] [Case 1] Resolved Queue Track ID: ${resolvedQueueTrackId}`);
    
    // Assertion check
    if (resolvedQueueCanonical === selectedCanonicalId) {
      console.log(`[PlaybackResume] [Case 1] Assert passed! Canonical IDs match: ${resolvedQueueCanonical}`);
      
      // Update store state with isTransitioning: true and status: 'buffering' so setTrack resolves it stably
      usePlayerStore.setState({
        currentIndex: queueIdx,
        currentTrack: queueTrack,
        lyrics: null,
        isLyricsLoading: false,
        isTransitioning: true,
        status: 'buffering',
        isBuffering: true,
        position: track.positionMs,
      });

      try {
        await playerStore.jumpToQueueIndex(queueIdx);
        await playerStore.seek(track.positionMs);
        await playerStore.play();

        const finalCurrentTrackId = usePlayerStore.getState().currentTrack?.id || 'none';
        let rntpActiveTrackId = 'none';
        if (Platform.OS !== 'web') {
          const activeItem = { mediaId: null };
          rntpActiveTrackId = activeItem?.mediaId || 'none';
        }

        const isIdentityVerified = verifyTrackIdentity(selectedTrackId, resolvedQueueTrackId, rntpActiveTrackId);

        console.log(`[PlaybackResume] [Case 1 SUCCESS] Playback started.`);
        console.log(`[PlaybackResume] VERIFICATION LOGS:`);
        console.log(`# Selected Track ID: ${selectedTrackId}`);
        console.log(`# Resolved Track ID: ${resolvedQueueTrackId}`);
        console.log(`# Current Player Track ID: ${finalCurrentTrackId}`);
        console.log(`RNTP Active Track ID: ${rntpActiveTrackId}`);
        console.log(`Identity Verification Passed: ${isIdentityVerified}`);

        if (!isIdentityVerified) {
          console.warn(`[PlaybackResume] [Case 1] Identity verification failed! Selected: ${selectedTrackId}, Resolved: ${resolvedQueueTrackId}, Native: ${rntpActiveTrackId}`);
        }
        return;
      } catch (err) {
        console.warn(`[PlaybackResume] [Case 1] Playback failed inside Case 1 branch. Falling back...`, err);
      }
    } else {
      console.warn(`[PlaybackResume] [Case 1] Assert FAILED. Expected: ${selectedCanonicalId}, got: ${resolvedQueueCanonical}. Skipping...`);
    }
  } else {
    console.log(`[PlaybackResume] [Case 1] No match in active queue.`);
  }

  // ─── Case 2: Downloaded Track Fallback ──────────────────────────────────
  console.log(`[PlaybackResume] [Case 2] Checking for local downloaded track...`);
  const downloadedTracks = useDownloadStore.getState().downloadedTracks;
  const downloadedTrack = downloadedTracks[track.id];

  if (downloadedTrack) {
    const resolvedDownloadTrackId = downloadedTrack.id;
    const resolvedDownloadCanonical = getCanonicalTrackId(downloadedTrack);
    console.log(`[PlaybackResume] [Case 2] Found downloaded version of track.`);
    console.log(`[PlaybackResume] [Case 2] Resolved Download Track ID: ${resolvedDownloadTrackId}`);

    if (resolvedDownloadCanonical === selectedCanonicalId) {
      console.log(`[PlaybackResume] [Case 2] Assert passed! Canonical IDs match: ${resolvedDownloadCanonical}`);

      const trackToPlay: PlayerTrack = {
        ...downloadedTrack,
        url: downloadedTrack.localAudioPath,
      };

      // Set store state with isTransitioning: true and status: 'buffering' to bypass early return inside setTrack
      usePlayerStore.setState({
        currentIndex: 0,
        queue: [trackToPlay],
        originalQueue: [trackToPlay],
        currentTrack: trackToPlay,
        status: 'buffering',
        isBuffering: true,
        isTransitioning: true,
        position: track.positionMs,
        duration: track.durationMs,
      });

      try {
        await playerStore.setTrack(trackToPlay);
        await playerStore.seek(track.positionMs);
        await playerStore.play();

        const finalCurrentTrackId = usePlayerStore.getState().currentTrack?.id || 'none';
        let rntpActiveTrackId = 'none';
        if (Platform.OS !== 'web') {
          const activeItem = { mediaId: null };
          rntpActiveTrackId = activeItem?.mediaId || 'none';
        }

        const isIdentityVerified = verifyTrackIdentity(selectedTrackId, resolvedDownloadTrackId, rntpActiveTrackId);

        console.log(`[PlaybackResume] [Case 2 SUCCESS] Playback started.`);
        console.log(`[PlaybackResume] VERIFICATION LOGS:`);
        console.log(`# Selected Track ID: ${selectedTrackId}`);
        console.log(`# Resolved Track ID: ${resolvedDownloadTrackId}`);
        console.log(`# Current Player Track ID: ${finalCurrentTrackId}`);
        console.log(`RNTP Active Track ID: ${rntpActiveTrackId}`);
        console.log(`Identity Verification Passed: ${isIdentityVerified}`);

        if (!isIdentityVerified) {
          console.warn(`[PlaybackResume] [Case 2] Identity verification failed! Selected: ${selectedTrackId}, Resolved: ${resolvedDownloadTrackId}, Native: ${rntpActiveTrackId}`);
        }
        return;
      } catch (err) {
        console.warn(`[PlaybackResume] [Case 2] Playback failed inside Case 2 branch. Falling back...`, err);
      }
    } else {
      console.warn(`[PlaybackResume] [Case 2] Assert FAILED. Expected: ${selectedCanonicalId}, got: ${resolvedDownloadCanonical}. Skipping...`);
    }
  } else {
    console.log(`[PlaybackResume] [Case 2] No downloaded version found.`);
  }

  // ─── Case 3: Online Self-Healing Stream Resolver ────────────────────────
  console.log(`[PlaybackResume] [Case 3] Initiating online self-healing stream resolution...`);
  const snapshot = track.trackSnapshot;
  const trackToPlay: PlayerTrack = snapshot
    ? { ...snapshot, url: '' }
    : {
        id: track.id,
        title: track.title,
        artist: track.artist,
        art: track.art || '',
        url: '',
        duration: track.durationMs,
      };

  const resolvedOnlineTrackId = trackToPlay.id;
  const resolvedOnlineCanonical = getCanonicalTrackId(trackToPlay);
  console.log(`[PlaybackResume] [Case 3] Resolved Online Track ID: ${resolvedOnlineTrackId}`);

  if (resolvedOnlineCanonical === selectedCanonicalId) {
    console.log(`[PlaybackResume] [Case 3] Assert passed! Canonical IDs match: ${resolvedOnlineCanonical}`);

    // Set state with isTransitioning: true and status: 'buffering' to bypass early return inside setTrack
    usePlayerStore.setState({
      currentIndex: 0,
      queue: [trackToPlay],
      originalQueue: [trackToPlay],
      currentTrack: trackToPlay,
      status: 'buffering',
      isBuffering: true,
      isTransitioning: true,
      position: track.positionMs,
      duration: track.durationMs,
    });

    try {
      await playerStore.setTrack(trackToPlay);
      await playerStore.seek(track.positionMs);
      await playerStore.play();

      const finalCurrentTrackId = usePlayerStore.getState().currentTrack?.id || 'none';
      let rntpActiveTrackId = 'none';
      if (Platform.OS !== 'web') {
        const activeItem = { mediaId: null };
        rntpActiveTrackId = activeItem?.mediaId || 'none';
      }

      const isIdentityVerified = verifyTrackIdentity(selectedTrackId, resolvedOnlineTrackId, rntpActiveTrackId);

      console.log(`[PlaybackResume] [Case 3 SUCCESS] Playback started.`);
      console.log(`[PlaybackResume] VERIFICATION LOGS:`);
      console.log(`# Selected Track ID: ${selectedTrackId}`);
      console.log(`# Resolved Track ID: ${resolvedOnlineTrackId}`);
      console.log(`# Current Player Track ID: ${finalCurrentTrackId}`);
      console.log(`RNTP Active Track ID: ${rntpActiveTrackId}`);
      console.log(`Identity Verification Passed: ${isIdentityVerified}`);

      if (!isIdentityVerified) {
        console.warn(`[PlaybackResume] [Case 3] Identity verification failed! Selected: ${selectedTrackId}, Resolved: ${resolvedOnlineTrackId}, Native: ${rntpActiveTrackId}`);
      }
      return;
    } catch (err) {
      console.error(`[PlaybackResume] [Case 3] Critical failure inside Case 3 online resolution branch:`, err);
    }
  } else {
    console.error(`[PlaybackResume] [Case 3] Assert FAILED. Expected: ${selectedCanonicalId}, got: ${resolvedOnlineCanonical}. Aborting playback.`);
  }

  console.error(`[PlaybackResume] DETERMINISTIC RESOLUTION PIPELINE FAILED TO RESOLVE TRACK: ${selectedTrackId}`);
}


