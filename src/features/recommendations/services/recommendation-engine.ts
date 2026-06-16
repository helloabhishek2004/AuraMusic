import { HistoryEntry, AffinityMetric, splitArtistNames } from '../../analytics/store/analytics.store';
import { catalogTracks, catalogAlbums } from '../../../data/music-catalog';

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
  trackIds?: string[];
  tracks?: any[];
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
  // Sort artist affinities by score
  const sortedAffinities = Object.keys(artistAffinities)
    .map((key) => ({ name: key, ...artistAffinities[key] }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || b.playCount - a.playCount);

  const topArtists = sortedAffinities.slice(0, 3).map((a) => a.name);

  // Cluster A: Most Played Artists
  const clusterA: TasteCluster = {
    id: 'cluster-most-played',
    name: topArtists.length > 0 ? `${topArtists.join(' & ')} Mix` : 'My Favorites Mix',
    artists: topArtists.length > 0 ? topArtists : ['Lumina Synthetics', 'Synthwave Collective'],
    reason: topArtists.length > 0
      ? `Built from your top rotation artists: ${topArtists.slice(0, 3).join(', ')}.`
      : 'A personalized mix of your top-rotation tracks.',
    score: sortedAffinities.slice(0, 3).reduce((acc, a) => acc + a.score, 0),
  };

  // Cluster B: Related Artists (artists with medium affinity scores)
  const relatedAffinities = sortedAffinities.slice(3, 8).map((a) => a.name);
  const baseArtistName = topArtists[0] || 'Aura';
  const clusterB: TasteCluster = {
    id: 'cluster-related',
    name: topArtists.length > 0 ? `Alternative to ${baseArtistName} Mix` : 'Discover Similar Mix',
    artists: relatedAffinities.length > 0 ? relatedAffinities : ['HOME', 'The Midnight', 'M83'],
    reason: topArtists.length > 0
      ? `A blend of tracks from artists similar to your favorite, ${baseArtistName}.`
      : 'A curated mix exploring styles adjacent to your favorites.',
    score: Math.max(5, sortedAffinities.slice(3, 8).reduce((acc, a) => acc + a.score, 0)),
  };

  // Cluster C: Exploration Artists (lower affinity score artists or discovery)
  const explorationAffinities = sortedAffinities.slice(8, 15).map((a) => a.name);
  const clusterC: TasteCluster = {
    id: 'cluster-exploration',
    name: 'Discovery Mix',
    artists: explorationAffinities.length > 0 ? explorationAffinities : ['Voyagers', 'Cosmic Echo', 'Elara'],
    reason: 'Discover fresh sounds and new artists just outside your usual rotation.',
    score: Math.max(3, sortedAffinities.slice(8, 15).reduce((acc, a) => acc + a.score, 0)),
  };

  return [clusterA, clusterB, clusterC];
}

/**
 * Generate 3 Daily Mix seeds from dynamic taste clusters
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
    
    let image = `https://picsum.photos/400/400?random=${101 + i}`;
    if (cluster && cluster.artists) {
      for (const artName of cluster.artists) {
        if (artistCache?.[artName]?.image) {
          image = artistCache[artName].image;
          break;
        }
      }
    }

    const trackIds: string[] = [];
    const tracks: any[] = [];
    const artistsInCluster = new Set(cluster?.artists || []);
    
    // 70% from history based on cluster artists
    const historyMatches = history.filter(h => {
        const names = h.artist.split(',').map(s => s.trim());
        return names.some(n => artistsInCluster.has(n));
    });
    
    // Deduplicate history matches by ID
    const uniqueHistory = Array.from(new Map(historyMatches.map(h => [h.id, h])).values());
    const historyCount = Math.min(10, uniqueHistory.length);
    const historyTracks = uniqueHistory.slice(0, historyCount).map(h => h.id);
    const historyTrackObjects = uniqueHistory.slice(0, historyCount).map(h => ({
        id: h.id,
        title: h.title,
        artist: h.artist,
        artwork: h.art,
        duration: h.positionMs || 0, // Fallback, could be missing in history
        url: '' // Resolved later by player
    }));
    
    // 30% from existing candidates (discovery)
    const discoveryTracks = candidates
        .filter(c => c.type === 'track' && !historyTracks.includes(c.id))
        .slice(0, 5);
        
    const discoveryTrackObjects = discoveryTracks.map(c => ({
        id: c.id,
        title: c.title,
        artist: c.artistName || c.title,
        artwork: c.image,
        duration: 0,
        url: ''
    }));
        
    trackIds.push(...historyTracks, ...discoveryTracks.map(c => c.id));
    tracks.push(...historyTrackObjects, ...discoveryTrackObjects);

    seeds.push({
      type: 'playlist',
      id,
      title: cluster?.name || `Daily Mix ${i + 1}`,
      image,
      score: cluster?.score || 0,
      seedArtists: cluster?.artists || [],
      reason: cluster?.reason || 'Daily soundtrack tailored to your mood.',
      confidence: 85 - (i * 5), // High confidence scores 85, 80, 75
      trackIds,
      tracks,
    });
  }

  return seeds;
}

/**
 * Generate "Because You Like" seeds from top artists
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
    
  const candidates = existingCandidates || [];

  return sortedArtists.map((artist) => {
    const match = history.find((h) => h.artist === artist.name);
    const image = artistCache?.[artist.name]?.image || match?.art || `https://picsum.photos/400/400?random=${encodeURIComponent(artist.name)}`;
    
    // Calculate internal confidence
    let confidence = 45;
    if (artist.playCount >= 3 && (artist.skipCount / artist.playCount) < 0.3) {
      confidence = 90;
    } else if (artist.playCount >= 1 && (artist.skipCount / artist.playCount) < 0.6) {
      confidence = 70;
    }
    
    const trackIds: string[] = [];
    const tracks: any[] = [];
    const historyMatches = history.filter(h => h.artist.includes(artist.name));
    const uniqueHistory = Array.from(new Map(historyMatches.map(h => [h.id, h])).values());
    const historyTracks = uniqueHistory.slice(0, 10).map(h => h.id);
    const historyTrackObjects = uniqueHistory.slice(0, 10).map(h => ({
        id: h.id,
        title: h.title,
        artist: h.artist,
        artwork: h.art,
        duration: h.positionMs || 0,
        url: ''
    }));
    
    const discoveryTracks = candidates
        .filter(c => c.type === 'track' && !historyTracks.includes(c.id))
        .slice(0, 5);
        
    const discoveryTrackObjects = discoveryTracks.map(c => ({
        id: c.id,
        title: c.title,
        artist: c.artistName || c.title,
        artwork: c.image,
        duration: 0,
        url: ''
    }));
        
    trackIds.push(...historyTracks, ...discoveryTracks.map(c => c.id));
    tracks.push(...historyTrackObjects, ...discoveryTrackObjects);

    return {
      type: 'artist',
      id: match?.artistId || artist.name,
      title: artist.name,
      image,
      score: artist.score,
      seedArtists: [artist.name],
      reason: `Because you completed ${artist.completionCount} song${artist.completionCount !== 1 ? 's' : ''} by ${artist.name} recently.`,
      confidence,
      trackIds,
      tracks,
    };
  });
}

/**
 * Generate "Rediscover" seeds
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
      image: entry.art || 'https://picsum.photos/400/400?random=17',
      score: entry.completionRatio * 5,
      reason: `Based on a song you completed ${Math.round(entry.completionRatio * 100)}% of in the past.`,
      confidence: Math.round(entry.completionRatio * 100),
    });
  }

  return seeds.slice(0, 10);
}

/**
 * Generate "Recently Loved" seeds
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
      image: match.art || 'https://picsum.photos/400/400?random=18',
      score: track.score,
      reason: `Because you played this track ${track.playCount} times recently without skipping.`,
      confidence: 95,
    });
  }

  return seeds.slice(0, 10);
}

/**
 * Generate time-of-day specific picks based on listening hour distributions
 */
export function generateTimeBasedPicks(
  history: HistoryEntry[],
  sessionProfile?: { morning: number; commute: number; night: number; weekend: number }
): RecommendationSeed[] {
  const seeds: RecommendationSeed[] = [];
  const profile = sessionProfile || { morning: 25, commute: 25, night: 25, weekend: 25 };
  
  const currentHour = new Date().getHours();
  
  // 1. Morning Energy (5:00 - 10:00)
  if (profile.morning > 10 || (currentHour >= 5 && currentHour < 10)) {
    seeds.push({
      type: 'playlist',
      id: 'time-morning',
      title: 'Morning Energy',
      image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=480',
      score: 8.0,
      reason: profile.morning > 10 
        ? `Fits your morning listening pattern (${profile.morning}% of plays).`
        : 'Energize your morning with these favorites.',
      confidence: profile.morning > 10 ? Math.min(95, 50 + profile.morning) : 60,
    });
  }
  
  // 2. Evening Favorites (17:00 - 22:00)
  if (profile.commute > 10 || (currentHour >= 17 && currentHour < 22)) {
    seeds.push({
      type: 'playlist',
      id: 'time-evening',
      title: 'Evening Favorites',
      image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=480',
      score: 8.0,
      reason: profile.commute > 10 
        ? `Fits your typical evening wind-down (${profile.commute}% of plays).`
        : 'Unwind with your favorite evening tracks.',
      confidence: profile.commute > 10 ? Math.min(95, 50 + profile.commute) : 60,
    });
  }
  
  // 3. Late Night Picks (22:00 - 03:00)
  if (profile.night > 10 || (currentHour >= 22 || currentHour < 3)) {
    seeds.push({
      type: 'playlist',
      id: 'time-latenight',
      title: 'Late Night Picks',
      image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=480',
      score: 8.5,
      reason: profile.night > 10 
        ? `Matches your recent late-night listening habits (${profile.night}% of plays).`
        : 'Chill midnight vibes selected for you.',
      confidence: profile.night > 10 ? Math.min(95, 50 + profile.night) : 60,
    });
  }
  
  return seeds;
}

/**
 * Generate custom themed "Made For You" playlists seeds
 */
export function generateMadeForYou(
  artistAffinities: Record<string, AffinityMetric>,
  history: HistoryEntry[],
  artistCache?: Record<string, { id: string; image: string }>,
  sessionProfile?: { morning: number; commute: number; night: number; weekend: number }
): RecommendationSeed[] {
  const seeds: RecommendationSeed[] = [];
  
  const sortedArtists = Object.keys(artistAffinities)
    .map((key) => ({ name: key, ...artistAffinities[key] }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score);

  const topArtistName = sortedArtists[0]?.name || 'Discovery';
  const topArtistImage = artistCache?.[topArtistName]?.image || 'https://picsum.photos/400/400?random=19';

  // 1. Daily Mix (70% favorites, 20% related, 10% explore)
  seeds.push({
    type: 'playlist',
    id: 'mix-daily',
    title: 'Daily Mix',
    image: topArtistImage,
    score: 10,
    seedArtists: sortedArtists.slice(0, 5).map(a => a.name),
    reason: 'Balanced mix: 70% familiar tracks, 20% related suggestions, 10% discovery.',
    confidence: 95,
  });

  // 2. Comfort Zone (highest affinity artists, highest completion tracks, no exploration)
  seeds.push({
    type: 'playlist',
    id: 'mix-comfort-zone',
    title: 'Comfort Zone',
    image: 'https://picsum.photos/400/400?random=20',
    score: 9.5,
    seedArtists: sortedArtists.slice(0, 3).map(a => a.name),
    reason: 'Highest affinity artists and completed songs. Just the music you love.',
    confidence: 98,
  });

  // 3. Discovery Mix (30% favorites, 70% new artists in matching taste cluster)
  seeds.push({
    type: 'playlist',
    id: 'mix-discovery-mix',
    title: 'Discovery Mix',
    image: 'https://picsum.photos/400/400?random=21',
    score: 8.5,
    seedArtists: sortedArtists.slice(0, 5).map(a => a.name),
    reason: 'Discovery special: 30% favorites, 70% new artists in your taste cluster.',
    confidence: 88,
  });

  // 4. Time-based / Session-based Picks
  const timePicks = generateTimeBasedPicks(history, sessionProfile);
  seeds.push(...timePicks);

  return seeds;
}

/**
 * Generates the "Trending For You" personalized charts seed.
 * Note: The actual scoring filter and MAX_ARTIST_SHARE cap are computed at hydration runtime.
 */
export function generateTrendingForYou(
  tasteConfidence: number,
  primarySession: string
): RecommendationSeed {
  let explanation = 'Popular songs dynamically filtered to match your music style.';
  if (primarySession === 'night') {
    explanation = 'Popular chart hits curated for your late-night listening vibe.';
  } else if (primarySession === 'morning') {
    explanation = 'Trending tracks customized for your morning energy.';
  }

  return {
    type: 'playlist',
    id: 'trending-for-you',
    title: 'Trending For You',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=480',
    score: 9.2,
    reason: `${explanation} (Taste match confidence: ${tasteConfidence}%).`,
    confidence: Math.max(50, tasteConfidence),
  };
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

    // Qualification: completionRate >= 0.80 and playCount >= 2
    if (completionRate >= 0.80 && playCount >= 2) {
      const match = history.find((h) => h.id === trackId) || catalogTracks.find((t) => t.id === trackId);
      const title = match?.title || trackId;
      const artistName = match?.artist || 'Unknown Artist';
      const image = match?.art || undefined;

      const liked = (affinity.likedCount || 0) > 0;

      // Calculate recentPlayPenalty
      const lastPlayedEntry = history.find((h) => h.id === trackId);
      let recentPlayPenalty = 0;
      if (lastPlayedEntry) {
        const daysSinceLastPlay = (Date.now() - lastPlayedEntry.playedAt) / (24 * 60 * 60 * 1000);
        if (daysSinceLastPlay <= 1) {
          recentPlayPenalty = 10;
        } else if (daysSinceLastPlay <= 3) {
          recentPlayPenalty = 5;
        } else if (daysSinceLastPlay <= 7) {
          recentPlayPenalty = 3;
        } else if (daysSinceLastPlay <= 14) {
          recentPlayPenalty = 1;
        }
      }

      const score = (completionRate * 8) + (liked ? 10 : 0) + Math.min(playCount, 15) - recentPlayPenalty;
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

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Apply Diversity Cap during selection: MAX_ARTIST_SHARE = 2, MAX_ALBUM_SHARE = 2
  const selected: RecommendationSeed[] = [];
  const artistCounts = new Map<string, number>();
  const albumCounts = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.length >= 25) break;

    const artistKey = candidate.artistName?.toLowerCase().trim() || '';
    // Let's resolve the album name from catalog or history to apply album diversity caps
    const match = history.find((h) => h.id === candidate.id) || catalogTracks.find((t) => t.id === candidate.id);
    const albumKey = (match && 'album' in match ? match.album : (match?.albumId ? catalogAlbums.find((a) => a.id === match.albumId)?.title : ''))?.toLowerCase().trim() || '';

    // Check artist cap
    const artistShare = artistCounts.get(artistKey) || 0;
    if (artistShare >= 2) continue;

    // Check album cap
    if (albumKey) {
      const albumShare = albumCounts.get(albumKey) || 0;
      if (albumShare >= 2) continue;
    }

    selected.push(candidate);
    artistCounts.set(artistKey, artistShare + 1);
    if (albumKey) {
      albumCounts.set(albumKey, (albumCounts.get(albumKey) || 0) + 1);
    }
  }

  return selected;
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
  const cooldownPeriodMs = 14 * 24 * 60 * 60 * 1000; // 14 days

  for (const trackId of Object.keys(trackAffinities)) {
    // 14-day cooldown protection
    const lastSurfaced = forgottenFavoritesShownAt[trackId] || 0;
    if (Date.now() - lastSurfaced < cooldownPeriodMs) continue;

    const affinity = trackAffinities[trackId];
    if (!affinity) continue;

    const playCount = affinity.playCount || 0;

    // Qualification: playCount >= 10
    if (playCount >= 10) {
      const lastPlayedEntry = history.find((h) => h.id === trackId);
      let lastPlayedTime = 0;
      if (lastPlayedEntry) {
        lastPlayedTime = lastPlayedEntry.playedAt;
      }

      const daysSinceLastPlayed = (Date.now() - lastPlayedTime) / (24 * 60 * 60 * 1000);

      // Qualification: lastPlayed > 30 days (if history is non-empty and it is not found, treat as Infinity days ago)
      const lastPlayedQualified = lastPlayedEntry ? daysSinceLastPlayed > 30 : history.length > 0;

      if (lastPlayedQualified) {
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
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Apply Diversity Cap during selection: MAX_ARTIST_SHARE = 2, MAX_ALBUM_SHARE = 2
  const selected: RecommendationSeed[] = [];
  const artistCounts = new Map<string, number>();
  const albumCounts = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.length >= 25) break;

    const artistKey = candidate.artistName?.toLowerCase().trim() || '';
    const match = history.find((h) => h.id === candidate.id) || catalogTracks.find((t) => t.id === candidate.id);
    const albumKey = (match && 'album' in match ? match.album : (match?.albumId ? catalogAlbums.find((a) => a.id === match.albumId)?.title : ''))?.toLowerCase().trim() || '';

    // Check artist cap
    const artistShare = artistCounts.get(artistKey) || 0;
    if (artistShare >= 2) continue;

    // Check album cap
    if (albumKey) {
      const albumShare = albumCounts.get(albumKey) || 0;
      if (albumShare >= 2) continue;
    }

    selected.push(candidate);
    artistCounts.set(artistKey, artistShare + 1);
    if (albumKey) {
      albumCounts.set(albumKey, (albumCounts.get(albumKey) || 0) + 1);
    }
  }

  return selected;
}

