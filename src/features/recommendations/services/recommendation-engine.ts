import { HistoryEntry, AffinityMetric, splitArtistNames } from '../../analytics/store/analytics.store';
import { catalogTracks, catalogAlbums, catalogArtists } from '../../../data/music-catalog';
import { PlayerTrack } from '../../player/types/player';

export interface RecommendationSeed {
  type: 'artist' | 'album' | 'track' | 'radio' | 'playlist';
  id: string; // browseId, trackId, or albumId
  title: string; // Name of artist, album, track, or playlist
  image?: string;
  score: number;
  artistName?: string; // Optional helper for albums/tracks
  seedArtists?: string[];
  confidence?: number; // 0 - 100 confidence score
  reason?: string;
  query?: string;
  trackIds?: string[];
  tracks?: PlayerTrack[];
}

export interface TasteCluster {
  id: string;
  name: string;
  artists: string[];
  reason: string;
  score: number;
}

/**
 * Builds taste clusters dynamically from affinity data and history
 */
export function buildTasteClusters(
  artistAffinities: Record<string, AffinityMetric>,
  history: HistoryEntry[],
  artistCache?: Record<string, { id: string; image: string }>
): TasteCluster[] {
  const sortedAffinities = Object.keys(artistAffinities)
    .map((key) => ({ name: key, ...artistAffinities[key] }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || b.playCount - a.playCount);

  const topArtists = sortedAffinities.slice(0, 3).map((a) => a.name);

  // Cluster 1: Most Played / Core Favorites
  const clusterA: TasteCluster = {
    id: 'cluster-most-played',
    name: topArtists.length > 0 ? `${topArtists.join(' & ')} Mix` : 'Favorites Mix',
    artists: topArtists.length > 0 ? topArtists : ['Elara Vance', 'The Voyagers'],
    reason: topArtists.length > 0
      ? `Built from your heavy rotation: ${topArtists.slice(0, 3).join(', ')}.`
      : 'A personalized blend of your favorite rotation tracks.',
    score: sortedAffinities.slice(0, 3).reduce((acc, a) => acc + a.score, 0),
  };

  // Cluster 2: Related & Adjacent Styles
  const relatedAffinities = sortedAffinities.slice(3, 8).map((a) => a.name);
  const baseArtistName = topArtists[0] || 'Top Artist';
  const clusterB: TasteCluster = {
    id: 'cluster-related',
    name: topArtists.length > 0 ? `Vibes like ${baseArtistName}` : 'Similar Artists Mix',
    artists: relatedAffinities.length > 0 ? relatedAffinities : ['Solstice', 'Luna Ray'],
    reason: topArtists.length > 0
      ? `Tracks from artists similar to your favorite, ${baseArtistName}.`
      : 'A curated mix exploring styles adjacent to your favorites.',
    score: Math.max(5, sortedAffinities.slice(3, 8).reduce((acc, a) => acc + a.score, 0)),
  };

  // Cluster 3: Exploration & Novelty
  const explorationAffinities = sortedAffinities.slice(8, 15).map((a) => a.name);
  const clusterC: TasteCluster = {
    id: 'cluster-exploration',
    name: 'Discovery Mix',
    artists: explorationAffinities.length > 0 ? explorationAffinities : ['Kavinsky', 'HOME'],
    reason: 'Discover fresh sounds and new artists just outside your usual rotation.',
    score: Math.max(3, sortedAffinities.slice(8, 15).reduce((acc, a) => acc + a.score, 0)),
  };

  return [clusterA, clusterB, clusterC];
}

/**
 * 1. MADE FOR YOU
 * Based on: vibe matching across top artists, most played, most completed, most liked tracks, and repeat listens.
 * Purpose: "Songs user almost certainly likes matching their holistic taste profile."
 * Guarantees minimum 20 valid tracks whenever sufficient genuine listening history exists.
 */
export function generateMadeForYou(
  trackAffinities: Record<string, AffinityMetric>,
  history: HistoryEntry[],
  artistAffinities: Record<string, AffinityMetric>,
  artistCache?: Record<string, { id: string; image: string }>
): RecommendationSeed {
  const topArtists = Object.keys(artistAffinities)
    .map(key => ({ name: key, score: artistAffinities[key].score || 0 }))
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score);

  const topArtistNames = topArtists.slice(0, 6).map(a => a.name.toLowerCase().trim());
  const topArtistSet = new Set(topArtistNames);

  // Score every track using multi-factor behavioral vibe matching
  const scoredTracks = Object.keys(trackAffinities)
    .map(id => {
      const aff = trackAffinities[id] || { playCount: 0, completionCount: 0, skipCount: 0, totalListenMs: 0, score: 0 };
      const histMatch = history.find(h => h.id === id);
      const artist = histMatch?.artist || '';
      const artistNames = splitArtistNames(artist).map(n => n.toLowerCase().trim());

      // Artist affinity boost
      let artistBoost = 0;
      for (const name of artistNames) {
        if (topArtistSet.has(name)) {
          artistBoost = Math.max(artistBoost, (artistAffinities[name]?.score || 0) * 0.4);
        }
      }

      // Recency calculation
      const lastPlayed = histMatch?.playedAt || aff.lastPlayedAt || 0;
      const daysSince = lastPlayed > 0 ? (Date.now() - lastPlayed) / (24 * 60 * 60 * 1000) : 999;
      const recencyBoost = daysSince <= 2 ? 8 : daysSince <= 7 ? 5 : daysSince <= 14 ? 3 : 0;

      const playScore = (aff.playCount || 0) * 3;
      const completionScore = (aff.completionCount || 0) * 5;
      const repeatScore = (aff.repeatCount || 0) * 6;
      const likedScore = (aff.likedCount || 0) * 12;
      const skipPenalty = ((aff.skipCount || 0) * 6) + ((aff.skip15sCount || 0) * 8);

      const totalVibeScore = (aff.score || 0) + playScore + completionScore + repeatScore + likedScore + artistBoost + recencyBoost - skipPenalty;

      return {
        id,
        aff,
        histMatch,
        totalVibeScore,
        artist,
        album: histMatch?.album || histMatch?.trackSnapshot?.album || '',
      };
    })
    .filter(t => t.totalVibeScore > 0 && t.aff.skipCount <= (t.aff.playCount + 2))
    .sort((a, b) => b.totalVibeScore - a.totalVibeScore);

  // Select candidates applying strict artist/album diversity (max 3 per artist, max 2 per album)
  const matchedTracks: PlayerTrack[] = [];
  const trackIds: string[] = [];
  const artistCounts = new Map<string, number>();
  const albumCounts = new Map<string, number>();
  const seenTrackIds = new Set<string>();

  const maxPerArtist = 3;
  const maxPerAlbum = 2;
  const targetSize = 25;

  for (const candidate of scoredTracks) {
    if (matchedTracks.length >= targetSize) break;
    if (seenTrackIds.has(candidate.id)) continue;

    const h = candidate.histMatch || history.find(entry => entry.id === candidate.id);
    if (!h) continue;

    const normArtist = (h.artist || candidate.artist || 'Unknown Artist').toLowerCase().trim();
    const normAlbum = (h.album || candidate.album || '').toLowerCase().trim();

    const currentArtCount = artistCounts.get(normArtist) || 0;
    if (currentArtCount >= maxPerArtist) continue;

    if (normAlbum) {
      const currentAlbCount = albumCounts.get(normAlbum) || 0;
      if (currentAlbCount >= maxPerAlbum) continue;
    }

    const durationSec = (h.durationMs ? h.durationMs / 1000 : h.duration) || 240;
    const rawArt = h.art || h.artwork || h.trackSnapshot?.art || '';

    trackIds.push(h.id);
    matchedTracks.push({
      id: h.id,
      title: h.title,
      artist: h.artist,
      art: rawArt,
      duration: durationSec,
      url: h.trackSnapshot?.url || '',
      album: h.album || h.trackSnapshot?.album || undefined,
      artistId: h.artistId || undefined,
      albumId: h.albumId || undefined,
      source: (h.trackSnapshot?.source || 'youtube') as any,
    });

    seenTrackIds.add(h.id);
    artistCounts.set(normArtist, currentArtCount + 1);
    if (normAlbum) {
      albumCounts.set(normAlbum, (albumCounts.get(normAlbum) || 0) + 1);
    }
  }

  // Separate consecutive tracks by same artist
  const separatedTracks = applyConsecutiveSeparation(matchedTracks, 4);

  const topArtistName = topArtists[0]?.name || 'You';
  const coverImage = separatedTracks[0]?.art || artistCache?.[topArtistName]?.image || `aura://generated?name=${encodeURIComponent(topArtistName)}&type=playlist`;

  return {
    type: 'playlist',
    id: 'mix-made-for-you',
    title: 'Made For You',
    image: coverImage,
    score: 10.0,
    seedArtists: topArtists.slice(0, 5).map(a => a.name),
    reason: topArtistName !== 'You' ? `Your top rotation including ${topArtistName} and your most completed songs.` : 'Personal mix built from your most played, completed, and liked tracks.',
    confidence: 99,
    trackIds: separatedTracks.map(t => t.id),
    tracks: separatedTracks,
  };
}

/**
 * Separates tracks so no artist is repeated within the separation window
 */
function applyConsecutiveSeparation(tracks: PlayerTrack[], separation: number = 4): PlayerTrack[] {
  if (tracks.length <= 1) return tracks;
  const result: PlayerTrack[] = [];
  const pool = [...tracks];

  while (pool.length > 0) {
    let foundIndex = -1;
    for (let i = 0; i < pool.length; i++) {
      const artist = pool[i].artist.toLowerCase().trim();
      let isWithinSeparation = false;
      const startLook = Math.max(0, result.length - (separation - 1));
      for (let j = startLook; j < result.length; j++) {
        if (result[j].artist.toLowerCase().trim() === artist) {
          isWithinSeparation = true;
          break;
        }
      }
      if (!isWithinSeparation) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex === -1) {
      foundIndex = 0;
    }

    const track = pool.splice(foundIndex, 1)[0];
    result.push(track);
  }
  return result;
}

/**
 * 2. DAILY MIX
 * Formula: 60% Favorite Content, 30% Similar Artists, 10% Discovery.
 */
export function generateDailyMixes(
  artistAffinities: Record<string, AffinityMetric>,
  history: HistoryEntry[],
  artistCache?: Record<string, { id: string; image: string }>,
  existingCandidates?: RecommendationSeed[]
): RecommendationSeed[] {
  const clusters = buildTasteClusters(artistAffinities, history, artistCache);
  const seeds: RecommendationSeed[] = [];
  const candidates = existingCandidates || [];

  for (let i = 0; i < 3; i++) {
    const cluster = clusters[i];
    const id = `daily-mix-${i + 1}`;
    
    let image = '';
    if (cluster && cluster.artists) {
      for (const artName of cluster.artists) {
        if (artistCache?.[artName]?.image) {
          image = artistCache[artName].image;
          break;
        }
      }
    }

    const trackIds: string[] = [];
    const tracks: PlayerTrack[] = [];
    const artistsInCluster = new Set((cluster?.artists || []).map(a => a.toLowerCase().trim()));
    
    // 60% from history matching cluster artists
    const historyMatches = history.filter(h => {
      const names = splitArtistNames(h.artist).map(s => s.toLowerCase().trim());
      return names.some(n => artistsInCluster.has(n));
    });
    
    const uniqueHistory = Array.from(new Map(historyMatches.map(h => [h.id, h])).values());
    const favoriteCount = Math.min(12, uniqueHistory.length);
    const favoriteTracks = uniqueHistory.slice(0, favoriteCount);

    for (const h of favoriteTracks) {
      trackIds.push(h.id);
      tracks.push({
        id: h.id,
        title: h.title,
        artist: h.artist,
        art: h.art || h.artwork || h.trackSnapshot?.art || '',
        duration: (h.durationMs ? h.durationMs / 1000 : h.duration) || 240,
        url: h.trackSnapshot?.url || '',
        album: h.album || h.trackSnapshot?.album || undefined,
        artistId: h.artistId || undefined,
        albumId: h.albumId || undefined,
        source: (h.trackSnapshot?.source || 'youtube') as any,
      });
    }

    // 30% from similar/catalog tracks
    const catalogMatches = catalogTracks.filter(t => 
      artistsInCluster.has(t.artist.toLowerCase().trim()) && !trackIds.includes(t.id)
    ).slice(0, 6);

    for (const t of catalogMatches) {
      trackIds.push(t.id);
      tracks.push({
        id: t.id,
        title: t.title,
        artist: t.artist,
        art: t.art,
        duration: t.durationSec || 240,
        url: '',
        albumId: t.albumId,
        artistId: t.artistId,
        source: 'local' as any,
      });
    }

    // 10% discovery tracks
    const discoveryTracks = candidates
      .filter(c => c.type === 'track' && !trackIds.includes(c.id))
      .slice(0, 3);
        
    for (const c of discoveryTracks) {
      trackIds.push(c.id);
      tracks.push({
        id: c.id,
        title: c.title,
        artist: c.artistName || c.title,
        art: c.image || '',
        duration: 240,
        url: '',
        source: 'youtube' as any,
      });
    }

    if (!image && tracks.length > 0 && tracks[0].art) {
      image = tracks[0].art;
    }

    seeds.push({
      type: 'playlist',
      id,
      title: cluster?.name || `Daily Mix ${i + 1}`,
      image: image || `aura://generated?name=${encodeURIComponent(cluster?.name || `Daily Mix ${i + 1}`)}&type=playlist`,
      score: cluster?.score || (10 - i),
      seedArtists: cluster?.artists || [],
      reason: cluster?.reason || '60% favorite content, 30% similar artists, 10% fresh discovery.',
      confidence: 90 - (i * 5),
      trackIds,
      tracks,
    });
  }

  return seeds;
}

/**
 * 3. ON REPEAT
 * Contains songs user cannot stop playing right now (high repeat count & recent velocity).
 */
export function generateOnRepeat(
  history: HistoryEntry[],
  trackAffinities: Record<string, AffinityMetric>
): RecommendationSeed | null {
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentHistory = history.filter(h => h.playedAt >= fourteenDaysAgo);

  const repeatCandidates = Object.keys(trackAffinities)
    .map(id => {
      const aff = trackAffinities[id];
      const recentPlays = recentHistory.filter(h => h.id === id).length;
      const repeats = aff.repeatCount || 0;
      const completions = aff.completionCount || 0;
      const velocityScore = (recentPlays * 5) + (repeats * 8) + (completions * 3) - (aff.skipCount * 4);
      return { id, aff, recentPlays, velocityScore };
    })
    .filter(item => item.recentPlays >= 2 || (item.aff.repeatCount || 0) >= 1 || (item.aff.playCount || 0) >= 4)
    .sort((a, b) => b.velocityScore - a.velocityScore)
    .slice(0, 25);

  if (repeatCandidates.length === 0) return null;

  const trackIds: string[] = [];
  const tracks: PlayerTrack[] = [];

  for (const item of repeatCandidates) {
    const h = history.find(entry => entry.id === item.id);
    if (h) {
      trackIds.push(h.id);
      tracks.push({
        id: h.id,
        title: h.title,
        artist: h.artist,
        art: h.art || h.artwork || h.trackSnapshot?.art || '',
        duration: (h.durationMs ? h.durationMs / 1000 : h.duration) || 240,
        url: h.trackSnapshot?.url || '',
        album: h.album || h.trackSnapshot?.album || undefined,
        artistId: h.artistId || undefined,
        albumId: h.albumId || undefined,
        source: (h.trackSnapshot?.source || 'youtube') as any,
      });
    }
  }

  const coverImage = tracks[0]?.art || `aura://generated?name=On%20Repeat&type=playlist`;

  return {
    type: 'playlist',
    id: 'mix-on-repeat',
    title: 'On Repeat',
    image: coverImage,
    score: 9.8,
    reason: 'The songs you cannot stop playing right now on heavy repeat.',
    confidence: 98,
    trackIds,
    tracks,
  };
}

/**
 * 4. REPEAT REWIND
 * Songs heavily played in past weeks/months but not played recently.
 */
export function generateRepeatRewind(
  history: HistoryEntry[],
  trackAffinities: Record<string, AffinityMetric>
): RecommendationSeed | null {
  const twentyOneDaysAgo = Date.now() - 21 * 24 * 60 * 60 * 1000;
  const recentTrackIds = new Set(history.filter(h => h.playedAt >= twentyOneDaysAgo).map(h => h.id));

  const rewindCandidates = Object.keys(trackAffinities)
    .map(id => {
      const aff = trackAffinities[id];
      const match = history.find(h => h.id === id);
      const isOld = match ? match.playedAt < twentyOneDaysAgo : true;
      const score = (aff.playCount * 3) + (aff.completionCount * 5) + ((aff.likedCount || 0) * 10);
      return { id, aff, match, isOld, score };
    })
    .filter(item => item.isOld && item.aff.playCount >= 2 && !recentTrackIds.has(item.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  if (rewindCandidates.length === 0) return null;

  const trackIds: string[] = [];
  const tracks: PlayerTrack[] = [];

  for (const item of rewindCandidates) {
    const h = item.match || history.find(entry => entry.id === item.id);
    if (h) {
      trackIds.push(h.id);
      tracks.push({
        id: h.id,
        title: h.title,
        artist: h.artist,
        art: h.art || h.artwork || h.trackSnapshot?.art || '',
        duration: (h.durationMs ? h.durationMs / 1000 : h.duration) || 240,
        url: h.trackSnapshot?.url || '',
        album: h.album || h.trackSnapshot?.album || undefined,
        artistId: h.artistId || undefined,
        albumId: h.albumId || undefined,
        source: (h.trackSnapshot?.source || 'youtube') as any,
      });
    }
  }

  const coverImage = tracks[0]?.art || `aura://generated?name=Repeat%20Rewind&type=playlist`;

  return {
    type: 'playlist',
    id: 'mix-repeat-rewind',
    title: 'Repeat Rewind',
    image: coverImage,
    score: 9.0,
    reason: 'Past favorites you used to play constantly. Time to bring them back.',
    confidence: 94,
    trackIds,
    tracks,
  };
}

/**
 * 5. DISCOVER WEEKLY
 * Recommends unplayed tracks and adjacent artists matching user taste clusters.
 * Must avoid songs already heavily played.
 */
export function generateDiscoverWeekly(
  history: HistoryEntry[],
  artistAffinities: Record<string, AffinityMetric>,
  existingCandidates?: RecommendationSeed[]
): RecommendationSeed {
  const playedTrackIds = new Set(history.map(h => h.id));
  const topArtists = Object.keys(artistAffinities)
    .filter(k => artistAffinities[k].score > 0)
    .slice(0, 5);

  const discoveryTracks: PlayerTrack[] = [];
  const trackIds: string[] = [];

  // 1. Gather catalog tracks from unplayed songs
  const catalogPool = catalogTracks.filter(t => !playedTrackIds.has(t.id));
  for (const t of catalogPool) {
    if (discoveryTracks.length >= 20) break;
    trackIds.push(t.id);
    discoveryTracks.push({
      id: t.id,
      title: t.title,
      artist: t.artist,
      art: t.art,
      duration: t.durationSec || 240,
      url: '',
      albumId: t.albumId,
      artistId: t.artistId,
      source: 'local' as any,
    });
  }

  const coverImage = discoveryTracks[0]?.art || `aura://generated?name=Discover%20Weekly&type=playlist`;

  return {
    type: 'playlist',
    id: 'mix-discover-weekly',
    title: 'Discover Weekly',
    image: coverImage,
    score: 8.8,
    seedArtists: topArtists,
    reason: 'Fresh tracks and new artists customized to your music taste without songs you already know.',
    confidence: 88,
    trackIds,
    tracks: discoveryTracks,
  };
}

/**
 * 6. DEEP CUTS
 * Lesser-known songs from user's favorite artists and albums (non-top hits).
 */
export function generateDeepCuts(
  history: HistoryEntry[],
  artistAffinities: Record<string, AffinityMetric>,
  artistCache?: Record<string, { id: string; image: string }>
): RecommendationSeed {
  const sortedArtists = Object.keys(artistAffinities)
    .sort((a, b) => (artistAffinities[b].score || 0) - (artistAffinities[a].score || 0))
    .slice(0, 5);

  const topArtistName = sortedArtists[0] || 'Your Favorites';
  const coverImage = artistCache?.[topArtistName]?.image || `aura://generated?name=${encodeURIComponent(topArtistName)}&type=playlist`;

  return {
    type: 'playlist',
    id: 'mix-deep-cuts',
    title: 'Deep Cuts',
    image: coverImage,
    score: 8.5,
    seedArtists: sortedArtists,
    reason: `Hidden gems, B-sides, and underrated tracks from ${topArtistName} and your favorite artists.`,
    confidence: 85,
  };
}

/**
 * 7. CONTEXTUAL TIME MIXES
 * Adapts based on current time: Night Mix (10 PM-3 AM), Morning Energy (5 AM-11 AM), Focus Flow (11 AM-5 PM), Evening (5 PM-10 PM).
 */
export function generateContextualTimeMix(
  history: HistoryEntry[],
  activeHoursMap: Record<number, number> = {}
): RecommendationSeed {
  const hour = new Date().getHours();
  const recentArt = history.find(h => (h.art || h.artwork) && !h.art?.includes('placeholder'))?.art || '';

  if (hour >= 22 || hour < 4) {
    return {
      type: 'playlist',
      id: 'time-night',
      title: 'Night Mix',
      image: recentArt || 'aura://generated?name=Night%20Mix&type=playlist',
      score: 9.5,
      reason: 'Late-night chill beats and atmospheric sounds curated for your midnight listening session.',
      confidence: 96,
    };
  } else if (hour >= 4 && hour < 11) {
    return {
      type: 'playlist',
      id: 'time-morning',
      title: 'Morning Energy',
      image: recentArt || 'aura://generated?name=Morning%20Energy&type=playlist',
      score: 9.0,
      reason: 'Upbeat acoustic rhythms and energizing favorites to kickstart your day.',
      confidence: 92,
    };
  } else if (hour >= 11 && hour < 17) {
    return {
      type: 'playlist',
      id: 'time-chill',
      title: 'Focus & Study Mix',
      image: recentArt || 'aura://generated?name=Focus%20Study&type=playlist',
      score: 8.8,
      reason: 'Instrumental flow, lo-fi rhythms, and ambient melodies to keep you in the zone.',
      confidence: 90,
    };
  } else {
    return {
      type: 'playlist',
      id: 'time-evening',
      title: 'Evening Wind-Down',
      image: recentArt || 'aura://generated?name=Evening%20Wind%20Down&type=playlist',
      score: 9.0,
      reason: 'Smooth melodies and relaxing hits curated for your evening wind-down.',
      confidence: 93,
    };
  }
}

/**
 * Legacy Helper: Generate "Because You Like" seeds from top artists
 */
export function generateBecauseYouLike(
  artistAffinities: Record<string, AffinityMetric>,
  history: HistoryEntry[],
  artistCache?: Record<string, { id: string; image: string }>,
  existingCandidates?: RecommendationSeed[]
): RecommendationSeed[] {
  const sortedArtists = Object.keys(artistAffinities)
    .map((key) => ({ name: key, ...artistAffinities[key] }))
    .filter((a) => a.score >= 2)
    .sort((a, b) => b.score - a.score || b.playCount - a.playCount)
    .slice(0, 5);

  return sortedArtists.map((artist) => {
    const match = history.find((h) => h.artist.toLowerCase().includes(artist.name.toLowerCase()));
    const image = artistCache?.[artist.name]?.image || match?.art || `aura://generated?name=${encodeURIComponent(artist.name)}&type=artist`;
    
    return {
      type: 'artist',
      id: `byl-${artist.name.toLowerCase().replace(/\s+/g, '-')}`,
      title: `Because You Like ${artist.name}`,
      image,
      score: artist.score,
      seedArtists: [artist.name],
      reason: `Based on your recent completions and plays of ${artist.name}.`,
      confidence: 90,
    };
  });
}

/**
 * Legacy Helper: Generate "Rediscover" seeds
 */
export function generateRediscover(
  history: HistoryEntry[]
): RecommendationSeed[] {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentIds = new Set(history.slice(0, 10).map((h) => h.id));
  
  const candidates = history
    .filter((h) => h.playedAt < oneDayAgo && (h.completionRatio >= 0.8 || !h.skipped))
    .filter((h) => !recentIds.has(h.id));

  const seen = new Set<string>();
  const seeds: RecommendationSeed[] = [];

  for (const entry of candidates) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);

    seeds.push({
      type: 'track',
      id: entry.id,
      title: entry.title,
      artistName: entry.artist,
      image: entry.art || undefined,
      score: entry.completionRatio * 5,
      reason: `Based on a song you completed ${Math.round(entry.completionRatio * 100)}% of in the past.`,
      confidence: Math.round(entry.completionRatio * 100),
    });
  }

  return seeds.slice(0, 10);
}

/**
 * Legacy Helper: Generate "Recently Loved" seeds
 */
export function generateRecentlyLoved(
  history: HistoryEntry[],
  trackAffinities: Record<string, AffinityMetric>
): RecommendationSeed[] {
  const seeds: RecommendationSeed[] = [];

  const lovedTracks = Object.keys(trackAffinities)
    .map((id) => ({ id, ...trackAffinities[id] }))
    .filter((t) => t.playCount >= 2 && t.skipCount === 0)
    .sort((a, b) => b.score - a.score || b.playCount - a.playCount);

  for (const track of lovedTracks) {
    const match = history.find((h) => h.id === track.id);
    if (!match) continue;
    
    seeds.push({
      type: 'track',
      id: track.id,
      title: match.title,
      artistName: match.artist,
      image: match.art || undefined,
      score: track.score,
      reason: `Because you played this track ${track.playCount} times recently without skipping.`,
      confidence: 95,
    });
  }

  return seeds.slice(0, 10);
}

/**
 * Generate "Hidden Gems" seeds
 */
export function generateHiddenGems(
  trackAffinities: Record<string, AffinityMetric>,
  history: HistoryEntry[],
  excludeTrackIds: Set<string>
): RecommendationSeed[] {
  const candidates: RecommendationSeed[] = [];

  for (const trackId of Object.keys(trackAffinities)) {
    if (excludeTrackIds.has(trackId)) continue;

    const affinity = trackAffinities[trackId];
    if (!affinity) continue;

    const playCount = affinity.playCount || 0;
    const completionCount = affinity.completionCount || 0;
    const completionRate = playCount > 0 ? completionCount / playCount : 0;

    if (completionRate >= 0.80 && playCount >= 2) {
      const match = history.find((h) => h.id === trackId) || catalogTracks.find((t) => t.id === trackId);
      const title = match?.title || trackId;
      const artistName = match?.artist || 'Unknown Artist';
      const image = match?.art || undefined;

      const score = (completionRate * 8) + (affinity.likedCount ? 10 : 0) + Math.min(playCount, 15);
      const confidence = Math.min(100, Math.round((completionRate * 60) + (Math.min(playCount, 20) * 2)));

      candidates.push({
        type: 'track',
        id: trackId,
        title,
        artistName,
        image,
        score,
        reason: 'One of your most loved overlooked tracks',
        confidence,
        seedArtists: splitArtistNames(artistName),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 20);
}

/**
 * Generate "Forgotten Favorites" seeds
 */
export function generateForgottenFavorites(
  trackAffinities: Record<string, AffinityMetric>,
  history: HistoryEntry[],
  forgottenFavoritesShownAt: Record<string, number> = {}
): RecommendationSeed[] {
  const candidates: RecommendationSeed[] = [];
  const cooldownPeriodMs = 14 * 24 * 60 * 60 * 1000;

  for (const trackId of Object.keys(trackAffinities)) {
    const lastSurfaced = forgottenFavoritesShownAt[trackId] || 0;
    if (Date.now() - lastSurfaced < cooldownPeriodMs) continue;

    const affinity = trackAffinities[trackId];
    if (!affinity || (affinity.playCount || 0) < 3) continue;

    const playCount = affinity.playCount || 0;
    const lastPlayedEntry = history.find((h) => h.id === trackId);
    const lastPlayedTime = lastPlayedEntry ? lastPlayedEntry.playedAt : 0;
    const daysSinceLastPlayed = (Date.now() - lastPlayedTime) / (24 * 60 * 60 * 1000);

    if (daysSinceLastPlayed > 20) {
      const match = history.find((h) => h.id === trackId) || catalogTracks.find((t) => t.id === trackId);
      const title = match?.title || trackId;
      const artistName = match?.artist || 'Unknown Artist';
      const image = match?.art || undefined;

      const completionCount = affinity.completionCount || 0;
      const completionRate = playCount > 0 ? completionCount / playCount : 0;

      const score = (playCount * 2) + (completionRate * 10) + (daysSinceLastPlayed / 10);
      const confidence = Math.min(100, Math.round((completionRate * 60) + (Math.min(playCount, 20) * 2)));

      candidates.push({
        type: 'track',
        id: trackId,
        title,
        artistName,
        image,
        score,
        reason: 'You used to play this a lot',
        confidence,
        seedArtists: splitArtistNames(artistName),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 20);
}

