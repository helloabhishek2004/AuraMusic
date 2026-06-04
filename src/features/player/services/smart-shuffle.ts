import { PlayerTrack } from "../types/player";
import { useAnalyticsStore } from "../../analytics/store/analytics.store";

/**
 * Generates an intelligently shuffled queue using listening history and artist/track affinities.
 * Boosts: Liked, completed, frequently played artists.
 * Penalties: Highly skipped artists/tracks, recently played tracks.
 * Constraints:
 * - Artist separation: same artist not within 5 positions
 * - Diversity rules: max 3 tracks per artist, 2 tracks per album (applied to mixed queues)
 */
export function generateSmartShuffleQueue(
  tracks: PlayerTrack[],
  anchorTrack: PlayerTrack
): PlayerTrack[] {
  if (tracks.length <= 1) return tracks;

  const analytics = useAnalyticsStore.getState();
  const { artistAffinities, trackAffinities, history } = analytics;

  const remainingTracks = tracks.filter((t) => t.id !== anchorTrack.id);

  // 1. Calculate weights for all candidate tracks
  const scoredCandidates = remainingTracks.map((t) => {
    let weight = 50 + Math.random() * 20; // base weight + noise

    const artistKey = t.artist;
    const artistAff = artistAffinities[artistKey];
    const trackAff = trackAffinities[t.id];

    if (artistAff) {
      // Boosts
      if (artistAff.likedCount) weight += artistAff.likedCount * 10;
      if (artistAff.completionCount) weight += artistAff.completionCount * 5;
      if (artistAff.playCount) weight += artistAff.playCount * 2;

      // Penalties
      if (artistAff.skipCount) weight -= artistAff.skipCount * 5;
    }

    if (trackAff) {
      if (trackAff.skipCount) weight -= trackAff.skipCount * 10;
    }

    // Recently Played penalty (check last 20 history entries)
    const isRecent = history.slice(0, 20).some((h) => h.id === t.id);
    if (isRecent) {
      weight -= 40;
    }

    return { track: t, weight };
  });

  // Sort candidates by weight descending
  scoredCandidates.sort((a, b) => b.weight - a.weight);

  // 2. Greedy placement with constraints
  const shuffledQueue = [anchorTrack];
  const artistCount = new Map<string, number>();
  const albumCount = new Map<string, number>();

  // Helper to normalize keys
  const getArtistKey = (artist: string) => artist.toLowerCase().trim();
  const getAlbumKey = (album?: string) => (album || "").toLowerCase().trim();

  // Seed counters with anchor track
  artistCount.set(getArtistKey(anchorTrack.artist), 1);
  if (anchorTrack.album) {
    albumCount.set(getAlbumKey(anchorTrack.album), 1);
  }

  // Detect queue composition to see if we should enforce diversity caps
  const uniqueArtists = new Set(tracks.map((t) => getArtistKey(t.artist)));
  const uniqueAlbums = new Set(tracks.map((t) => getAlbumKey(t.album)));
  const applyArtistLimit = uniqueArtists.size >= 4;
  const applyAlbumLimit = uniqueAlbums.size >= 4;

  const maxArtistTracks = 3;
  const maxAlbumTracks = 2;

  const pool = scoredCandidates.map((c) => c.track);

  while (pool.length > 0) {
    let placed = false;

    for (let i = 0; i < pool.length; i++) {
      const track = pool[i];
      const aKey = getArtistKey(track.artist);
      const alKey = getAlbumKey(track.album);

      // Check diversity limits
      const aCount = artistCount.get(aKey) || 0;
      if (applyArtistLimit && aCount >= maxArtistTracks) {
        pool.splice(i, 1);
        i--;
        continue; // Discard/skip track
      }

      if (applyAlbumLimit && alKey) {
        const alCount = albumCount.get(alKey) || 0;
        if (alCount >= maxAlbumTracks) {
          pool.splice(i, 1);
          i--;
          continue; // Discard/skip track
        }
      }

      // Check artist separation (same artist not within 5 positions, i.e., last 4 placed tracks)
      const lookback = shuffledQueue.slice(-4);
      const isTooClose = lookback.some((t) => getArtistKey(t.artist) === aKey);

      if (!isTooClose) {
        shuffledQueue.push(track);
        artistCount.set(aKey, aCount + 1);
        if (alKey) {
          albumCount.set(alKey, (albumCount.get(alKey) || 0) + 1);
        }
        pool.splice(i, 1);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // If we cannot satisfy the separation constraint for any track, relax it and place the highest weight track
      const track = pool[0];
      const aKey = getArtistKey(track.artist);
      const alKey = getAlbumKey(track.album);

      shuffledQueue.push(track);
      artistCount.set(aKey, (artistCount.get(aKey) || 0) + 1);
      if (alKey) {
        albumCount.set(alKey, (albumCount.get(alKey) || 0) + 1);
      }
      pool.shift();
    }
  }

  return shuffledQueue;
}
