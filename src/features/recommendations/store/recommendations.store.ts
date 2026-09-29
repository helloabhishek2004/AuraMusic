import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAnalyticsStore, splitArtistNames } from '../../analytics/store/analytics.store';
import {
  calculateRecommendationReadiness,
  RecommendationReadinessResult
} from '../services/recommendation-readiness';
import {
  RecommendationSeed,
  generateDailyMixes,
  generateBecauseYouLike,
  generateRediscover,
  generateRecentlyLoved,
  generateMadeForYou,
  generateOnRepeat,
  generateRepeatRewind,
  generateDiscoverWeekly,
  generateDeepCuts,
  generateContextualTimeMix,
  buildTasteClusters,
  generateHiddenGems,
  generateForgottenFavorites
} from '../services/recommendation-engine';
import {
  ListeningDNA,
  calculateListeningDNA
} from '../services/listening-dna';
import {
  TasteSnapshot,
  TasteDriftLevel,
  FatigueRecord,
  createTasteSnapshot,
  detectTasteDrift,
  isSeedFatigued,
  handleFatigueInteraction
} from '../services/taste-evolution';

import { HistoryEntry } from '../../analytics/store/analytics.store';

import { getArtworkUrl } from '../../player/utils/track-identity';
import { resolveArtwork } from '../../player/utils/artwork-resolver';

let preloadSubscriptionInitialized = false;

async function resolveSeedArtworkAsync(
  seed: RecommendationSeed,
  history: HistoryEntry[],
  artistCache: Record<string, { id: string; image: string }>
): Promise<string> {
  // If it's a track seed, it already has the track's artwork
  if (seed.type === 'track') {
    const url = seed.image;
    if (url && url.length > 0 && !url.includes('placeholder') && !url.startsWith('aura://')) {
      return url;
    }
  }

  // Priority 1: Use the highest-ranked constituent track's real album artwork
  if (seed.tracks && seed.tracks.length > 0) {
    for (const track of seed.tracks) {
      const art = track.art || (track as any).image;
      if (art && art.length > 0 && !art.includes('placeholder') && !art.startsWith('aura://')) {
        return art;
      }
    }
  }

  // Priority 2: Check local metadata in history matching seed trackIds
  if (seed.trackIds && seed.trackIds.length > 0) {
    for (const id of seed.trackIds) {
      const match = history.find(h => h.id === id);
      const art = match?.art || match?.artwork || match?.trackSnapshot?.art;
      if (art && art.length > 0 && !art.includes('placeholder') && !art.startsWith('aura://')) {
        return art;
      }
    }
  }

  // Priority 2b: Check history matching seed artists
  if (seed.seedArtists && seed.seedArtists.length > 0) {
    for (const name of seed.seedArtists) {
      const clean = name.toLowerCase().trim();
      const match = history.find(h => splitArtistNames(h.artist).some(an => an.toLowerCase().trim() === clean));
      const art = match?.art || match?.artwork || match?.trackSnapshot?.art;
      if (art && art.length > 0 && !art.includes('placeholder') && !art.startsWith('aura://')) {
        return art;
      }
    }
  }

  // Priority 3: Try strongest seed artist image from cache
  if (seed.seedArtists && seed.seedArtists.length > 0) {
    for (const name of seed.seedArtists) {
      const cached = artistCache[name];
      if (cached?.image && !cached.image.includes('placeholder') && !cached.image.startsWith('aura://')) {
        return cached.image;
      }
    }
  }

  // Priority 4: Try to fetch/hydrate the top track from online API if online
  if (seed.type === 'playlist' || seed.type === 'artist' || seed.type === 'radio') {
    try {
      const { useNetworkStore } = require('../../network/store/network.store');
      const isOnline = useNetworkStore.getState().isOnline;
      if (isOnline && seed.seedArtists && seed.seedArtists.length > 0) {
        const { musicService } = require('../../../services/api/music');
        const topArtist = seed.seedArtists[0];
        const searchSongs = await musicService.searchSongs(topArtist);
        if (searchSongs && searchSongs[0]?.art && !searchSongs[0].art.includes('placeholder') && !searchSongs[0].art.startsWith('aura://')) {
          return searchSongs[0].art;
        }
      }
    } catch {
      // ignore offline or search errors
    }
  }

  // Fallback to seed image if valid
  if (seed.image && !seed.image.includes('placeholder') && !seed.image.startsWith('aura://')) {
    return seed.image;
  }

  // ABSOLUTE FALLBACK: resolveArtwork will provide a deterministic aura://generated URI
  return resolveArtwork(seed, 'album');
}

async function resolveTrendingCoverAsync(
  query: string,
  fallbackSeed: RecommendationSeed
): Promise<string> {
  try {
    const { useNetworkStore } = require('../../network/store/network.store');
    const isOnline = useNetworkStore.getState().isOnline;
    if (isOnline) {
      const { musicService } = require('../../../services/api/music');
      const searchSongs = await musicService.searchSongs(query);
      if (searchSongs && searchSongs[0]?.art && !searchSongs[0].art.includes('placeholder') && !searchSongs[0].art.startsWith('aura://')) {
        return searchSongs[0].art;
      }
    }
  } catch {
    // ignore
  }
  return resolveArtwork(fallbackSeed, 'album');
}

export interface TrendingSeed {
  type: 'playlist';
  id: string; // "trending-global", "trending-india"
  title: string;
  image: string;
  source: 'global' | 'india';
  fetchedAt: number;
  query?: string;
  reason?: string;
}

export interface DiscoveryPoolItem {
  id: string;
  title: string;
  query: string;
  source: 'global' | 'india';
  defaultArtwork: string;
  reason?: string;
}

export const DISCOVERY_CATALOGUE: DiscoveryPoolItem[] = [
  {
    id: 'trending-global',
    title: 'Global Top Hits',
    query: 'Top Global Hits',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    reason: 'The hottest tracks trending worldwide right now',
  },
  {
    id: 'trending-india',
    title: 'Trending in India',
    query: 'Top Hindi Songs',
    source: 'india',
    defaultArtwork: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    reason: 'Chartbusters and popular hits in India',
  },
  {
    id: 'trending-synthwave',
    title: 'Synthwave & Chill',
    query: 'Synthwave Retrowave Chill Electro',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
    reason: 'Neon retro synth and chill electronic vibes',
  },
  {
    id: 'trending-lofi',
    title: 'Lo-Fi Chill Beats',
    query: 'Lofi Hip Hop Chill Beats to Relax Study',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
    reason: 'Mellow lofi beats for relaxing and focus',
  },
  {
    id: 'trending-acoustic',
    title: 'Acoustic Coffeehouse',
    query: 'Acoustic Pop Chill Coffeehouse',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/kOCkne-Bku4/hqdefault.jpg',
    reason: 'Intimate acoustic sessions and melodic calm',
  },
  {
    id: 'trending-electronic',
    title: 'EDM & Club Energy',
    query: 'Dance EDM Electronic Festival Hits',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/fB8TyLTD7EE/hqdefault.jpg',
    reason: 'High energy dance and festival anthems',
  },
  {
    id: 'trending-hiphop',
    title: 'Hip-Hop & R&B Hits',
    query: 'Hip Hop Rap RnB Top Hits',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
    reason: 'Fresh flow, beats and urban hits',
  },
  {
    id: 'trending-nightdrive',
    title: 'Late Night Drive',
    query: 'Late Night Drive Chill Vibes',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/21X5lGlDOfg/hqdefault.jpg',
    reason: 'Atmospheric rhythms for midnight cruising',
  },
  {
    id: 'trending-indie',
    title: 'Indie & Alternative',
    query: 'Indie Rock Alternative Hits',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/YVkUvmDQ3HY/hqdefault.jpg',
    reason: 'Indie anthems and alternative discoveries',
  },
  {
    id: 'trending-workout',
    title: 'Beast Mode Workout',
    query: 'Workout Motivation Gym Music',
    source: 'global',
    defaultArtwork: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    reason: 'High intensity adrenaline for your sessions',
  },
];

export function getDiscoverySlice(startIndex: number, count: number = 4): DiscoveryPoolItem[] {
  const result: DiscoveryPoolItem[] = [];
  const len = DISCOVERY_CATALOGUE.length;
  for (let i = 0; i < count; i++) {
    result.push(DISCOVERY_CATALOGUE[(startIndex + i) % len]);
  }
  return result;
}

export interface RecommendationsState {
  featuredHeroMix: RecommendationSeed | null;
  onRepeat: RecommendationSeed | null;
  repeatRewind: RecommendationSeed | null;
  discoverWeekly: RecommendationSeed | null;
  deepCuts: RecommendationSeed | null;
  timeMix: RecommendationSeed | null;
  dailyMixes: RecommendationSeed[];
  madeForYou: RecommendationSeed[];
  rediscover: RecommendationSeed[];
  becauseYouLike: RecommendationSeed[];
  recentlyLoved: RecommendationSeed[];
  discoveryRotationIndex: number;
  trendingSeeds: TrendingSeed[];
  trendingForYou: RecommendationSeed | null;
  topSongs: RecommendationSeed[];
  topArtists: RecommendationSeed[];
  hiddenGems: RecommendationSeed[];
  forgottenFavorites: RecommendationSeed[];
  forgottenFavoritesShownAt: Record<string, number>;
  
  readiness: RecommendationReadinessResult | null;
  listeningDNA: ListeningDNA | null;
  tasteSnapshots: TasteSnapshot[];
  tasteDriftLevel: TasteDriftLevel;
  tasteDriftDetected: boolean;
  fatigueTracker: Record<string, FatigueRecord>;
  listeningEventsCountSinceBuild: number;

  generatedAt: number | null;
  lastRecommendationBuild: number | null;
  analyticsVersion: number;
  
  isHydrated: boolean;
}

export interface RecommendationsActions {
  generateRecommendations: () => Promise<void>;
  resetRecommendations: () => void;
  refreshTrendingIfNeeded: () => Promise<void>;
  refreshDiscover: (forceNext?: boolean) => Promise<void>;
  startPeriodicPreload: () => void;
  registerRecommendationShown: (seedId: string) => void;
  registerRecommendationClick: (seedId: string, action?: 'play' | 'like' | 'complete') => void;
  incrementListeningEvent: () => void;
  
  // Playback Intelligence Architecture Hooks
  getArtistSkipRate: (artist: string) => number;
  getTrackSkipRate: (trackId: string) => number;
  getAutoplayContinuationQueue: (lastTrackId: string) => Promise<any[]>;
}

export const useRecommendationsStore = create<RecommendationsState & RecommendationsActions>()(
  persist(
    (set, get) => ({
      // State
      featuredHeroMix: null,
      onRepeat: null,
      repeatRewind: null,
      discoverWeekly: null,
      deepCuts: null,
      timeMix: null,
      dailyMixes: [],
      madeForYou: [],
      rediscover: [],
      becauseYouLike: [],
      recentlyLoved: [],
      discoveryRotationIndex: 0,
      trendingSeeds: getDiscoverySlice(0, 4).map(item => ({
        type: 'playlist',
        id: item.id,
        title: item.title,
        image: item.defaultArtwork,
        source: item.source,
        fetchedAt: Date.now(),
        query: item.query,
        reason: item.reason,
      })),
      trendingForYou: null,
      topSongs: [],
      topArtists: [],
      hiddenGems: [],
      forgottenFavorites: [],
      forgottenFavoritesShownAt: {},
      
      readiness: null,
      listeningDNA: null,
      tasteSnapshots: [],
      tasteDriftLevel: 'none',
      tasteDriftDetected: false,
      fatigueTracker: {},
      listeningEventsCountSinceBuild: 0,

      generatedAt: null,
      lastRecommendationBuild: null,
      analyticsVersion: 0,
      
      isHydrated: true,

      // Actions
      generateRecommendations: async () => {
        const analytics = useAnalyticsStore.getState();
        const { artistAffinities, trackAffinities, history, analyticsVersion, artistCache } = analytics;
        const state = get();

        const historyLength = history.length;

        try {
          // 1. Build Taste Clusters first
          const clusters = buildTasteClusters(artistAffinities, history, artistCache);
          const primaryCluster = clusters[0]?.name || 'My Favorites';
          const secondaryCluster = clusters[1]?.name || null;

          // 2. Compute Listening DNA
          const listeningDNA = calculateListeningDNA(
            history,
            artistAffinities,
            primaryCluster,
            secondaryCluster
          );

          // 3. Tiers & Taste Snapshots (Tier 4 / history.length > 100 only)
          let updatedSnapshots = [...(state.tasteSnapshots || [])];
          let tasteDriftLevel: TasteDriftLevel = 'none';
          let tasteDriftDetected = false;

          const sortedTopArtists = Object.keys(artistAffinities)
            .map((key) => ({ name: key, score: artistAffinities[key].score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(a => a.name);

          if (historyLength > 100) {
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
            const lastSnapshot = updatedSnapshots[updatedSnapshots.length - 1];
            
            const sortedTopAlbums = Object.keys(analytics.albumAffinities)
              .map((key) => ({ name: key, score: analytics.albumAffinities[key].score }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map(a => a.name);

            const sortedTopTracks = Object.keys(trackAffinities)
              .map((key) => ({ name: key, score: trackAffinities[key].score }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map(a => a.name);

            if (!lastSnapshot || Date.now() - lastSnapshot.timestamp > oneWeekMs) {
              const snapshot = createTasteSnapshot(
                sortedTopArtists,
                sortedTopAlbums,
                sortedTopTracks,
                primaryCluster,
                listeningDNA.completionRate,
                listeningDNA.skipRate
              );
              updatedSnapshots.push(snapshot);
              if (updatedSnapshots.length > 12) {
                updatedSnapshots = updatedSnapshots.slice(updatedSnapshots.length - 12);
              }
            }

            // Detect Taste Drift
            tasteDriftLevel = detectTasteDrift(sortedTopArtists, updatedSnapshots);
            tasteDriftDetected = tasteDriftLevel !== 'none' && tasteDriftLevel !== 'minor';
          }

          let dailyMixes: RecommendationSeed[] = [];
          let becauseYouLike: RecommendationSeed[] = [];
          let rediscover: RecommendationSeed[] = [];
          let recentlyLoved: RecommendationSeed[] = [];
          let madeForYou: RecommendationSeed[] = [];
          let trendingForYou: RecommendationSeed | null = null;
          let topSongs: RecommendationSeed[] = [];
          let topArtists: RecommendationSeed[] = [];
          let hiddenGems: RecommendationSeed[] = [];
          let forgottenFavorites: RecommendationSeed[] = [];

          // Deduplication Pools
          const globalTrackPool = new Set<string>();
          const globalArtistPool = new Set<string>();

          // Authoritative recommendation readiness calculation
          const readiness = calculateRecommendationReadiness(analytics);

          if (!readiness.isReady || historyLength === 0) {
            // Cold Start or Insufficient Data: personal recommendations strictly omitted until enough data is collected
            dailyMixes = [];
            trendingForYou = null;
            madeForYou = [];
            rediscover = [];
            becauseYouLike = [];
            recentlyLoved = [];
            hiddenGems = [];
            forgottenFavorites = [];

            // Dynamically tune cold-start discovery seeds from the user's taste profile
            try {
              const { buildDynamicDiscoverySeeds } = await import('../../taste-profile/services/preference-prior.service');
              const dynamicSeeds = buildDynamicDiscoverySeeds();
              if (dynamicSeeds.length > 0) {
                set({
                  trendingSeeds: dynamicSeeds,
                  featuredHeroMix: state.featuredHeroMix || {
                    type: 'playlist',
                    id: dynamicSeeds[0].id,
                    title: dynamicSeeds[0].title,
                    image: dynamicSeeds[0].image,
                    score: 10.0,
                    reason: dynamicSeeds[0].reason,
                    query: dynamicSeeds[0].query,
                  },
                });
              }
            } catch {
              // ignore
            }

            // Top Songs and Top Artists can be derived if any history exists
            if (historyLength > 0) {
              const rankedTracks = Object.keys(trackAffinities)
                .map((id) => {
                  const aff = trackAffinities[id];
                  const match = history.find(h => h.id === id);
                  const score = aff.playCount + (aff.completionCount * 2) + (aff.totalListenMs / 600000) - aff.skipCount;
                  return { id, score, match };
                })
                .filter(t => t.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 25);

              topSongs = rankedTracks.map(({ id, score, match }) => ({
                type: 'track',
                id,
                title: match?.title || id,
                artistName: match?.artist || 'Unknown Artist',
                image: match?.art || undefined,
                score,
                reason: `Your top track. Played ${trackAffinities[id].playCount} times.`,
                confidence: 90
              }));

              const monthlyArtistPlays = new Map<string, { playCount: number; completionCount: number; listenTimeMs: number }>();
              history.forEach(h => {
                const names = splitArtistNames(h.artist);
                names.forEach(name => {
                  const current = monthlyArtistPlays.get(name) || { playCount: 0, completionCount: 0, listenTimeMs: 0 };
                  current.playCount += 1;
                  if (h.completionRatio >= 0.95 || !h.skipped) {
                    current.completionCount += 1;
                  }
                  current.listenTimeMs += h.positionMs || 0;
                  monthlyArtistPlays.set(name, current);
                });
              });

              topArtists = Array.from(monthlyArtistPlays.entries())
                .map(([name, data]) => ({ name, score: data.playCount + (data.completionCount * 2) + (data.listenTimeMs / 600000) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map(({ name, score }) => {
                  const match = history.find(h => splitArtistNames(h.artist).includes(name));
                  return {
                    type: 'artist',
                    id: artistCache[name]?.id || match?.artistId || name,
                    title: name,
                    image: artistCache[name]?.image || match?.art || undefined,
                    score,
                    reason: `Top artist with play score of ${score.toFixed(1)}.`,
                    confidence: 90
                  };
                });
            } else {
              topSongs = [];
              topArtists = [];
            }
          } else {
            // Full Personalization: User meets authoritative readiness criteria
            console.log(`[RecommendationsStore] Data sufficiency gate passed. Generating Made for You suite.`);
            
            // Generate Top Songs (Top 25)
            const rankedTracks = Object.keys(trackAffinities)
              .map((id) => {
                const aff = trackAffinities[id];
                const match = history.find(h => h.id === id);
                const score = aff.playCount + (aff.completionCount * 2) + (aff.totalListenMs / 600000) - aff.skipCount;
                return { id, score, match };
              })
              .sort((a, b) => b.score - a.score)
              .slice(0, 25);

            topSongs = rankedTracks.map(({ id, score, match }) => ({
              type: 'track',
              id,
              title: match?.title || id,
              artistName: match?.artist || 'Unknown Artist',
              image: match?.art || undefined,
              score,
              reason: `Your top track. Played ${trackAffinities[id].playCount} times recently with ${trackAffinities[id].completionCount} completions.`,
              confidence: 99
            }));

            // Track Pool loops protection: add top songs first
            topSongs.forEach(s => globalTrackPool.add(s.id));

            // Top Artists This Month (last 30 days of history only)
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const monthlyHistory = history.filter(h => h.playedAt >= thirtyDaysAgo);
            
            const monthlyArtistPlays = new Map<string, { playCount: number; completionCount: number; listenTimeMs: number }>();
            monthlyHistory.forEach(h => {
              const names = splitArtistNames(h.artist);
              names.forEach(name => {
                const current = monthlyArtistPlays.get(name) || { playCount: 0, completionCount: 0, listenTimeMs: 0 };
                current.playCount += 1;
                if (h.completionRatio >= 0.95 || !h.skipped) {
                  current.completionCount += 1;
                }
                current.listenTimeMs += h.positionMs || 0;
                monthlyArtistPlays.set(name, current);
              });
            });

            const rankedArtists = Array.from(monthlyArtistPlays.entries())
              .map(([name, data]) => {
                const score = data.playCount + (data.completionCount * 2) + (data.listenTimeMs / 600000);
                return { name, score };
              })
              .sort((a, b) => b.score - a.score)
              .slice(0, 10);

            topArtists = rankedArtists.map(({ name, score }) => {
              const match = history.find(h => splitArtistNames(h.artist).includes(name));
              return {
                type: 'artist',
                id: artistCache[name]?.id || match?.artistId || name,
                title: name,
                image: artistCache[name]?.image || match?.art || undefined,
                score,
                reason: `Top artist this month. Play score of ${score.toFixed(1)} over the last 30 days.`,
                confidence: 95
              };
            });

            // Generate personalized Daily Mixes
            const personalDaily = generateDailyMixes(artistAffinities, history, artistCache, topSongs);
            dailyMixes = personalDaily;
            
            // Loop Protection: add top Daily Mix's seed artists to the artist pool
            const firstDaily = personalDaily[0];
            if (firstDaily && firstDaily.seedArtists) {
              firstDaily.seedArtists.forEach(art => globalArtistPool.add(art.toLowerCase().trim()));
            }

            const rawBYL = generateBecauseYouLike(artistAffinities, history, artistCache, topSongs);
            becauseYouLike = rawBYL.filter(s => {
              const artName = s.title.toLowerCase().trim();
              if (globalArtistPool.has(artName)) return false;
              globalArtistPool.add(artName);
              return true;
            });

            // Generate 7 Specialized Recommendation Models
            const madeForYouSeed = generateMadeForYou(trackAffinities, history, artistAffinities, artistCache);
            const onRepeatSeed = generateOnRepeat(history, trackAffinities);
            const repeatRewindSeed = generateRepeatRewind(history, trackAffinities);
            const discoverWeeklySeed = generateDiscoverWeekly(history, artistAffinities);
            const deepCutsSeed = generateDeepCuts(history, artistAffinities, artistCache);
            const timeMixSeed = generateContextualTimeMix(history, analytics.activeHoursMap);

            madeForYou = [
              madeForYouSeed,
              ...(onRepeatSeed ? [onRepeatSeed] : []),
              ...(repeatRewindSeed ? [repeatRewindSeed] : []),
              discoverWeeklySeed,
              deepCutsSeed,
              timeMixSeed,
            ];

            // Determine Featured Hero Mix based on context and listening intensity
            const hour = new Date().getHours();
            let heroMixCandidate: RecommendationSeed = timeMixSeed;
            if (hour >= 22 || hour < 4) {
              heroMixCandidate = timeMixSeed;
            } else if (onRepeatSeed && onRepeatSeed.tracks && onRepeatSeed.tracks.length > 0) {
              heroMixCandidate = onRepeatSeed;
            } else if (madeForYouSeed && madeForYouSeed.tracks && madeForYouSeed.tracks.length > 0) {
              heroMixCandidate = madeForYouSeed;
            } else if (personalDaily.length > 0) {
              heroMixCandidate = personalDaily[0];
            }

            // Track Deduplication Loops protection
            const rawRecentlyLoved = generateRecentlyLoved(history, trackAffinities);
            recentlyLoved = rawRecentlyLoved.filter(s => {
              if (globalTrackPool.has(s.id)) return false;
              globalTrackPool.add(s.id);
              return true;
            });

            const rawRediscover = generateRediscover(history);
            rediscover = rawRediscover.filter(s => !globalTrackPool.has(s.id));

            // Generate Hidden Gems & Forgotten Favorites
            const excludeTrackIds = new Set<string>();
            topSongs.forEach(s => excludeTrackIds.add(s.id));
            recentlyLoved.forEach(s => excludeTrackIds.add(s.id));
            rediscover.forEach(s => excludeTrackIds.add(s.id));

            hiddenGems = generateHiddenGems(trackAffinities, history, excludeTrackIds);
            forgottenFavorites = generateForgottenFavorites(trackAffinities, history, state.forgottenFavoritesShownAt || {});
          }

          // Caching trending playlist seeds with real artwork preservation and catalogue rotation
          const prevTrending = state.trendingSeeds || [];
          const findPrevArt = (id: string, title: string) => {
            const match = prevTrending.find(t => t.id === id);
            if (match?.image && !match.image.startsWith('aura://') && !match.image.includes('placeholder')) {
              return match.image;
            }
            const catItem = DISCOVERY_CATALOGUE.find(d => d.id === id);
            return catItem?.defaultArtwork || resolveArtwork({ type: 'playlist', id, title } as any, 'album');
          };

          const rotIndex = state.discoveryRotationIndex || 0;
          const currentSlice = getDiscoverySlice(rotIndex, 4);
          let trendingSeeds: TrendingSeed[] = currentSlice.map(item => ({
            type: 'playlist',
            id: item.id,
            title: item.title,
            image: findPrevArt(item.id, item.title),
            source: item.source,
            fetchedAt: Date.now(),
            query: item.query,
            reason: item.reason,
          }));

          // Preserve & prioritize dynamic personalized seeds from the user's taste profile
          try {
            const { useTasteProfileStore } = await import('../../taste-profile/store/taste-profile.store');
            const profile = useTasteProfileStore.getState();
            if (profile.onboardingCompleted && (profile.favoriteArtists.length > 0 || profile.songLanguages.length > 0 || profile.genres.length > 0)) {
              const { buildDynamicDiscoverySeeds } = await import('../../taste-profile/services/preference-prior.service');
              const dynamicSeeds = buildDynamicDiscoverySeeds();
              if (dynamicSeeds && dynamicSeeds.length > 0) {
                trendingSeeds = dynamicSeeds;
              }
            }
          } catch {
            // fallback to default slice
          }

          // Dynamic Artwork Resolution Priority
          const resolveListArtworks = async (list: RecommendationSeed[]) => {
            const result: RecommendationSeed[] = [];
            for (const seed of list) {
              const resolvedArt = await resolveSeedArtworkAsync(seed, history, artistCache);
              result.push({
                ...seed,
                image: resolvedArt,
              });
            }
            return result;
          };

          dailyMixes = await resolveListArtworks(dailyMixes);
          becauseYouLike = await resolveListArtworks(becauseYouLike);
          rediscover = await resolveListArtworks(rediscover);
          recentlyLoved = await resolveListArtworks(recentlyLoved);
          madeForYou = await resolveListArtworks(madeForYou);
          topSongs = await resolveListArtworks(topSongs);
          topArtists = await resolveListArtworks(topArtists);
          hiddenGems = await resolveListArtworks(hiddenGems);
          forgottenFavorites = await resolveListArtworks(forgottenFavorites);

          // Extract individual model seeds from madeForYou
          const onRepeatSeed = madeForYou.find(s => s.id === 'mix-on-repeat') || null;
          const repeatRewindSeed = madeForYou.find(s => s.id === 'mix-repeat-rewind') || null;
          const discoverWeeklySeed = madeForYou.find(s => s.id === 'mix-discover-weekly') || null;
          const deepCutsSeed = madeForYou.find(s => s.id === 'mix-deep-cuts') || null;
          const timeMixSeed = madeForYou.find(s => s.id.startsWith('time-')) || null;

          // Resolve Hero Mix
          let heroMix = timeMixSeed || (madeForYou.length > 0 ? madeForYou[0] : (dailyMixes.length > 0 ? dailyMixes[0] : null));
          const currentHour = new Date().getHours();
          if (currentHour >= 22 || currentHour < 4) {
            heroMix = timeMixSeed || heroMix;
          } else if (onRepeatSeed && onRepeatSeed.tracks && onRepeatSeed.tracks.length > 0) {
            heroMix = onRepeatSeed;
          } else if (madeForYou[0] && madeForYou[0].tracks && madeForYou[0].tracks.length > 0) {
            heroMix = madeForYou[0];
          }

          // Cold-start fallback: if heroMix is still null, use the first dynamic discovery seed
          if (!heroMix && trendingSeeds.length > 0) {
            heroMix = {
              type: 'playlist',
              id: trendingSeeds[0].id,
              title: trendingSeeds[0].title,
              image: trendingSeeds[0].image,
              score: 10.0,
              reason: trendingSeeds[0].reason,
              query: trendingSeeds[0].query,
            };
          }

          // Fatigue Filter: Filter out fatigued seeds from sections
          const currentTracker = state.fatigueTracker || {};
          const filterFatigue = (seed: RecommendationSeed) => {
            const record = currentTracker[seed.id];
            return !record || !isSeedFatigued(record);
          };

          set((state) => ({
            featuredHeroMix: heroMix,
            onRepeat: onRepeatSeed,
            repeatRewind: repeatRewindSeed,
            discoverWeekly: discoverWeeklySeed,
            deepCuts: deepCutsSeed,
            timeMix: timeMixSeed,
            dailyMixes: dailyMixes.filter(filterFatigue),
            madeForYou: madeForYou.filter(filterFatigue),
            becauseYouLike: becauseYouLike.filter(filterFatigue),
            rediscover: rediscover.filter(filterFatigue),
            recentlyLoved: recentlyLoved.filter(filterFatigue),
            hiddenGems: hiddenGems.filter(filterFatigue),
            forgottenFavorites: forgottenFavorites.filter(filterFatigue),
            trendingSeeds,
            trendingForYou,
            topSongs,
            topArtists,
            
            readiness,
            listeningDNA,
            tasteSnapshots: updatedSnapshots,
            tasteDriftLevel,
            tasteDriftDetected,
            listeningEventsCountSinceBuild: 0,
            generatedAt: Date.now(),
            lastRecommendationBuild: Date.now(),
            analyticsVersion: analyticsVersion,
          }));
        } catch (error) {
          console.error('[RecommendationsStore] Error generating telemetry recommendations:', error);
        }
      },

      resetRecommendations: () => {
        set({
          featuredHeroMix: null,
          onRepeat: null,
          repeatRewind: null,
          discoverWeekly: null,
          deepCuts: null,
          timeMix: null,
          dailyMixes: [],
          madeForYou: [],
          rediscover: [],
          becauseYouLike: [],
          recentlyLoved: [],
          trendingSeeds: [],
          trendingForYou: null,
          topSongs: [],
          topArtists: [],
          hiddenGems: [],
          forgottenFavorites: [],
          forgottenFavoritesShownAt: {},
          readiness: null,
          listeningDNA: null,
          tasteSnapshots: [],
          tasteDriftLevel: 'none',
          tasteDriftDetected: false,
          fatigueTracker: {},
          listeningEventsCountSinceBuild: 0,
          generatedAt: null,
          lastRecommendationBuild: null,
        });
      },

      registerRecommendationShown: (seedId: string) => {
        // Increment shown count in analytics store
        useAnalyticsStore.getState().incrementShownRecommendations(1);

        set((state) => {
          const fatigue = { ...(state.fatigueTracker || {}) };
          const record = fatigue[seedId] || {
            seedId,
            recommendedCount: 0,
            ignoredCount: 0,
            lastShownAt: 0
          };
          
          const recommendedCount = record.recommendedCount + 1;
          let ignoredCount = record.ignoredCount;
          let lastShownAt = record.lastShownAt;

          // If shown 5 times without being clicked, increment ignored count and decay lock it
          if (recommendedCount >= 5) {
            ignoredCount++;
            lastShownAt = Date.now();
            console.log(`[FatigueTracker] Seed ${seedId} ignored ${ignoredCount} times. Applying decay locking.`);
          }

          fatigue[seedId] = {
            ...record,
            recommendedCount: recommendedCount >= 5 ? 0 : recommendedCount,
            ignoredCount,
            lastShownAt
          };

          // Cap fatigue tracker at 500 records: remove oldest records using lastShownAt
          const keys = Object.keys(fatigue);
          if (keys.length > 500) {
            let oldestKey = '';
            let oldestTime = Infinity;
            for (const key of keys) {
              if (fatigue[key].lastShownAt < oldestTime) {
                oldestTime = fatigue[key].lastShownAt;
                oldestKey = key;
              }
            }
            if (oldestKey) {
              delete fatigue[oldestKey];
            }
          }

          const shownAt = { ...(state.forgottenFavoritesShownAt || {}) };
          const isForgottenFavorite = state.forgottenFavorites?.some((s) => s.id === seedId);
          if (isForgottenFavorite) {
            shownAt[seedId] = Date.now();
          }

          return {
            fatigueTracker: fatigue,
            forgottenFavoritesShownAt: shownAt,
          };
        });
      },

      registerRecommendationClick: (seedId: string, action: 'play' | 'like' | 'complete' = 'play') => {
        // Increment clicked or completed recommendations in analytics store
        if (action === 'play' || action === 'like') {
          useAnalyticsStore.getState().incrementClickedRecommendations();
        } else if (action === 'complete') {
          useAnalyticsStore.getState().incrementCompletedRecommendations();
        }

        set((state) => {
          const fatigue = { ...(state.fatigueTracker || {}) };
          const record = fatigue[seedId];
          if (!record) return {};

          fatigue[seedId] = handleFatigueInteraction(record, action);
          console.log(`[FatigueTracker] Fatigue reset action: ${action} on seed ${seedId}.`);
          return { fatigueTracker: fatigue };
        });
      },

      incrementListeningEvent: () => {
        set((state) => ({
          listeningEventsCountSinceBuild: state.listeningEventsCountSinceBuild + 1
        }));
      },

      getArtistSkipRate: (artist: string) => {
        const affinities = useAnalyticsStore.getState().artistAffinities;
        const aff = affinities[artist];
        if (!aff || aff.playCount === 0) return 0;
        return aff.skipCount / aff.playCount;
      },

      getTrackSkipRate: (trackId: string) => {
        const affinities = useAnalyticsStore.getState().trackAffinities;
        const aff = affinities[trackId];
        if (!aff || aff.playCount === 0) return 0;
        return aff.skipCount / aff.playCount;
      },

      getAutoplayContinuationQueue: async (lastTrackId: string) => {
        const analytics = useAnalyticsStore.getState();
        const history = analytics.history || [];
        const { useDownloadStore } = require('../../download/store/download.store');
        const downloadedTracks = Object.values(useDownloadStore.getState().downloadedTracks || {}) as any[];
        
        const localPool = [
          ...history.map((h: any) => h.trackSnapshot || h),
          ...downloadedTracks,
        ].filter((t: any) => t && t.id);

        const trackMatch = localPool.find(t => t.id === lastTrackId);
        const artist = trackMatch?.artist || '';
        const cleanArtist = artist.toLowerCase().trim();

        // Find tracks by the current artist
        const artistTracks = cleanArtist ? localPool.filter(t => t.artist?.toLowerCase().trim() === cleanArtist) : [];

        // Find other tracks from related artists in the same taste cluster if possible
        const clusters = buildTasteClusters(analytics.artistAffinities, history, analytics.artistCache);
        const matchingCluster = clusters.find(c => c.artists.some(a => a.toLowerCase().trim() === cleanArtist)) || clusters[0];
        
        let relatedTracks: any[] = [];
        if (matchingCluster) {
          const clusterArtists = new Set(matchingCluster.artists.map(a => a.toLowerCase().trim()));
          relatedTracks = localPool.filter(t => {
            const trackArt = t.artist?.toLowerCase().trim();
            return trackArt && clusterArtists.has(trackArt) && trackArt !== cleanArtist;
          });
        }

        // Mix: artistTracks, related tracks, remaining localPool
        const combined = [...artistTracks, ...relatedTracks, ...localPool];

        // De-duplicate by ID
        const seen = new Set<string>();
        const queue: any[] = [];
        for (const track of combined) {
          if (track.id !== lastTrackId && !seen.has(track.id)) {
            seen.add(track.id);
            queue.push({
              id: track.id,
              title: track.title,
              artist: track.artist,
              art: track.art || '',
              url: '',
              duration: track.durationSec || 240,
              dominantColors: track.dominantColors || ['#bf5af2', '#1a0033'],
              source: 'local'
            });
          }
          if (queue.length >= 10) break;
        }

        return queue;
      },

      refreshDiscover: async (forceNext: boolean = false) => {
        const state = get();
        try {
          const { useTasteProfileStore } = await import('../../taste-profile/store/taste-profile.store');
          const profile = useTasteProfileStore.getState();

          if (profile.onboardingCompleted && (profile.favoriteArtists.length > 0 || profile.songLanguages.length > 0 || profile.genres.length > 0)) {
            const { buildDynamicDiscoverySeeds } = await import('../../taste-profile/services/preference-prior.service');
            const dynamicSeeds = buildDynamicDiscoverySeeds();
            if (dynamicSeeds.length > 0) {
              set({ trendingSeeds: dynamicSeeds });
              return;
            }
          }
        } catch {
          // fallback to default rotation
        }

        const nextIndex = forceNext
          ? (state.discoveryRotationIndex + 3) % DISCOVERY_CATALOGUE.length
          : (state.discoveryRotationIndex || 0);
        
        const selected = getDiscoverySlice(nextIndex, 4);

        try {
          const updatedSeeds: TrendingSeed[] = await Promise.all(
            selected.map(async (item) => {
              const prevMatch = state.trendingSeeds?.find(s => s.id === item.id);
              let cover = (prevMatch?.image && !prevMatch.image.startsWith('aura://') && !prevMatch.image.includes('placeholder'))
                ? prevMatch.image
                : null;
              
              if (!cover) {
                const fallbackSeed = { type: 'playlist', id: item.id, title: item.title } as any;
                cover = await resolveTrendingCoverAsync(item.query, fallbackSeed);
              }

              return {
                type: 'playlist',
                id: item.id,
                title: item.title,
                image: cover || item.defaultArtwork,
                source: item.source,
                fetchedAt: Date.now(),
                query: item.query,
                reason: item.reason,
              };
            })
          );

          set({
            discoveryRotationIndex: nextIndex,
            trendingSeeds: updatedSeeds,
          });
        } catch (e) {
          console.warn('[RecommendationsStore] Error in refreshDiscover:', e);
        }
      },

      refreshTrendingIfNeeded: async () => {
        const state = get();
        const currentTrending = state.trendingSeeds || [];
        const oneDayMs = 24 * 60 * 60 * 1000;
        const lastFetched = currentTrending[0]?.fetchedAt || 0;
        const hasRealImages = currentTrending.length >= 3 && currentTrending.every(s => s.image && !s.image.startsWith('aura://'));
        if (Date.now() - lastFetched < oneDayMs && hasRealImages) {
          return;
        }
        await get().refreshDiscover(false);
      },

      startPeriodicPreload: () => {
        if (preloadSubscriptionInitialized) return;
        preloadSubscriptionInitialized = true;

        const checkAndPreload = async () => {
          const state = get();
          const lastBuild = state.lastRecommendationBuild || 0;
          const fifteenMinutes = 15 * 60 * 1000;
          const isColdOrEmpty = !state.generatedAt || (!state.trendingSeeds || state.trendingSeeds.length === 0);
          if (isColdOrEmpty || Date.now() - lastBuild > fifteenMinutes) {
            console.log('[RecommendationsStore] Preload trigger: recommendations stale (>15m) or cold unhydrated. Refreshing...');
            await state.generateRecommendations();
            state.refreshTrendingIfNeeded();
          }
        };

        // 1. Initial preload on app mount
        checkAndPreload();

        // 2. React Native AppState listener: background -> active
        try {
          const { AppState } = require('react-native');
          AppState.addEventListener('change', (nextAppState: string) => {
            if (nextAppState === 'active') {
              checkAndPreload();
            }
          });
        } catch (e) {
          console.warn('[RecommendationsStore] Failed to register AppState listener:', e);
        }
      }
    }),
    {
      name: 'aura-recommendations-s12',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        listeningDNA: state.listeningDNA,
        tasteSnapshots: state.tasteSnapshots,
        tasteDriftLevel: state.tasteDriftLevel,
        tasteDriftDetected: state.tasteDriftDetected,
        fatigueTracker: state.fatigueTracker,
        listeningEventsCountSinceBuild: state.listeningEventsCountSinceBuild,
        lastRecommendationBuild: state.lastRecommendationBuild,
        discoveryRotationIndex: state.discoveryRotationIndex,
        trendingSeeds: state.trendingSeeds,
        featuredHeroMix: state.featuredHeroMix,
        dailyMixes: state.dailyMixes,
        madeForYou: state.madeForYou,
        becauseYouLike: state.becauseYouLike,
        topArtists: state.topArtists,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;

          // Cleanse legacy aura:// placeholders from trendingSeeds
          if (Array.isArray(state.trendingSeeds)) {
            state.trendingSeeds = state.trendingSeeds.map((s) => {
              if (!s.image || s.image.startsWith('aura://')) {
                const catItem = DISCOVERY_CATALOGUE.find(d => d.id === s.id);
                const fallbackImg = catItem?.defaultArtwork || 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg';
                return { ...s, image: fallbackImg };
              }
              return s;
            });
          }

          // Cleanse legacy aura:// placeholders from dailyMixes and madeForYou
          const cleanseList = (list: any[]) => (list || []).map((seed: any) => {
            if (seed.image && seed.image.startsWith('aura://')) {
              const trackArt = seed.tracks?.[0]?.art || seed.tracks?.[0]?.artwork;
              if (trackArt && !trackArt.startsWith('aura://')) {
                return { ...seed, image: trackArt };
              }
            }
            return seed;
          });
          state.dailyMixes = cleanseList(state.dailyMixes);
          state.madeForYou = cleanseList(state.madeForYou);
        }
      },
    }
  )
);
