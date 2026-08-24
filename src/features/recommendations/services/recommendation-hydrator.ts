import { RecommendationSeed } from './recommendation-engine';
import { PlayerTrack } from '../../player/types/player';
import { musicService } from '../../../services/api/music';
import { catalogTracks } from '../../../data/music-catalog';
import { useAnalyticsStore, splitArtistNames } from '../../analytics/store/analytics.store';

/**
 * Parses duration string to seconds
 */
function parseDurationToSeconds(duration: any): number {
  if (duration === null || duration === undefined) return 240;
  if (typeof duration === 'number') return duration;
  if (typeof duration !== 'string') return 240;
  if (!duration || duration === '--:--') return 240;
  const parts = duration.split(':').map(Number);
  if (parts.some(isNaN)) return 240;
  
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 240;
}

/**
 * Implements strict global diversity guards:
 * - Never allow same artist > 3 tracks in recommendation playlists
 * - Never allow same album > 2 tracks
 * - Never allow same artist repeated within 5 positions in the queue (handled in applyConsecutiveArtistLimit)
 */
export function applyDiversityFilter(tracks: any[], targetSize: number = 25): PlayerTrack[] {
  const selectedTracks: PlayerTrack[] = [];
  const artistCounts = new Map<string, number>();
  const albumCounts = new Map<string, number>();
  const seenIds = new Set<string>();

  // Strict caps
  const maxArtistCount = 3; 
  const maxAlbumCount = 2;  

  for (const item of tracks) {
    if (selectedTracks.length >= targetSize) break;

    const trackId = item.id || item.videoId;
    if (!trackId || seenIds.has(trackId)) continue;

    const trackArtist = item.artist || item.artistName || 'Unknown Artist';
    const trackAlbum = item.album || '';
    
    const normArtist = trackArtist.toLowerCase().trim();
    const normAlbum = trackAlbum.toLowerCase().trim();

    // Check artist cap
    const artCount = artistCounts.get(normArtist) || 0;
    if (artCount >= maxArtistCount) continue;

    // Check album cap
    if (normAlbum) {
      const albCount = albumCounts.get(normAlbum) || 0;
      if (albCount >= maxAlbumCount) continue;
    }

    // Skip placeholder URLs
    const trackUrl = item.url || '';
    if (trackUrl.toLowerCase().includes('soundhelix') || trackUrl.toLowerCase().includes('placeholder')) {
      continue;
    }

    const durationSec = item.durationSec || (item.duration ? parseDurationToSeconds(item.duration) : 240);

    const playerTrack: PlayerTrack = {
      id: trackId,
      title: item.title,
      artist: trackArtist,
      art: item.art || item.thumbnail || 'https://picsum.photos/400/400?random=105',
      url: '', 
      duration: durationSec,
      album: trackAlbum || undefined,
      dominantColors: item.dominantColors || ['#bf5af2', '#1a0033'],
      source: item.source || 'ytmusic',
    };

    selectedTracks.push(playerTrack);
    seenIds.add(trackId);
    artistCounts.set(normArtist, artCount + 1);
    if (normAlbum) {
      albumCounts.set(normAlbum, (albumCounts.get(normAlbum) || 0) + 1);
    }
  }

  // separation limit: same artist not repeated within 5 positions
  return applyConsecutiveArtistLimit(selectedTracks, 5);
}

/**
 * Separates tracks so that no artist has more than maxConsecutive tracks consecutively.
 * Uses a lookback window to ensure same artist is not repeated within separation positions.
 */
function applyConsecutiveArtistLimit(tracks: PlayerTrack[], separation: number = 5): PlayerTrack[] {
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
      // Fallback: append the first available element to prevent queue starvation
      foundIndex = 0;
    }
    
    const track = pool.splice(foundIndex, 1)[0];
    result.push(track);
  }
  return result;
}

/**
 * Hydrates a dynamic taste cluster Daily Mix
 */
async function hydrateDailyMix(seed: RecommendationSeed): Promise<PlayerTrack[]> {
  const seedArtists = seed.seedArtists || [];
  const analytics = useAnalyticsStore.getState();
  const { history } = analytics;

  console.log(`[DailyMixHydrator] Generating Daily Mix for seed artists: ${seedArtists.join(', ')}`);

  const pool: any[] = [];

  // 1. Gather favorite cluster artists' tracks
  for (const artistName of seedArtists) {
    try {
      const searchRes = await musicService.searchSongs(artistName);
      if (searchRes && searchRes.length > 0) {
        pool.push(...searchRes);
      }
    } catch (e) {
      console.warn(`[DailyMixHydrator] Failed to fetch songs for artist ${artistName}:`, e);
    }
  }

  // 2. Gather related artists
  let relatedArtists: string[] = [];
  if (seedArtists.length > 0) {
    const topArtist = seedArtists[0];
    try {
      const cached = analytics.artistProfileCache?.[topArtist];
      if (cached && cached.browseId) {
        const details = await musicService.getArtistDetails(cached.browseId);
        if (details?.related) {
          relatedArtists = details.related.slice(0, 3).map(r => r.title);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  for (const name of relatedArtists) {
    try {
      const searchRes = await musicService.searchSongs(name);
      if (searchRes && searchRes.length > 0) {
        pool.push(...searchRes);
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Add history items matching seed artists
  const matchingHistory = history
    .filter(h => seedArtists.some(name => splitArtistNames(h.artist).includes(name)))
    .map(h => h.trackSnapshot)
    .filter((t): t is PlayerTrack => !!t);

  pool.push(...matchingHistory);

  // 4. Fill with exploration from catalog
  pool.push(...catalogTracks);

  return applyDiversityFilter(pool, 25);
}

/**
 * Hydrates custom playlist archetypes (Daily Mix, Comfort Zone, Discovery Mix)
 * Adapts familiarity vs exploration weights dynamically based on TasteDriftLevel:
 * - none/minor -> 75% familiar, 25% new
 * - moderate   -> 60% familiar, 40% new
 * - major      -> 40% familiar, 60% new
 */
async function hydrateCustomMix(mixType: 'daily' | 'comfort' | 'discovery', seedArtists: string[]): Promise<PlayerTrack[]> {
  const analytics = useAnalyticsStore.getState();
  const { history } = analytics;
  const pool: any[] = [];
  const targetSize = 25;

  // Retrieve taste drift weights
  let familiarRatio = 0.75;
  try {
    const recsStore = require('../store/recommendations.store');
    const tasteDriftLevel = recsStore.useRecommendationsStore.getState().tasteDriftLevel;
    if (tasteDriftLevel === 'major') {
      familiarRatio = 0.40;
    } else if (tasteDriftLevel === 'moderate') {
      familiarRatio = 0.60;
    }
  } catch (e) {}

  const familiarTarget = Math.round(targetSize * familiarRatio);
  const explorationTarget = targetSize - familiarTarget;

  if (mixType === 'comfort') {
    // Comfort Zone: highest affinity artists, highest completion tracks, no exploration
    const favoriteTracks = history
      .filter(h => h.completionRatio >= 0.85 && !h.skipped)
      .map(h => h.trackSnapshot)
      .filter((t): t is PlayerTrack => !!t);
    pool.push(...favoriteTracks);

    for (const artistName of seedArtists.slice(0, 3)) {
      try {
        const searchRes = await musicService.searchSongs(artistName);
        if (searchRes) pool.push(...searchRes);
      } catch (e) {}
    }
    return applyDiversityFilter(pool, targetSize);
  }

  if (mixType === 'discovery') {
    // Discovery Mix: customized familiar vs new ratio
    const favPool: any[] = [];
    const newPool: any[] = [];

    // Familiar tracks / artists
    const favoriteTracks = history
      .filter(h => !h.skipped)
      .map(h => h.trackSnapshot)
      .filter((t): t is PlayerTrack => !!t);
    favPool.push(...favoriteTracks);

    for (const name of seedArtists.slice(0, 2)) {
      try {
        const searchRes = await musicService.searchSongs(name);
        if (searchRes) favPool.push(...searchRes);
      } catch (e) {}
    }

    // New/Related exploration
    let related: string[] = [];
    if (seedArtists.length > 0) {
      try {
        const cached = analytics.artistProfileCache?.[seedArtists[0]];
        if (cached && cached.browseId) {
          const details = await musicService.getArtistDetails(cached.browseId);
          if (details?.related) {
            related = details.related.map(r => r.title);
          }
        }
      } catch (e) {}
    }

    if (related.length === 0) {
      related = ['HOME', 'The Midnight', 'M83', 'Lumina Synthetics', 'Voyagers'];
    }

    for (const name of related) {
      try {
        const searchRes = await musicService.searchSongs(name);
        if (searchRes) {
          const filtered = searchRes.filter(s => !history.some(h => h.id === s.id));
          newPool.push(...filtered);
        }
      } catch (e) {}
    }

    newPool.push(...catalogTracks.filter(c => !history.some(h => h.id === c.id)));

    const favTracks = applyDiversityFilter(favPool, familiarTarget);
    const newTracks = applyDiversityFilter(newPool, explorationTarget);

    return applyConsecutiveArtistLimit([...favTracks, ...newTracks], 5);
  }

  // Daily Mix: familiarTarget% favorites, explorationTarget% related/explore
  const favPool: any[] = [];
  const relPool: any[] = [];

  for (const name of seedArtists.slice(0, 3)) {
    try {
      const searchRes = await musicService.searchSongs(name);
      if (searchRes) favPool.push(...searchRes);
    } catch (e) {}
  }
  const historyTracks = history.map(h => h.trackSnapshot).filter((t): t is PlayerTrack => !!t);
  favPool.push(...historyTracks);

  let related: string[] = [];
  if (seedArtists.length > 0) {
    try {
      const cached = analytics.artistProfileCache?.[seedArtists[0]];
      if (cached && cached.browseId) {
        const details = await musicService.getArtistDetails(cached.browseId);
        if (details?.related) {
          related = details.related.slice(0, 3).map(r => r.title);
        }
      }
    } catch (e) {}
  }
  for (const name of related) {
    try {
      const searchRes = await musicService.searchSongs(name);
      if (searchRes) relPool.push(...searchRes);
    } catch (e) {}
  }
  relPool.push(...catalogTracks);

  const favTracks = applyDiversityFilter(favPool, familiarTarget);
  const relTracks = applyDiversityFilter(relPool, explorationTarget);

  return applyConsecutiveArtistLimit([...favTracks, ...relTracks], 5);
}

/**
 * Hydrates Trending For You dynamically from charts applying Listening DNA, Novelty, and Freshness scoring.
 */
async function hydrateTrendingForYou(seed: RecommendationSeed): Promise<PlayerTrack[]> {
  try {
    const { musicService } = require('../../../services/api/music');
    const charts = await musicService.getCharts();
    const songs = charts.songs?.length > 0 ? charts.songs : charts.trending;
    
    if (!songs || songs.length === 0) {
      return applyDiversityFilter(catalogTracks, 25);
    }

    const analytics = useAnalyticsStore.getState();
    const { artistAffinities, history } = analytics;
    
    const recsStore = require('../store/recommendations.store');
    const { listeningDNA } = recsStore.useRecommendationsStore.getState();
    
    const favoriteArtists = listeningDNA?.primaryTasteCluster ? [listeningDNA.primaryTasteCluster] : [];
    if (listeningDNA?.secondaryTasteCluster) {
      favoriteArtists.push(listeningDNA.secondaryTasteCluster);
    }

    // Score every song: popularity + affinity + similarity + novelty + freshness
    const scoredTracks = songs.map((song: any, index: number) => {
      const trackArtist = song.artist || 'Unknown Artist';
      const cleanArtist = trackArtist.toLowerCase().trim();

      // 1. Popularity (max 30 pts)
      const popularity = Math.max(0, 30 - index * 1.2);

      // 2. Affinity (max 25 pts)
      const affinityMetric = artistAffinities[trackArtist];
      const affinity = affinityMetric ? Math.max(0, Math.min(25, affinityMetric.score)) : 0;

      // 3. Similarity (max 15 pts)
      let similarity = 0;
      if (favoriteArtists.some(name => name.toLowerCase().trim() === cleanArtist)) {
        similarity = 15;
      }

      // 4. Recency (max 10 pts)
      const isRecent = history.slice(0, 20).some(h => h.artist.toLowerCase().trim() === cleanArtist);
      const recency = isRecent ? 10 : 0;

      // 5. Novelty (max 15 pts - penalizes top 3 rotation, rewards adjacent artists)
      let novelty = 15;
      const isTopArtist = history.slice(0, 5).some(h => h.artist.toLowerCase().trim() === cleanArtist);
      if (isTopArtist) {
        novelty = -15; // Penalize heavy repetition to enforce discovery in charts
      }

      // 6. Freshness (max 10 pts)
      const freshness = 10; // trending charts songs are inherently fresh

      const totalScore = popularity + affinity + similarity + recency + novelty + freshness;

      return { song, score: totalScore };
    });

    // Sort descending by score
    scoredTracks.sort((a: any, b: any) => b.score - a.score);

    const sortedSongs = scoredTracks.map((item: any) => item.song);

    // Apply strict diversity guards (max 3 artist, max 2 album, max 5 separation)
    return applyDiversityFilter(sortedSongs, 25);
  } catch (error) {
    console.error('[Hydrator] Failed to hydrate Trending For You:', error);
    return applyDiversityFilter(catalogTracks, 25);
  }
}

/**
 * Hydrates time-of-day listening picks dynamically based on hour block plays.
 */
async function hydrateTimeBasedPicks(seedId: string): Promise<PlayerTrack[]> {
  const analytics = useAnalyticsStore.getState();
  const { history } = analytics;
  
  let startHour = 5;
  let endHour = 10;
  
  if (seedId === 'time-evening') {
    startHour = 17;
    endHour = 22;
  } else if (seedId === 'time-latenight') {
    startHour = 22;
    endHour = 3;
  }

  // Filter history entries played within the target hour block
  const blockHistory = history.filter(entry => {
    const hour = new Date(entry.playedAt).getHours();
    if (startHour <= endHour) {
      return hour >= startHour && hour < endHour;
    } else {
      // Overnight (22:00 - 03:00)
      return hour >= startHour || hour < endHour;
    }
  });

  const familiarTracks = blockHistory
    .map(h => h.trackSnapshot)
    .filter((t): t is PlayerTrack => !!t);

  const pool: any[] = [...familiarTracks];

  // Fill up with general catalog
  if (pool.length < 25) {
    pool.push(...catalogTracks);
  }

  return applyDiversityFilter(pool, 25);
}

/**
 * Hydrates a dynamic RecommendationSeed into an array of playable PlayerTracks at runtime.
 */
export async function hydrateRecommendationSeed(seed: RecommendationSeed): Promise<PlayerTrack[]> {
  try {
    switch (seed.type) {
      case 'artist':
      case 'radio': {
        let songs: any[] = [];
        
        if (seed.id && seed.id.length > 8) {
          try {
            songs = await musicService.getArtistSongs(seed.id);
          } catch (e) {
            console.warn('[Hydrator] Failed to fetch artist songs by browseId, falling back to search:', e);
          }
        }
        
        if (songs.length === 0 && seed.title) {
          try {
            const cleanTitle = seed.title.replace(' Mix', '');
            const searchResults = await musicService.searchSongs(cleanTitle);
            songs = searchResults;
          } catch (e) {
            console.error('[Hydrator] Failed to fallback search artist songs:', e);
          }
        }

        if (songs && songs.length > 0) {
          const mapped = songs.map((s) => ({
            id: s.id || s.videoId,
            title: s.title,
            artist: s.artist || seed.title.replace(' Mix', ''),
            art: s.art || s.thumbnail || 'https://picsum.photos/400/400?random=15',
            url: '',
            duration: s.duration ? parseDurationToSeconds(s.duration) : 240,
            artistId: seed.id,
            source: s.source || 'ytmusic',
          }));
          return applyDiversityFilter(mapped, 25);
        }

        const cleanName = seed.title.replace(' Mix', '').toLowerCase();
        const localMatches = catalogTracks.filter((t) => t.artist.toLowerCase().includes(cleanName));
        if (localMatches.length > 0) {
          const mapped = localMatches.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            art: t.art,
            url: '',
            duration: t.durationSec || 240,
            dominantColors: t.dominantColors,
            artistId: t.artistId,
            albumId: t.albumId,
            source: 'local',
          }));
          return applyDiversityFilter(mapped, 25);
        }
        break;
      }

      case 'album': {
        let tracks: any[] = [];
        if (seed.id) {
          try {
            const albumDetails = await musicService.getAlbumDetails(seed.id);
            if (albumDetails && albumDetails.tracks) {
              tracks = albumDetails.tracks;
            }
          } catch (e) {
            console.error('[Hydrator] Failed to fetch album details:', e);
          }
        }

        if (tracks.length > 0) {
          const mapped = tracks.map((t) => ({
            id: t.id || t.videoId,
            title: t.title,
            artist: t.artist || seed.artistName || 'Unknown Artist',
            art: seed.image || 'https://picsum.photos/400/400?random=7',
            url: '',
            duration: t.duration ? parseDurationToSeconds(t.duration) : 240,
            album: seed.title,
            albumId: seed.id,
            source: t.source || 'ytmusic',
          }));
          return applyDiversityFilter(mapped, 25);
        }
        break;
      }

      case 'track': {
        const history = useAnalyticsStore.getState().history;
        const historyMatch = history.find((h) => h.id === seed.id);
        
        if (historyMatch?.trackSnapshot) {
          return [historyMatch.trackSnapshot];
        }

        const localMatch = catalogTracks.find((t) => t.id === seed.id);
        if (localMatch) {
          return [{
            id: localMatch.id,
            title: localMatch.title,
            artist: localMatch.artist,
            art: localMatch.art,
            url: '',
            duration: localMatch.durationSec || 240,
            dominantColors: localMatch.dominantColors,
            artistId: localMatch.artistId,
            albumId: localMatch.albumId,
            source: 'local',
          }];
        }

        if (seed.title) {
          return [{
            id: seed.id,
            title: seed.title,
            artist: seed.artistName || 'Unknown Artist',
            art: seed.image || 'https://picsum.photos/400/400?random=17',
            url: '',
            duration: 240,
            source: 'ytmusic',
          }];
        }
        break;
      }

      case 'playlist': {
        // 1. Made For You & Personal Models
        if (seed.id === 'mix-made-for-you') {
          if (seed.tracks && seed.tracks.length > 0) return seed.tracks;
          const { useAnalyticsStore } = require('../../analytics/store/analytics.store');
          const history = useAnalyticsStore.getState().history || [];
          const topTracks = history.filter((h: any) => h.completionRatio >= 0.8 || !h.skipped).slice(0, 25);
          if (topTracks.length > 0) {
            return topTracks.map((h: any) => ({
              id: h.id,
              title: h.title,
              artist: h.artist,
              art: h.art || h.artwork || h.trackSnapshot?.art,
              artwork: h.art || h.artwork || h.trackSnapshot?.art,
              duration: (h.durationMs ? h.durationMs / 1000 : h.duration) || 240,
              url: h.trackSnapshot?.url || '',
              album: h.album || h.trackSnapshot?.album,
              artistId: h.artistId,
              albumId: h.albumId,
              source: (h.trackSnapshot?.source || 'youtube') as any,
            }));
          }
        }

        if (seed.id === 'mix-on-repeat' || seed.id === 'mix-repeat-rewind') {
          if (seed.tracks && seed.tracks.length > 0) return seed.tracks;
        }

        if (seed.id === 'mix-discover-weekly') {
          if (seed.tracks && seed.tracks.length > 0) return seed.tracks;
          try {
            const { musicService } = require('../../../services/api/music');
            const query = (seed.seedArtists && seed.seedArtists.length > 0) ? `${seed.seedArtists[0]} similar hits` : 'Indie Pop Chill Discovery';
            const songs = await musicService.searchSongs(query);
            if (songs && songs.length > 0) return applyDiversityFilter(songs, 25);
          } catch (e) {}
        }

        if (seed.id === 'mix-deep-cuts') {
          if (seed.tracks && seed.tracks.length > 0) return seed.tracks;
          try {
            const { musicService } = require('../../../services/api/music');
            const query = (seed.seedArtists && seed.seedArtists.length > 0) ? `${seed.seedArtists[0]} album tracks` : 'Underrated Classic Album Tracks';
            const songs = await musicService.searchSongs(query);
            if (songs && songs.length > 0) return applyDiversityFilter(songs, 25);
          } catch (e) {}
        }

        // Daily Mix dynamic hydration
        if (seed.id.startsWith('daily-mix-')) {
          return hydrateDailyMix(seed);
        }

        // Time-based / Session picks hydration
        if (seed.id.startsWith('time-')) {
          if (seed.id === 'time-night') {
            try {
              const { musicService } = require('../../../services/api/music');
              const songs = await musicService.searchSongs('Late Night Chill Lo-Fi Beats Ambient');
              if (songs && songs.length > 0) return applyDiversityFilter(songs, 25);
            } catch (e) {}
          } else if (seed.id === 'time-morning') {
            try {
              const { musicService } = require('../../../services/api/music');
              const songs = await musicService.searchSongs('Morning Energy Acoustic Upbeat Melodies');
              if (songs && songs.length > 0) return applyDiversityFilter(songs, 25);
            } catch (e) {}
          } else if (seed.id === 'time-chill') {
            try {
              const { musicService } = require('../../../services/api/music');
              const songs = await musicService.searchSongs('Deep Focus Study Ambient Instrumental Flow');
              if (songs && songs.length > 0) return applyDiversityFilter(songs, 25);
            } catch (e) {}
          } else if (seed.id === 'time-evening') {
            try {
              const { musicService } = require('../../../services/api/music');
              const songs = await musicService.searchSongs('Evening Wind Down Relaxing Sunset Hits');
              if (songs && songs.length > 0) return applyDiversityFilter(songs, 25);
            } catch (e) {}
          }
          return hydrateTimeBasedPicks(seed.id);
        }

        // Made For You Dynamic mixes
        if (seed.id === 'mix-daily') {
          return hydrateCustomMix('daily', seed.seedArtists || []);
        }
        if (seed.id === 'mix-comfort-zone') {
          return hydrateCustomMix('comfort', seed.seedArtists || []);
        }
        if (seed.id === 'mix-discovery-mix') {
          return hydrateCustomMix('discovery', seed.seedArtists || []);
        }

        // Because You Like dynamic hydration
        if (seed.id.startsWith('byl-') || seed.id.startsWith('because-')) {
          const artistName = (seed.seedArtists && seed.seedArtists[0]) || seed.title.replace(/^Because You Like /i, '').replace(/ Mix$/i, '');
          try {
            const { musicService } = require('../../../services/api/music');
            const searchRes = await musicService.searchSongs(artistName);
            if (searchRes && searchRes.length > 0) {
              return applyDiversityFilter(searchRes, 25);
            }
          } catch (e) {}
          const catTracks = catalogTracks.filter(t => t.artist.toLowerCase().includes(artistName.toLowerCase()));
          if (catTracks.length > 0) return applyDiversityFilter(catTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, artwork: t.art, url: '', duration: t.durationSec || 240, dominantColors: t.dominantColors, artistId: t.artistId, albumId: t.albumId, source: 'local' as any })), 25);
        }

        // Personalized Trending Hydration
        if (seed.id === 'trending-for-you') {
          return hydrateTrendingForYou(seed);
        }

        // Trending mixes hydrated dynamically on-demand from backend charts
        if (seed.id === 'trending-global') {
          const { musicService } = require('../../../services/api/music');
          const charts = await musicService.getCharts();
          const songs = charts.songs?.length > 0 ? charts.songs : charts.trending;
          return applyDiversityFilter(songs || [], 25);
        }

        if (seed.id === 'trending-india') {
          const { musicService } = require('../../../services/api/music');
          const charts = await musicService.getCharts('IN');
          const songs = charts.songs?.length > 0 ? charts.songs : charts.trending;
          return applyDiversityFilter(songs || [], 25);
        }

        if (seed.id === 'trending-synthwave') {
          try {
            const { musicService } = require('../../../services/api/music');
            const songs = await musicService.searchSongs('Synthwave Retrowave Chill Electro');
            if (songs && songs.length > 0) {
              return applyDiversityFilter(songs, 25);
            }
          } catch (e) {}
          return catalogTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, artwork: t.art, url: '', duration: t.durationSec || 240, dominantColors: t.dominantColors, artistId: t.artistId, albumId: t.albumId, source: 'local' as any }));
        }

        // Generic fallback for any other named seed
        if (seed.title) {
          try {
            const { musicService } = require('../../../services/api/music');
            const query = (seed.seedArtists && seed.seedArtists.length > 0) ? seed.seedArtists.join(' ') : seed.title;
            const songs = await musicService.searchSongs(query);
            if (songs && songs.length > 0) {
              return applyDiversityFilter(songs, 25);
            }
          } catch (e) {}
        }

        return catalogTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, artwork: t.art, url: '', duration: t.durationSec || 240, dominantColors: t.dominantColors, artistId: t.artistId, albumId: t.albumId, source: 'local' as any }));
      }
    }
  } catch (error) {
    console.error('[RecommendationHydrator] Critical error during seed hydration:', error);
  }

  return catalogTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, artwork: t.art, url: '', duration: t.durationSec || 240, dominantColors: t.dominantColors, artistId: t.artistId, albumId: t.albumId, source: 'local' as any }));
}
