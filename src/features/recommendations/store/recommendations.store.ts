import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAnalyticsStore, splitArtistNames } from '../../analytics/store/analytics.store';
import { catalogTracks } from '../../../data/music-catalog';
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

async function resolveSeedArtworkAsync(
  seed: RecommendationSeed,
  history: HistoryEntry[],
  artistCache: Record<string, { id: string; image: string }>
): Promise<string> {
  // If it's a track seed, it already has the track's artwork
  if (seed.type === 'track') {
    const url = seed.image;
    if (url && url.length > 0 && !url.includes('placeholder')) {
      return url;
    }
  }

  // 1. Try first recommended track from history/catalog matching seed artists
  if (seed.seedArtists && seed.seedArtists.length > 0) {
    // Check history first
    for (const name of seed.seedArtists) {
      const clean = name.toLowerCase().trim();
      const match = history.find(h => splitArtistNames(h.artist).some(an => an.toLowerCase().trim() === clean));
      if (match?.art && !match.art.includes('placeholder')) return match.art;
    }
    // Check catalog
    for (const name of seed.seedArtists) {
      const clean = name.toLowerCase().trim();
      const match = catalogTracks.find(t => t.artist.toLowerCase().trim() === clean);
      if (match?.art && !match.art.includes('placeholder')) return match.art;
    }
  }

  // 2. Try strongest seed artist image from cache
  if (seed.seedArtists && seed.seedArtists.length > 0) {
    for (const name of seed.seedArtists) {
      const cached = artistCache[name];
      if (cached?.image && !cached.image.includes('placeholder')) {
        return cached.image;
      }
    }
  }

  // 3. Try to fetch/hydrate the first track of this playlist from API
  if (seed.type === 'playlist' || seed.type === 'artist' || seed.type === 'radio') {
    try {
      const { musicService } = require('../../../services/api/music');
      if (seed.seedArtists && seed.seedArtists.length > 0) {
        const topArtist = seed.seedArtists[0];
        const searchSongs = await musicService.searchSongs(topArtist);
        if (searchSongs && searchSongs[0]?.art && !searchSongs[0].art.includes('placeholder')) {
          return searchSongs[0].art;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Fallback to seed image if it's not a generic placeholder
  if (seed.image && !seed.image.includes('placeholder')) {
    return seed.image;
  }

  // ABSOLUTE FALLBACK: resolveArtwork will provide a deterministic aura://generated URI
  return resolveArtwork(seed, 'album');
}

export interface TrendingSeed {
  type: 'playlist';
  id: string; // "trending-global", "trending-india"
  title: string;
  image: string;
  source: 'global' | 'india';
  fetchedAt: number;
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
  trendingSeeds: TrendingSeed[];
  trendingForYou: RecommendationSeed | null;
  topSongs: RecommendationSeed[];
  topArtists: RecommendationSeed[];
  hiddenGems: RecommendationSeed[];
  forgottenFavorites: RecommendationSeed[];
  forgottenFavoritesShownAt: Record<string, number>;
  
  // Taste Evolution State
  listeningDNA: ListeningDNA | null;
  tasteSnapshots: TasteSnapshot[];
  tasteDriftLevel: TasteDriftLevel;
  tasteDriftDetected: boolean;
  fatigueTracker: Record<string, FatigueRecord>;
  listeningEventsCountSinceBuild: number;
  
  // Playback Intelligence Prep Config & Schema
  crossfadeEnabled: boolean;
  crossfadeDuration: number; // in seconds

  generatedAt: number | null;
  lastRecommendationBuild: number | null;
  analyticsVersion: number;
  
  isHydrated: boolean;
}

export interface RecommendationsActions {
  generateRecommendations: () => Promise<void>;
  resetRecommendations: () => void;
  refreshTrendingIfNeeded: () => void;
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
      dailyMixes: [
        {
          type: 'playlist',
          id: 'daily-mix-1',
          title: 'Daily Mix 1',
          image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=480',
          score: 5.0,
          reason: 'Atmospheric electronic & melodic beats.',
          confidence: 100
        },
        {
          type: 'playlist',
          id: 'daily-mix-2',
          title: 'Daily Mix 2',
          image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&q=80&w=480',
          score: 4.8,
          reason: 'Smooth lo-fi and ambient melodies.',
          confidence: 95
        },
        {
          type: 'playlist',
          id: 'daily-mix-3',
          title: 'Daily Mix 3',
          image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=480',
          score: 4.6,
          reason: 'High energy synthwave anthems.',
          confidence: 90
        }
      ],
      madeForYou: [],
      rediscover: [],
      becauseYouLike: [],
      recentlyLoved: [],
      trendingSeeds: [
        {
          type: 'playlist',
          id: 'trending-global',
          title: 'Global Top Hits',
          image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=480',
          source: 'global',
          fetchedAt: Date.now(),
        },
        {
          type: 'playlist',
          id: 'trending-india',
          title: 'Trending in India',
          image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=480',
          source: 'india',
          fetchedAt: Date.now(),
        },
        {
          type: 'playlist',
          id: 'trending-synthwave',
          title: 'Synthwave & Chill',
          image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=480',
          source: 'global',
          fetchedAt: Date.now(),
        }
      ],
      trendingForYou: null,
      topSongs: [],
      topArtists: [],
      hiddenGems: [],
      forgottenFavorites: [],
      forgottenFavoritesShownAt: {},
      
      listeningDNA: null,
      tasteSnapshots: [],
      tasteDriftLevel: 'none',
      tasteDriftDetected: false,
      fatigueTracker: {},
      listeningEventsCountSinceBuild: 0,
      
      crossfadeEnabled: false,
      crossfadeDuration: 3,

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

          // Standard fallback seeds (reference for Tier 2 fallbacks if needed)
          const fallbackDailyMixes: RecommendationSeed[] = [
            {
              type: 'playlist',
              id: 'late-night-drive',
              title: 'Late Night Drive',
              image: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=480',
              score: 5.0,
              reason: 'Editorial Mix: Atmospheric late night beats.',
              confidence: 100
            },
            {
              type: 'playlist',
              id: 'chill-vibes',
              title: 'Chill Vibes',
              image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&q=80&w=480',
              score: 5.0,
              reason: 'Editorial Mix: Relaxing background tracks.',
              confidence: 100
            },
            {
              type: 'playlist',
              id: 'workout-energy',
              title: 'Workout Energy',
              image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&q=80&w=480',
              score: 5.0,
              reason: 'Editorial Mix: Fast-paced training beats.',
              confidence: 100
            }
          ];

          const fallbackTrendingForYou: RecommendationSeed = {
            type: 'playlist',
            id: 'trending-global',
            title: 'Global Top Hits',
            image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=480',
            score: 9.0,
            reason: 'Popular global chart toppers.',
            confidence: 100
          };

          // Deduplication Pools
          const globalTrackPool = new Set<string>();
          const globalArtistPool = new Set<string>();

          if (historyLength === 0) {
            // Tier 1: Cold Start fallback - populate starter editorial mixes with rich cover art
            dailyMixes = fallbackDailyMixes;
            trendingForYou = fallbackTrendingForYou;
            madeForYou = [];
            rediscover = [];
            becauseYouLike = [];
            recentlyLoved = [];
            topSongs = [];
            topArtists = [];
          } else {
            // Tier 2, 3, or 4 - Generate personalized components
            
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

            // Generate other sections
            const personalDaily = generateDailyMixes(artistAffinities, history, artistCache, topSongs);
            
            // Loop Protection: add top Daily Mix's seed artists to the artist pool
            const firstDaily = personalDaily[0];
            if (firstDaily && firstDaily.seedArtists) {
              firstDaily.seedArtists.forEach(art => globalArtistPool.add(art.toLowerCase().trim()));
            }

            if (historyLength <= 20) {
              // Tier 2: 70% Editorial / 30% Personalization
              console.log('[CurationStore] Tier 2 Curation: 70% Editorial / 30% Personalization active.');
              dailyMixes = [
                firstDaily || fallbackDailyMixes[0],
                fallbackDailyMixes[1],
                fallbackDailyMixes[2]
              ].filter(Boolean);

              const rawBYL = generateBecauseYouLike(artistAffinities, history, artistCache, topSongs);
              becauseYouLike = rawBYL
                .filter(s => {
                  const artName = s.title.toLowerCase().trim();
                  if (globalArtistPool.has(artName)) return false;
                  globalArtistPool.add(artName);
                  return true;
                })
                .slice(0, 2);

              trendingForYou = fallbackTrendingForYou;
            } else {
              // Tier 3 or 4: Full Personalization / Advanced Taste Engine
              console.log(`[CurationStore] Full Personalization active (Tier ${historyLength > 100 ? 4 : 3}).`);
              dailyMixes = personalDaily;

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
            }

            // Generate Hidden Gems & Forgotten Favorites
            const excludeTrackIds = new Set<string>();
            topSongs.forEach(s => excludeTrackIds.add(s.id));
            recentlyLoved.forEach(s => excludeTrackIds.add(s.id));
            rediscover.forEach(s => excludeTrackIds.add(s.id));

            hiddenGems = generateHiddenGems(trackAffinities, history, excludeTrackIds);
            forgottenFavorites = generateForgottenFavorites(trackAffinities, history, state.forgottenFavoritesShownAt || {});
          }

          // Caching trending playlist seeds
          const trendingSeeds: TrendingSeed[] = [
            {
              type: 'playlist',
              id: 'trending-global',
              title: 'Global Top Hits',
              image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=480',
              source: 'global',
              fetchedAt: Date.now(),
            },
            {
              type: 'playlist',
              id: 'trending-india',
              title: 'Trending in India',
              image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=480',
              source: 'india',
              fetchedAt: Date.now(),
            }
          ];

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

      refreshTrendingIfNeeded: () => {
        const state = get();
        const now = Date.now();
        const sixHours = 6 * 60 * 60 * 1000;
        
        // If trendingSeeds is empty or fetchedAt was more than 6 hours ago, rebuild
        const firstSeed = state.trendingSeeds[0];
        if (!firstSeed || now - firstSeed.fetchedAt > sixHours) {
          console.log('[RecommendationsStore] Refreshing trending seeds due to 6-hour TTL expiration.');
          state.generateRecommendations();
        }
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
        const history = analytics.history;
        const trackMatch = history.find(h => h.id === lastTrackId) || catalogTracks.find(t => t.id === lastTrackId);
        const artist = trackMatch?.artist || '';
        const cleanArtist = artist.toLowerCase().trim();

        // Find tracks by the current artist
        const artistTracks = catalogTracks.filter(t => t.artist.toLowerCase().trim() === cleanArtist);

        // Find other tracks from related artists in the same taste cluster if possible
        const clusters = buildTasteClusters(analytics.artistAffinities, history, analytics.artistCache);
        const matchingCluster = clusters.find(c => c.artists.some(a => a.toLowerCase().trim() === cleanArtist)) || clusters[0];
        
        let relatedTracks: any[] = [];
        if (matchingCluster) {
          const clusterArtists = new Set(matchingCluster.artists.map(a => a.toLowerCase().trim()));
          relatedTracks = catalogTracks.filter(t => {
            const trackArt = t.artist.toLowerCase().trim();
            return clusterArtists.has(trackArt) && trackArt !== cleanArtist;
          });
        }

        // Mix: artistTracks, related/trending tracks
        const combined = [...artistTracks, ...relatedTracks];
        if (combined.length < 10) {
          // Fill up with general catalog
          combined.push(...catalogTracks.filter(t => t.id !== lastTrackId));
        }

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
              art: track.art || 'https://picsum.photos/400/400?random=105',
              url: '',
              duration: track.durationSec || 240,
              dominantColors: track.dominantColors || ['#bf5af2', '#1a0033'],
              source: 'local'
            });
          }
          if (queue.length >= 10) break;
        }

        return queue;
      }
    }),
    {
      name: 'aura-recommendations-s11',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        dailyMixes: state.dailyMixes,
        madeForYou: state.madeForYou,
        rediscover: state.rediscover,
        becauseYouLike: state.becauseYouLike,
        recentlyLoved: state.recentlyLoved,
        trendingSeeds: state.trendingSeeds,
        trendingForYou: state.trendingForYou,
        topSongs: state.topSongs,
        topArtists: state.topArtists,
        hiddenGems: state.hiddenGems,
        forgottenFavorites: state.forgottenFavorites,
        forgottenFavoritesShownAt: state.forgottenFavoritesShownAt || {},
        listeningDNA: state.listeningDNA,
        tasteSnapshots: state.tasteSnapshots,
        tasteDriftLevel: state.tasteDriftLevel,
        tasteDriftDetected: state.tasteDriftDetected,
        fatigueTracker: state.fatigueTracker,
        listeningEventsCountSinceBuild: state.listeningEventsCountSinceBuild,
        generatedAt: state.generatedAt,
        lastRecommendationBuild: state.lastRecommendationBuild,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
    }
  )
);
