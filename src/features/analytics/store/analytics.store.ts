import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerTrack } from '../../player/types/player';
import { catalogTracks, catalogAlbums } from '../../../data/music-catalog';

export function splitArtistNames(artistStr: string): string[] {
  if (!artistStr) return [];
  const normalized = artistStr
    .replace(/\s+feat\.\s+/gi, ',')
    .replace(/\s+ft\.\s+/gi, ',')
    .replace(/\s+&\s+/g, ',')
    .replace(/\s+vs\.\s+/gi, ',')
    .replace(/\s*\/\s*/g, ',');
  
  return normalized
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

export interface HistoryEntry {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  album: string | null;
  albumId: string | null;
  art: string | null;
  playedAt: number;
  positionMs: number;
  durationMs: number;
  completionRatio: number;
  skipped: boolean;
  trackSnapshot?: PlayerTrack;
  sourceContext?: {
    type?: 'album' | 'playlist' | 'search' | 'radio' | 'home' | 'local' | 'downloads' | 'queue' | 'artist' | 'autoplay';
    id?: string;
    title?: string;
  };
}

export interface AffinityMetric {
  playCount: number;
  completionCount: number;
  skipCount: number;
  totalListenMs: number;
  score: number;
  uniqueTracks?: string[];
  uniqueAlbums?: string[];
  firstPlayedAt?: number;
  lastPlayedAt?: number;
  skip15sCount?: number;
  abandonedCount?: number;
  likedCount?: number;
  playlistAddCount?: number;
  repeatCount?: number;
  shareCount?: number;
}

export interface ArtistProfile {
  browseId: string;
  name: string;
  image: string;
  subscriberCount?: string | number;
  lastResolvedAt: number;
}

export interface UserTasteProfile {
  favoriteArtists: string[];
  favoriteAlbums: string[];
  activeHours: number[];
  completionRate: number;
  skipRate: number;
  explorationScore: number;
}

export interface AnalyticsState {
  history: HistoryEntry[];
  artistAffinities: Record<string, AffinityMetric>;
  albumAffinities: Record<string, AffinityMetric>;
  trackAffinities: Record<string, AffinityMetric>;
  artistCache: Record<string, { id: string; image: string }>;
  artistProfileCache?: Record<string, ArtistProfile>;
  userTasteProfile?: UserTasteProfile | null;
  currentSession: {
    trackId: string;
    startedAt: number;
    startPosition: number;
  } | null;
  
  // Incremental counters for taste profile
  totalHistoryCount: number;
  totalCompletedCount: number;
  totalSkippedCount: number;
  activeHoursMap: Record<number, number>;

  // Recommendation CTR & Analytics counters
  shownRecommendationsCount: number;
  clickedRecommendationsCount: number;
  completedRecommendationsCount: number;
  newSongsRecommendedCount: number;
  newSongsCompletedCount: number;

  analyticsVersion: number;
  isHydrated: boolean;

  // Push-based Computed Collections (Stable References)
  computed: {
    continueListening: HistoryEntry[];
    recentlyPlayed: HistoryEntry[];
    topArtists: (AffinityMetric & { name: string })[];
    topAlbums: (AffinityMetric & { name: string })[];
    topTracks: (AffinityMetric & { name: string })[];
  };
}

export interface AnalyticsActions {
  addHistoryEntry: (entry: Omit<HistoryEntry, 'playedAt'>) => void;
  removeHistoryEntry: (id: string, playedAt: number) => void;
  clearHistory: () => void;
  incrementArtistAffinity: (
    key: string,
    partial: Partial<AffinityMetric> & { trackId?: string; albumName?: string; skipWithin15s?: boolean; abandoned?: boolean }
  ) => void;
  incrementAlbumAffinity: (key: string, partial: Partial<AffinityMetric> & { skipWithin15s?: boolean }) => void;
  incrementTrackAffinity: (key: string, partial: Partial<AffinityMetric> & { skipWithin15s?: boolean }) => void;
  cacheArtistDetails: (name: string, details: { id: string; image: string }) => void;
  cacheArtistProfile: (profile: ArtistProfile) => void;
  rebuildTasteProfile: (force?: boolean) => void;
  rebuildComputedCollections: () => void;
  resetAnalytics: () => void;
  initialize: () => Promise<void>;
  setCurrentSession: (session: { trackId: string; startedAt: number; startPosition: number } | null) => void;
  setHydrated: (hydrated: boolean) => void;

  // Counter Increments
  incrementShownRecommendations: (count?: number) => void;
  incrementClickedRecommendations: () => void;
  incrementCompletedRecommendations: () => void;
  incrementNewSongsRecommended: () => void;
  incrementNewSongsCompleted: () => void;

  // Feedback Actions
  trackLiked: (trackId: string) => void;
  trackAddedToPlaylist: (trackId: string) => void;
  trackRepeated: (trackId: string) => void;
  trackShared: (trackId: string) => void;
}

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>()(
  persist(
    (set, get) => ({
      // State
      history: [],
      artistAffinities: {},
      albumAffinities: {},
      trackAffinities: {},
      artistCache: {},
      artistProfileCache: {},
      userTasteProfile: null,
      currentSession: null,

      totalHistoryCount: 0,
      totalCompletedCount: 0,
      totalSkippedCount: 0,
      activeHoursMap: {},

      shownRecommendationsCount: 0,
      clickedRecommendationsCount: 0,
      completedRecommendationsCount: 0,
      newSongsRecommendedCount: 0,
      newSongsCompletedCount: 0,

      analyticsVersion: 0,
      isHydrated: false,

      computed: {
        continueListening: [],
        recentlyPlayed: [],
        topArtists: [],
        topAlbums: [],
        topTracks: [],
      },

      // Actions
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
      addHistoryEntry: (entry) => {
        set((state) => {
          let { newSongsRecommendedCount, newSongsCompletedCount, totalHistoryCount, totalCompletedCount, totalSkippedCount, activeHoursMap } = state;
          newSongsRecommendedCount = newSongsRecommendedCount || 0;
          newSongsCompletedCount = newSongsCompletedCount || 0;

          const isRecommendationContext = entry.sourceContext?.id && (
            entry.sourceContext.id.startsWith('daily-mix-') ||
            entry.sourceContext.id.startsWith('trending-') ||
            entry.sourceContext.id.startsWith('mix-') ||
            entry.sourceContext.id === 'rediscover' ||
            entry.sourceContext.id === 'recently-loved'
          );

          if (isRecommendationContext) {
            const isNewTrack = !state.history.some(h => h.id === entry.id);
            if (isNewTrack) {
              newSongsRecommendedCount += 1;
              if (entry.completionRatio >= 0.95 || !entry.skipped) {
                newSongsCompletedCount += 1;
              }
            }
          }

          const playedAt = Date.now();
          const hour = new Date(playedAt).getHours();
          const nextActiveHoursMap = { ...activeHoursMap, [hour]: (activeHoursMap[hour] || 0) + 1 };

          const last = state.history[0];
          if (last && last.id === entry.id) {
            // Update top entry: playedAt, positionMs, durationMs, completionRatio, skipped, and changed metadata
            const updated = [...state.history];
            
            // Adjust incremental counters if completion/skipped state changed
            const wasCompleted = last.completionRatio >= 0.9 || !last.skipped;
            const isCompleted = entry.completionRatio >= 0.9 || !entry.skipped;
            if (!wasCompleted && isCompleted) totalCompletedCount++;
            else if (wasCompleted && !isCompleted) totalCompletedCount--;

            if (!last.skipped && entry.skipped) totalSkippedCount++;
            else if (last.skipped && !entry.skipped) totalSkippedCount--;

            // PRUNE SNAPSHOT: Only store essential fields to reduce memory growth
            const prunedSnapshot = entry.trackSnapshot ? {
              id: entry.trackSnapshot.id,
              title: entry.trackSnapshot.title,
              artist: entry.trackSnapshot.artist,
              art: entry.trackSnapshot.art,
              album: entry.trackSnapshot.album,
              isLocal: entry.trackSnapshot.isLocal,
              source: entry.trackSnapshot.source,
            } as any : undefined;

            updated[0] = {
              ...last,
              ...entry,
              playedAt,
              trackSnapshot: prunedSnapshot,
            };
            return { 
              history: updated, 
              newSongsRecommendedCount,
              newSongsCompletedCount,
              totalCompletedCount,
              totalSkippedCount,
              activeHoursMap: nextActiveHoursMap,
              analyticsVersion: state.analyticsVersion + 1 
            };
          }

          // New history entry
          totalHistoryCount++;
          if (entry.completionRatio >= 0.9 || !entry.skipped) totalCompletedCount++;
          if (entry.skipped) totalSkippedCount++;

          // PRUNE SNAPSHOT: Only store essential fields to reduce memory growth
          const prunedSnapshot = entry.trackSnapshot ? {
            id: entry.trackSnapshot.id,
            title: entry.trackSnapshot.title,
            artist: entry.trackSnapshot.artist,
            art: entry.trackSnapshot.art,
            album: entry.trackSnapshot.album,
            isLocal: entry.trackSnapshot.isLocal,
            source: entry.trackSnapshot.source,
          } as any : undefined;

          const newEntry: HistoryEntry = {
            ...entry,
            playedAt,
            trackSnapshot: prunedSnapshot,
          };
          const newHistory = [newEntry, ...state.history].slice(0, 1000);
          
          return { 
            history: newHistory, 
            newSongsRecommendedCount,
            newSongsCompletedCount,
            totalHistoryCount,
            totalCompletedCount,
            totalSkippedCount,
            activeHoursMap: nextActiveHoursMap,
            analyticsVersion: state.analyticsVersion + 1 
          };
        });
        
        // Push architecture: Rebuild collections when history changes
        get().rebuildComputedCollections();

        if (get().history.length % 5 === 0) {
            get().rebuildTasteProfile();
        }
      },

      removeHistoryEntry: (id, playedAt) => {
        set((state) => {
            const entry = state.history.find(e => e.id === id && e.playedAt === playedAt);
            if (!entry) return state;

            let { totalHistoryCount, totalCompletedCount, totalSkippedCount, activeHoursMap } = state;
            totalHistoryCount = Math.max(0, totalHistoryCount - 1);
            if (entry.completionRatio >= 0.9 || !entry.skipped) totalCompletedCount = Math.max(0, totalCompletedCount - 1);
            if (entry.skipped) totalSkippedCount = Math.max(0, totalSkippedCount - 1);
            
            const hour = new Date(entry.playedAt).getHours();
            const nextActiveHoursMap = { ...activeHoursMap, [hour]: Math.max(0, (activeHoursMap[hour] || 0) - 1) };

            return {
                history: state.history.filter((e) => !(e.id === id && e.playedAt === playedAt)),
                totalHistoryCount,
                totalCompletedCount,
                totalSkippedCount,
                activeHoursMap: nextActiveHoursMap,
                analyticsVersion: state.analyticsVersion + 1
            };
        });
        get().rebuildComputedCollections();
        get().rebuildTasteProfile(true);
      },

      clearHistory: () => {
        set((state) => ({ 
          history: [], 
          totalHistoryCount: 0,
          totalCompletedCount: 0,
          totalSkippedCount: 0,
          activeHoursMap: {},
          analyticsVersion: state.analyticsVersion + 1 
        }));
        get().rebuildComputedCollections();
        get().rebuildTasteProfile(true);
      },

      incrementArtistAffinity: (key, partial) => {
        set((state) => {
          const artists = splitArtistNames(key);
          const nextAffinities = { ...state.artistAffinities };

          for (const artist of artists) {
            const existing = nextAffinities[artist] || {
              playCount: 0,
              completionCount: 0,
              skipCount: 0,
              totalListenMs: 0,
              score: 0,
              uniqueTracks: [],
              uniqueAlbums: [],
              firstPlayedAt: Date.now(),
              lastPlayedAt: Date.now(),
              skip15sCount: 0,
              abandonedCount: 0,
              likedCount: 0,
              playlistAddCount: 0,
              repeatCount: 0,
              shareCount: 0,
            };

            const uniqueTracks = [...(existing.uniqueTracks || [])];
            if (partial.trackId && !uniqueTracks.includes(partial.trackId)) {
              uniqueTracks.push(partial.trackId);
            }

            const uniqueAlbums = [...(existing.uniqueAlbums || [])];
            if (partial.albumName && !uniqueAlbums.includes(partial.albumName)) {
              uniqueAlbums.push(partial.albumName);
            }

            const playCount = existing.playCount + (partial.playCount || 0);
            const completionCount = existing.completionCount + (partial.completionCount || 0);
            const skipCount = existing.skipCount + (partial.skipCount || 0);
            const totalListenMs = existing.totalListenMs + (partial.totalListenMs || 0);
            const skip15sCount = (existing.skip15sCount || 0) + (partial.skipWithin15s ? 1 : 0);
            const abandonedCount = (existing.abandonedCount || 0) + (partial.abandoned ? 1 : 0);
            const likedCount = (existing.likedCount || 0) + (partial.likedCount || 0);
            const playlistAddCount = (existing.playlistAddCount || 0) + (partial.playlistAddCount || 0);
            const repeatCount = (existing.repeatCount || 0) + (partial.repeatCount || 0);
            const shareCount = (existing.shareCount || 0) + (partial.shareCount || 0);

            const firstPlayedAt = existing.firstPlayedAt || Date.now();
            const lastPlayedAt = partial.playCount ? Date.now() : (existing.lastPlayedAt || Date.now());

            // Compute consecutive skips for same artist - only look at recent history for performance
            let consecutiveSkips = 0;
            const recentHistory = state.history.slice(0, 20);
            for (const entry of recentHistory) {
              const names = splitArtistNames(entry.artist);
              if (names.includes(artist)) {
                if (entry.skipped) {
                  consecutiveSkips++;
                } else {
                  break;
                }
              }
            }

            // Depth-based scoring components
            const playScore = playCount * 1.0;
            const listenTimeScore = (totalListenMs / 600000) * 0.5;
            const uniqueTrackBonus = uniqueTracks.length * 3.0;
            const uniqueAlbumBonus = uniqueAlbums.length * 5.0;

            const daysSinceLastPlay = (Date.now() - lastPlayedAt) / (24 * 60 * 60 * 1000);
            const recencyBonus = daysSinceLastPlay <= 1 ? 10 : daysSinceLastPlay <= 3 ? 5 : daysSinceLastPlay <= 7 ? 2 : 0;

            // Strict skip penalties and recommendation feedback signals
            const skipPenalty = (skipCount * 5.0) + (skip15sCount * 10.0) + (consecutiveSkips * 2.0) + (abandonedCount * 4.0);
            const feedbackBonuses = (likedCount * 10.0) + (playlistAddCount * 15.0) + (repeatCount * 8.0);

            const score = playScore + (completionCount * 5.0) + listenTimeScore + uniqueTrackBonus + uniqueAlbumBonus + recencyBonus + feedbackBonuses - skipPenalty;

            nextAffinities[artist] = {
              playCount,
              completionCount,
              skipCount,
              totalListenMs,
              score: Math.max(-50, score),
              uniqueTracks,
              uniqueAlbums,
              firstPlayedAt,
              lastPlayedAt,
              skip15sCount,
              abandonedCount,
              likedCount,
              playlistAddCount,
              repeatCount,
              shareCount,
            };
          }

          return {
            artistAffinities: nextAffinities,
            analyticsVersion: state.analyticsVersion + 1
          };
        });
        get().rebuildComputedCollections();
      },

      incrementAlbumAffinity: (key, partial) => {
        set((state) => {
          const existing = state.albumAffinities[key] || {
            playCount: 0,
            completionCount: 0,
            skipCount: 0,
            totalListenMs: 0,
            score: 0,
          };
          
          const playCount = existing.playCount + (partial.playCount || 0);
          const completionCount = existing.completionCount + (partial.completionCount || 0);
          const skipCount = existing.skipCount + (partial.skipCount || 0);
          const totalListenMs = existing.totalListenMs + (partial.totalListenMs || 0);
          const skip15sCount = (existing.skip15sCount || 0) + (partial.skip15sCount || (partial.skipWithin15s ? 1 : 0));
          const likedCount = (existing.likedCount || 0) + (partial.likedCount || 0);
          const playlistAddCount = (existing.playlistAddCount || 0) + (partial.playlistAddCount || 0);
          const repeatCount = (existing.repeatCount || 0) + (partial.repeatCount || 0);
          const shareCount = (existing.shareCount || 0) + (partial.shareCount || 0);

          const score =
            playCount * 1.0 +
            (completionCount * 5.0) +
            (totalListenMs / 600000) * 0.5 -
            (skipCount * 5.0) -
            (skip15sCount * 10.0) +
            (likedCount * 10.0) +
            (playlistAddCount * 15.0) +
            (repeatCount * 8.0);

          const updated: AffinityMetric = {
            playCount,
            completionCount,
            skipCount,
            totalListenMs,
            score: Math.max(-50, score),
            likedCount,
            playlistAddCount,
            repeatCount,
            shareCount,
            skip15sCount,
          };

          return {
            albumAffinities: {
              ...state.albumAffinities,
              [key]: updated,
            },
            analyticsVersion: state.analyticsVersion + 1
          };
        });
        get().rebuildComputedCollections();
      },

      incrementTrackAffinity: (key, partial) => {
        set((state) => {
          const existing = state.trackAffinities[key] || {
            playCount: 0,
            completionCount: 0,
            skipCount: 0,
            totalListenMs: 0,
            score: 0,
          };
          
          const playCount = existing.playCount + (partial.playCount || 0);
          const completionCount = existing.completionCount + (partial.completionCount || 0);
          const skipCount = existing.skipCount + (partial.skipCount || 0);
          const totalListenMs = existing.totalListenMs + (partial.totalListenMs || 0);
          const skip15sCount = (existing.skip15sCount || 0) + (partial.skip15sCount || (partial.skipWithin15s ? 1 : 0));
          const likedCount = (existing.likedCount || 0) + (partial.likedCount || 0);
          const playlistAddCount = (existing.playlistAddCount || 0) + (partial.playlistAddCount || 0);
          const repeatCount = (existing.repeatCount || 0) + (partial.repeatCount || 0);
          const shareCount = (existing.shareCount || 0) + (partial.shareCount || 0);

          const score =
            playCount * 1.0 +
            (completionCount * 5.0) +
            (totalListenMs / 600000) * 0.5 -
            (skipCount * 5.0) -
            (skip15sCount * 10.0) +
            (likedCount * 10.0) +
            (playlistAddCount * 15.0) +
            (repeatCount * 8.0);

          const updated: AffinityMetric = {
            playCount,
            completionCount,
            skipCount,
            totalListenMs,
            score: Math.max(-50, score),
            likedCount,
            playlistAddCount,
            repeatCount,
            shareCount,
            skip15sCount,
          };

          return {
            trackAffinities: {
              ...state.trackAffinities,
              [key]: updated,
            },
            analyticsVersion: state.analyticsVersion + 1
          };
        });
        get().rebuildComputedCollections();
      },

      cacheArtistDetails: (name, details) => {
        set((state) => {
          const profile: ArtistProfile = {
            browseId: details.id,
            name: name,
            image: details.image,
            lastResolvedAt: Date.now(),
          };
          return {
            artistCache: {
              ...(state.artistCache || {}),
              [name]: details,
            },
            artistProfileCache: {
              ...(state.artistProfileCache || {}),
              [name]: profile,
            },
            analyticsVersion: state.analyticsVersion + 1,
          };
        });
      },

      cacheArtistProfile: (profile) => {
        set((state) => {
          const name = profile.name;
          const details = { id: profile.browseId, image: profile.image };
          return {
            artistCache: {
              ...(state.artistCache || {}),
              [name]: details,
            },
            artistProfileCache: {
              ...(state.artistProfileCache || {}),
              [name]: profile,
            },
            analyticsVersion: state.analyticsVersion + 1,
          };
        });
      },

      rebuildTasteProfile: (force = false) => {
        const state = get();
        if (!force && state.history.length === 0) return;

        // Perform sorting and derivation outside of state if possible
        const sortedArtists = Object.keys(state.artistAffinities)
            .map((key) => ({ name: key, score: state.artistAffinities[key].score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(a => a.name);

        const sortedAlbums = Object.keys(state.albumAffinities)
            .map((key) => ({ name: key, score: state.albumAffinities[key].score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(a => a.name);

        const completionRate = state.totalHistoryCount > 0 ? state.totalCompletedCount / state.totalHistoryCount : 0;
        const skipRate = state.totalHistoryCount > 0 ? state.totalSkippedCount / state.totalHistoryCount : 0;

        const activeHours = Object.keys(state.activeHoursMap)
            .map(Number)
            .sort((a, b) => state.activeHoursMap[b] - state.activeHoursMap[a])
            .slice(0, 4);

        // Approximate exploration score without full-history iteration
        const uniqueArtistsCount = Object.keys(state.artistAffinities).length;
        const explorationScore = state.totalHistoryCount > 0 
            ? Math.min(100, Math.round((uniqueArtistsCount / state.totalHistoryCount) * 100))
            : 50;

        const userTasteProfile: UserTasteProfile = {
            favoriteArtists: sortedArtists,
            favoriteAlbums: sortedAlbums,
            activeHours,
            completionRate,
            skipRate,
            explorationScore,
        };

        set({ userTasteProfile });
      },

      rebuildComputedCollections: () => {
        const state = get();
        
        // 1. Continue Listening
        const seenCL = new Set<string>();
        const continueListening = state.history
          .filter((e) => e.positionMs >= 30000 && e.completionRatio < 0.95 && !e.skipped)
          .sort((a, b) => b.playedAt - a.playedAt)
          .filter((e) => {
            if (seenCL.has(e.id)) return false;
            seenCL.add(e.id);
            return true;
          })
          .slice(0, 10);

        // 2. Recently Played
        const seenRP = new Set<string>();
        const recentlyPlayed = state.history
          .filter((e) => {
            if (!e.trackSnapshot) return false;
            const durationMs = e.positionMs || 0;
            return durationMs >= 15000 && e.completionRatio >= 0.05 && !e.skipped;
          })
          .sort((a, b) => b.playedAt - a.playedAt)
          .filter((e) => {
            if (seenRP.has(e.id)) return false;
            seenRP.add(e.id);
            return true;
          })
          .slice(0, 20);

        // 3. Top Artists
        const topArtists = Object.keys(state.artistAffinities)
          .map((key) => ({ name: key, ...state.artistAffinities[key] }))
          .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.playCount - a.playCount))
          .slice(0, 30);

        // 4. Top Albums
        const topAlbums = Object.keys(state.albumAffinities)
          .map((key) => ({ name: key, ...state.albumAffinities[key] }))
          .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.playCount - a.playCount))
          .slice(0, 30);

        // 5. Top Tracks
        const topTracks = Object.keys(state.trackAffinities)
          .map((key) => {
            const affinity = state.trackAffinities[key];
            const playCount = affinity.playCount || 0;
            const completionRate = playCount > 0 ? (affinity.completionCount || 0) / playCount : 0;
            const skipRate = playCount > 0 ? (affinity.skipCount || 0) / playCount : 0;

            // Try to find in history to get full metadata
            const historyMatch = state.history.find(h => h.id === key);
            // Try to find in catalog
            const catalogMatch = catalogTracks.find(t => t.id === key);
            
            const albumMatch = catalogMatch?.albumId ? catalogAlbums.find(a => a.id === catalogMatch.albumId) : null;
            const metadata = historyMatch ? {
              id: historyMatch.id,
              title: historyMatch.title,
              artist: historyMatch.artist,
              art: historyMatch.art,
              album: historyMatch.album,
              artistId: historyMatch.artistId,
              albumId: historyMatch.albumId,
              url: historyMatch.trackSnapshot?.url || '',
            } : catalogMatch ? {
              id: catalogMatch.id,
              title: catalogMatch.title,
              artist: catalogMatch.artist,
              art: catalogMatch.art,
              album: albumMatch ? albumMatch.title : null,
              artistId: catalogMatch.artistId,
              albumId: catalogMatch.albumId || null,
              url: '',
            } : {
              id: key,
              title: key,
              artist: 'Unknown Artist',
              art: null,
              album: null,
              artistId: null,
              albumId: null,
              url: '',
            };

            return {
              ...metadata,
              ...affinity,
              completionRate,
              skipRate,
              name: key,
            };
          })
          .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.playCount - a.playCount))
          .slice(0, 30);

        set({
          computed: {
            continueListening,
            recentlyPlayed,
            topArtists,
            topAlbums,
            topTracks,
          }
        });
      },

      resetAnalytics: () => {
        set({
          history: [],
          artistAffinities: {},
          albumAffinities: {},
          trackAffinities: {},
          artistCache: {},
          artistProfileCache: {},
          userTasteProfile: null,
          currentSession: null,
          totalHistoryCount: 0,
          totalCompletedCount: 0,
          totalSkippedCount: 0,
          activeHoursMap: {},
          shownRecommendationsCount: 0,
          clickedRecommendationsCount: 0,
          completedRecommendationsCount: 0,
          newSongsRecommendedCount: 0,
          newSongsCompletedCount: 0,
          analyticsVersion: 0,
          computed: {
            continueListening: [],
            recentlyPlayed: [],
            topArtists: [],
            topAlbums: [],
            topTracks: [],
          },
        });
      },
      setCurrentSession: (currentSession) => {
        set({ currentSession });
      },
      initialize: async () => {
        // Deferred heavy re-computations
        if (get().history.length > 0) {
          get().rebuildComputedCollections();
          get().rebuildTasteProfile(true);
        }
        set({ isHydrated: true });
      },
      incrementShownRecommendations: (count = 1) => {
        set((state) => ({ shownRecommendationsCount: (state.shownRecommendationsCount || 0) + count }));
      },
      incrementClickedRecommendations: () => {
        set((state) => ({ clickedRecommendationsCount: (state.clickedRecommendationsCount || 0) + 1 }));
      },
      incrementCompletedRecommendations: () => {
        set((state) => ({ completedRecommendationsCount: (state.completedRecommendationsCount || 0) + 1 }));
      },
      incrementNewSongsRecommended: () => {
        set((state) => ({ newSongsRecommendedCount: (state.newSongsRecommendedCount || 0) + 1 }));
      },
      incrementNewSongsCompleted: () => {
        set((state) => ({ newSongsCompletedCount: (state.newSongsCompletedCount || 0) + 1 }));
      },
      trackLiked: (trackId: string) => {
        const state = get();
        let track = state.history.find(h => h.id === trackId)?.trackSnapshot;
        if (!track) {
          try {
            const playerStore = require('../../player/store/player.store').usePlayerStore.getState();
            track = playerStore.queue.find((t: any) => t.id === trackId) || playerStore.currentTrack;
          } catch (e) {}
        }
        if (!track) {
          track = catalogTracks.find(t => t.id === trackId) as any;
        }
        if (!track) return;
        
        get().incrementTrackAffinity(trackId, { likedCount: 1 });
        if (track.artist) {
          get().incrementArtistAffinity(track.artist, { likedCount: 1, trackId: track.id });
        }
        if (track.album) {
          get().incrementAlbumAffinity(track.album, { likedCount: 1 });
        }
      },

      trackAddedToPlaylist: (trackId: string) => {
        const state = get();
        let track = state.history.find(h => h.id === trackId)?.trackSnapshot;
        if (!track) {
          try {
            const playerStore = require('../../player/store/player.store').usePlayerStore.getState();
            track = playerStore.queue.find((t: any) => t.id === trackId) || playerStore.currentTrack;
          } catch (e) {}
        }
        if (!track) {
          track = catalogTracks.find(t => t.id === trackId) as any;
        }
        if (!track) return;
        
        get().incrementTrackAffinity(trackId, { playlistAddCount: 1 });
        if (track.artist) {
          get().incrementArtistAffinity(track.artist, { playlistAddCount: 1, trackId: track.id });
        }
        if (track.album) {
          get().incrementAlbumAffinity(track.album, { playlistAddCount: 1 });
        }
      },

      trackRepeated: (trackId: string) => {
        const state = get();
        let track = state.history.find(h => h.id === trackId)?.trackSnapshot;
        if (!track) {
          try {
            const playerStore = require('../../player/store/player.store').usePlayerStore.getState();
            track = playerStore.queue.find((t: any) => t.id === trackId) || playerStore.currentTrack;
          } catch (e) {}
        }
        if (!track) {
          track = catalogTracks.find(t => t.id === trackId) as any;
        }
        if (!track) return;
        
        get().incrementTrackAffinity(trackId, { repeatCount: 1 });
        if (track.artist) {
          get().incrementArtistAffinity(track.artist, { repeatCount: 1, trackId: track.id });
        }
        if (track.album) {
          get().incrementAlbumAffinity(track.album, { repeatCount: 1 });
        }
      },

      trackShared: (trackId: string) => {
        const state = get();
        let track = state.history.find(h => h.id === trackId)?.trackSnapshot;
        if (!track) {
          try {
            const playerStore = require('../../player/store/player.store').usePlayerStore.getState();
            track = playerStore.queue.find((t: any) => t.id === trackId) || playerStore.currentTrack;
          } catch (e) {}
        }
        if (!track) {
          track = catalogTracks.find(t => t.id === trackId) as any;
        }
        if (!track) return;
        
        get().incrementTrackAffinity(trackId, { shareCount: 1 });
        if (track.artist) {
          get().incrementArtistAffinity(track.artist, { shareCount: 1, trackId: track.id });
        }
        if (track.album) {
          get().incrementAlbumAffinity(track.album, { shareCount: 1 });
        }
      },
    }),
    {
      name: 'aura-analytics',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        history: state.history,
        artistAffinities: state.artistAffinities,
        albumAffinities: state.albumAffinities,
        trackAffinities: state.trackAffinities,
        artistCache: state.artistCache || {},
        artistProfileCache: state.artistProfileCache || {},
        userTasteProfile: state.userTasteProfile || null,
        totalHistoryCount: state.totalHistoryCount || 0,
        totalCompletedCount: state.totalCompletedCount || 0,
        totalSkippedCount: state.totalSkippedCount || 0,
        activeHoursMap: state.activeHoursMap || {},
        shownRecommendationsCount: state.shownRecommendationsCount || 0,
        clickedRecommendationsCount: state.clickedRecommendationsCount || 0,
        completedRecommendationsCount: state.completedRecommendationsCount || 0,
        newSongsRecommendedCount: state.newSongsRecommendedCount || 0,
        newSongsCompletedCount: state.newSongsCompletedCount || 0,
      }),
      onRehydrateStorage: (state) => {
        return (hydratedState, error) => {
          if (!error && hydratedState) {
            // Rebuild computed collections once hydrated
            hydratedState.rebuildComputedCollections();
          }
        };
      },
    }
  )
);

// Memo-ready sorted selectors (Now using stable state references)
export const getRecentHistory = (state: AnalyticsState) => state.history;
export const getContinueListeningCandidates = (state: AnalyticsState) => state.computed.continueListening;
export const getRecentlyPlayedCandidates = (state: AnalyticsState) => state.computed.recentlyPlayed;
export const getTopArtists = (state: AnalyticsState) => state.computed.topArtists;
export const getTopAlbums = (state: AnalyticsState) => state.computed.topAlbums;
export const getTopTracks = (state: AnalyticsState) => state.computed.topTracks;

// Rolling Window selectors (Now using stable timestamps)
export const getHistoryLast7Days = (state: AnalyticsState) => {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return state.history.filter((h) => h.playedAt >= sevenDaysAgo);
};

export const getHistoryLast30Days = (state: AnalyticsState) => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return state.history.filter((h) => h.playedAt >= thirtyDaysAgo);
};

export const getHistoryLast90Days = (state: AnalyticsState) => {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return state.history.filter((h) => h.playedAt >= ninetyDaysAgo);
};

// Computed Recommendation Metrics selectors
export const getRecommendationClickRate = (state: AnalyticsState) => {
  const shown = state.shownRecommendationsCount || 0;
  const clicked = state.clickedRecommendationsCount || 0;
  return clicked / Math.max(1, shown);
};

export const getRecommendationCompletionRate = (state: AnalyticsState) => {
  const clicked = state.clickedRecommendationsCount || 0;
  const completed = state.completedRecommendationsCount || 0;
  return completed / Math.max(1, clicked);
};

export const getDiscoverySuccessRate = (state: AnalyticsState) => {
  const recommended = state.newSongsRecommendedCount || 0;
  const completed = state.newSongsCompletedCount || 0;
  return completed / Math.max(1, recommended);
};
