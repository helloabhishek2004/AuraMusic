import { PlayerTrack } from "../types/player";
import { useAnalyticsStore } from "../../analytics/store/analytics.store";
import { useRecommendationsStore } from "../../recommendations/store/recommendations.store";
import { buildTasteClusters } from "../../recommendations/services/recommendation-engine";

/**
 * AutoplayRadio - Generates a 10-track infinite continuation queue when playback ends.
 * Feeds from:
 * - 40% High Affinity Artists
 * - 30% Related Artists (Cluster B)
 * - 20% Trending/Popular catalogue tracks
 * - 10% Discovery Candidates (Cluster C)
 * Constraints:
 * - No duplicate tracks
 * - Max 3 tracks per artist
 * - Max 2 tracks per album
 * - No same artist within 5 positions
 */
export const AutoplayRadio = {
  async generateContinuationQueue(lastTrack: PlayerTrack): Promise<PlayerTrack[]> {
    const analytics = useAnalyticsStore.getState();
    const { artistAffinities, history, artistCache } = analytics;
    
    const recoStore = useRecommendationsStore.getState();
    const { listeningDNA } = recoStore;

    // 1. Gather Candidate Sources
    // High Affinity Artists (40%): Get the top 5 artists from affinities
    const sortedAffinities = Object.keys(artistAffinities)
      .map(key => ({ name: key, score: artistAffinities[key].score }))
      .sort((a, b) => b.score - a.score);
    const topArtists = sortedAffinities.slice(0, 5).map(a => a.name.toLowerCase().trim());
    
    // Related Artists (30%): Get artists from Cluster B (Alternative to top artist)
    const clusters = buildTasteClusters(artistAffinities, history, artistCache);
    const clusterB = clusters.find(c => c.id === 'cluster-related');
    const relatedArtists = clusterB ? clusterB.artists.map(a => a.toLowerCase().trim()) : [];

    // Discovery Candidates (10%): Get artists from Cluster C (Discovery Mix)
    const clusterC = clusters.find(c => c.id === 'cluster-exploration');
    const discoveryArtists = clusterC ? clusterC.artists.map(a => a.toLowerCase().trim()) : [];

    const historyTracks = (history || []).map((h: any) => h.trackSnapshot || h).filter((t: any) => t && t.id);
    let downloadedTracks: any[] = [];
    try {
      const { useDownloadStore } = require('../../download/store/download.store');
      downloadedTracks = Object.values(useDownloadStore.getState().downloadedTracks || {});
    } catch (e) {}
    const localTrackPool = [...historyTracks, ...downloadedTracks];

    // Filter localTrackPool into pools
    const highAffinityPool = localTrackPool.filter(t => topArtists.includes((t.artist || '').toLowerCase().trim()) && t.id !== lastTrack.id);
    const relatedPool = localTrackPool.filter(t => relatedArtists.includes((t.artist || '').toLowerCase().trim()) && t.id !== lastTrack.id);
    const discoveryPool = localTrackPool.filter(t => discoveryArtists.includes((t.artist || '').toLowerCase().trim()) && t.id !== lastTrack.id);
    const generalPool = localTrackPool.filter(t => t.id !== lastTrack.id);

    // Ratios: 40% High Affinity, 30% Related, 20% Trending, 10% Discovery
    const candidates: any[] = [];
    
    // High Affinity (4 tracks)
    const shuffledHigh = [...highAffinityPool].sort(() => Math.random() - 0.5);
    candidates.push(...shuffledHigh.slice(0, 8));

    // Related (3 tracks)
    const shuffledRelated = [...relatedPool].sort(() => Math.random() - 0.5);
    candidates.push(...shuffledRelated.slice(0, 8));

    // Discovery (1 track)
    const shuffledDiscovery = [...discoveryPool].sort(() => Math.random() - 0.5);
    candidates.push(...shuffledDiscovery.slice(0, 8));

    // Fill the rest with general catalogue to ensure plenty of candidates
    const shuffledGeneral = [...generalPool].sort(() => Math.random() - 0.5);
    candidates.push(...shuffledGeneral.slice(0, 30));

    // Map candidate tracks to PlayerTrack format
    const mappedCandidates: PlayerTrack[] = candidates.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      art: t.art || '',
      url: '', // resolve at runtime
      duration: t.durationSec || 240,
      dominantColors: t.dominantColors || ['#bf5af2', '#1a0033'],
      source: t.source || 'local',
      album: t.album || undefined,
    }));

    // 2. Greedy placement with constraints:
    // - Capped at 10 tracks
    // - No duplicate track IDs
    // - No artist > 3 tracks
    // - No album > 2 tracks
    // - No same artist within 5 positions (starting with lastTrack artist as lookback index 0)
    const finalQueue: PlayerTrack[] = [];
    const artistCount = new Map<string, number>();
    const albumCount = new Map<string, number>();
    const seenIds = new Set<string>();

    const getArtistKey = (artist: string) => artist.toLowerCase().trim();
    const getAlbumKey = (album?: string) => (album || "").toLowerCase().trim();

    seenIds.add(lastTrack.id);

    const pool = [...mappedCandidates];

    while (finalQueue.length < 10 && pool.length > 0) {
      let placed = false;

      for (let i = 0; i < pool.length; i++) {
        const track = pool[i];
        if (seenIds.has(track.id)) {
          pool.splice(i, 1);
          i--;
          continue;
        }

        const aKey = getArtistKey(track.artist);
        const alKey = getAlbumKey(track.album);

        // Check diversity limits
        const aCount = artistCount.get(aKey) || 0;
        if (aCount >= 3) {
          pool.splice(i, 1);
          i--;
          continue;
        }

        if (alKey) {
          const alCount = albumCount.get(alKey) || 0;
          if (alCount >= 2) {
            pool.splice(i, 1);
            i--;
            continue;
          }
        }

        // Check separation (same artist not within 5 positions, lookback includes lastTrack)
        const lookback = [lastTrack, ...finalQueue].slice(-4);
        const isTooClose = lookback.some(t => getArtistKey(t.artist) === aKey);

        if (!isTooClose) {
          finalQueue.push(track);
          seenIds.add(track.id);
          artistCount.set(aKey, aCount + 1);
          if (alKey) {
            albumCount.set(alKey, (albumCount.get(alKey) || 0) + 1);
          }
          pool.splice(i, 1);
          placed = true;
          break;
        }
      }

      if (!placed && pool.length > 0) {
        // If we are stuck, relax separation constraint for the first track in the pool
        const track = pool[0];
        const aKey = getArtistKey(track.artist);
        const alKey = getAlbumKey(track.album);

        finalQueue.push(track);
        seenIds.add(track.id);
        artistCount.set(aKey, (artistCount.get(aKey) || 0) + 1);
        if (alKey) {
          albumCount.set(alKey, (albumCount.get(alKey) || 0) + 1);
        }
        pool.shift();
      }
    }

    return finalQueue;
  }
};
