import { PlayerTrack } from "../types/player";
import { useAnalyticsStore } from "../../analytics/store/analytics.store";
import { useRecommendationsStore } from "../../recommendations/store/recommendations.store";
import { buildTasteClusters } from "../../recommendations/services/recommendation-engine";
import { AuraYouTube, isNativeCoreAvailable } from "../../../services/native-core";
import { usePlayerStore } from "../store/player.store";
import { useLikesStore } from "../../likes/store/likes.store";

/**
 * AutoplayRadio — Vibe-Aware Dynamic Queue Engine
 * 
 * Generates an 8-10 track continuation queue by blending:
 * 1. Online seed-based radio automix via InnerTube /v1/next (bounded 3500ms timeout)
 * 2. Local Taste Clusters (Affinities, Related, Discovery)
 * 3. User listening history, downloads, and likes
 * 
 * Uses mathematical candidate scoring:
 *   Score = Relational + Affinity + Session - Fatigue
 * 
 * Applies greedy diversity placement:
 *   - No duplicate tracks
 *   - Max 3 tracks per artist
 *   - Max 2 tracks per album
 *   - 4-position artist separation
 */
export const AutoplayRadio = {
  async generateContinuationQueue(anchorTrack: PlayerTrack): Promise<PlayerTrack[]> {
    if (!anchorTrack || !anchorTrack.id) return [];

    const anchorArtist = (anchorTrack.artist || '').toLowerCase().trim();

    // ── 1. Online Seed-Based Radio Automix Candidates ─────────
    let automixTracks: PlayerTrack[] = [];
    if (isNativeCoreAvailable() && AuraYouTube) {
      try {
        const rawAutomix = await AuraYouTube.getRadioAutomix(anchorTrack.id).catch(() => []);
        if (Array.isArray(rawAutomix) && rawAutomix.length > 0) {
          automixTracks = rawAutomix
            .filter((item: any) => item && item.id && item.id !== anchorTrack.id)
            .filter((item: any) => item.musicVideoType !== 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE')
            .map((item: any, idx: number) => ({
              id: item.id,
              title: item.title,
              artist: item.artist || item.artistName || 'Unknown Artist',
              album: item.album || item.albumName || undefined,
              art: item.artworkUrl || item.thumbnail || '',
              url: '',
              duration: item.duration || (item.durationMs ? Math.round(item.durationMs / 1000) : 240),
              source: 'radio',
              isOfficial: Boolean(item.isOfficial),
              musicVideoType: item.musicVideoType,
              rankIndex: idx
            } as PlayerTrack & { rankIndex: number }));
        }
      } catch (e) {
        console.warn('[AutoplayRadio] Automix fetch error:', e);
      }
    }

    // ── 2. Local Taste Clusters & Historical Candidates ───────
    const analytics = useAnalyticsStore.getState();
    const { artistAffinities = {}, history = [], artistCache = {} } = analytics;

    // High Affinity Artists
    const sortedAffinities = Object.keys(artistAffinities)
      .map(key => ({ name: key, score: artistAffinities[key].score }))
      .sort((a, b) => b.score - a.score);
    const topArtists = sortedAffinities.slice(0, 8).map(a => a.name.toLowerCase().trim());

    // Related & Discovery Clusters
    const clusters = buildTasteClusters(artistAffinities, history, artistCache);
    const clusterB = clusters.find(c => c.id === 'cluster-related');
    const relatedArtists = clusterB ? clusterB.artists.map(a => a.toLowerCase().trim()) : [];

    const clusterC = clusters.find(c => c.id === 'cluster-exploration');
    const discoveryArtists = clusterC ? clusterC.artists.map(a => a.toLowerCase().trim()) : [];

    // Local Tracks (History + Downloads + Likes)
    const historyTracks = (history || [])
      .map((h: any) => h.trackSnapshot || h)
      .filter((t: any) => t && t.id && t.id !== anchorTrack.id);

    let downloadedTracks: any[] = [];
    try {
      const { useDownloadStore } = require('../../download/store/download.store');
      downloadedTracks = Object.values(useDownloadStore.getState().downloadedTracks || {});
    } catch (_) {}

    const likesStore = useLikesStore.getState();
    const likedSet = new Set(Object.keys(likesStore.likedTrackIds || {}));
    const likedTracks = Object.values(likesStore.trackMetadata || {});
    const downloadedSet = new Set(downloadedTracks.map((t: any) => t.id));

    // Map local tracks to unified candidates
    const localCandidates: PlayerTrack[] = [...historyTracks, ...downloadedTracks, ...likedTracks]
      .filter((t: any) => t && t.id && t.id !== anchorTrack.id)
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist || 'Unknown Artist',
        album: t.album || undefined,
        art: t.art || t.artworkUrl || t.artwork || '',
        url: '',
        duration: t.duration || t.durationSec || 240,
        source: 'local',
        isOfficial: true,
      }));

    // Combine candidate pools
    const candidateMap = new Map<string, PlayerTrack>();
    automixTracks.forEach(t => candidateMap.set(t.id, t));
    localCandidates.forEach(t => {
      if (!candidateMap.has(t.id)) candidateMap.set(t.id, t);
    });

    const allCandidates = Array.from(candidateMap.values());
    if (allCandidates.length === 0) return [];

    // Active session tracks to avoid repetition
    const activeQueue = usePlayerStore.getState().queue || [];
    const activeTrackIds = new Set(activeQueue.map((t: PlayerTrack) => t.id));
    const activeArtists = new Set(activeQueue.map((t: PlayerTrack) => (t.artist || '').toLowerCase().trim()));

    // ── 3. Mathematical Scoring Model ─────────────────────────
    // Score = Relational + Affinity + Session - Fatigue
    const scoredCandidates = allCandidates.map(track => {
      const tArtist = (track.artist || '').toLowerCase().trim();
      let relational = 0;
      let affinity = 0;
      let session = 0;
      let fatigue = 0;

      // Relational: Automix rank, same artist, related clusters
      if ((track as any).source === 'radio') {
        const rIdx = (track as any).rankIndex ?? 10;
        relational += Math.max(15, 45 - rIdx * 1.5);
      }
      if (tArtist === anchorArtist) {
        relational += 28; // Strong relational bond with seed artist
      } else if (relatedArtists.includes(tArtist)) {
        relational += 20; // Related taste cluster
      } else if (discoveryArtists.includes(tArtist)) {
        relational += 12; // Discovery cluster
      }

      // Affinity: User lifetime listening affinity
      if (artistAffinities[tArtist]) {
        affinity += Math.min(25, (artistAffinities[tArtist].score || 0) * 6);
      } else if (topArtists.includes(tArtist)) {
        affinity += 15;
      }

      // Session: Freshness in current playback, liked/downloaded boosts
      if (!activeArtists.has(tArtist)) {
        session += 15; // Fresh artist in current listening session
      }
      if (likedSet.has(track.id)) {
        session += 14; // Liked track boost
      }
      if (downloadedSet.has(track.id)) {
        session += 10; // Offline availability boost
      }

      // Fatigue: Track already in active queue or skipped
      if (activeTrackIds.has(track.id)) {
        fatigue += 60;
      }
      const historyEntry = (history || []).find((h: any) => (h.trackId || h.id) === track.id);
      if (historyEntry && historyEntry.skipped) {
        fatigue += 30; // Skipped tracks deprioritized
      }
      if (track.musicVideoType === 'MUSIC_VIDEO_TYPE_UGC') {
        fatigue += 25;
      }

      const totalScore = relational + affinity + session - fatigue;
      return { track, score: totalScore };
    });

    // Sort descending by calculated score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // ── 4. Greedy Placement with Diversity Constraints ─────────
    const finalQueue: PlayerTrack[] = [];
    const artistCount = new Map<string, number>();
    const albumCount = new Map<string, number>();
    const seenIds = new Set<string>();

    seenIds.add(anchorTrack.id);

    const getArtistKey = (artist: string) => (artist || '').toLowerCase().trim();
    const getAlbumKey = (album?: string) => (album || '').toLowerCase().trim();

    const pool = scoredCandidates.map(sc => sc.track);

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

        // Constraint 1: Max 3 tracks per artist
        const aCount = artistCount.get(aKey) || 0;
        if (aCount >= 3) {
          pool.splice(i, 1);
          i--;
          continue;
        }

        // Constraint 2: Max 2 tracks per album
        if (alKey) {
          const alCount = albumCount.get(alKey) || 0;
          if (alCount >= 2) {
            pool.splice(i, 1);
            i--;
            continue;
          }
        }

        // Constraint 3: Artist separation (no same artist within 4 positions)
        const lookback = [anchorTrack, ...finalQueue].slice(-4);
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

      // Graceful fallback: relax separation constraint if pool is constrained
      if (!placed && pool.length > 0) {
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

    console.log(`[AutoplayRadio] Generated ${finalQueue.length} vibe continuation tracks for "${anchorTrack.title}" by ${anchorTrack.artist}`);
    return finalQueue;
  }
};
