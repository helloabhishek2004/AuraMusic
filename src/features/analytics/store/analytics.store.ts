import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerTrack } from '../../player/types/player';
import { catalogTracks } from '../../../data/music-catalog';

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
  
  // Recommendation CTR & Analytics counters
  shownRecommendationsCount: number;
  clickedRecommendationsCount: number;
  completedRecommendationsCount: number;
  newSongsRecommendedCount: number;
  newSongsCompletedCount: number;

  analyticsVersion: number;
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
  rebuildTasteProfile: () => void;
  resetAnalytics: () => void;
  setCurrentSession: (session: { trackId: string; startedAt: number; startPosition: number } | null) => void;

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

      shownRecommendationsCount: 0,
      clickedRecommendationsCount: 0,
      completedRecommendationsCount: 0,
      newSongsRecommendedCount: 0,
      newSongsCompletedCount: 0,

      analyticsVersion: 0,

      // Actions
      addHistoryEntry: (entry) => {
        set((state) => {
          let newSongsRecommendedCount = state.newSongsRecommendedCount || 0;
          let newSongsCompletedCount = state.newSongsCompletedCount || 0;

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

          const last = state.history[0];
          if (last && last.id === entry.id) {
            // Update top entry: playedAt, positionMs, durationMs, completionRatio, skipped, and changed metadata
            const updated = [...state.history];
            updated[0] = {
              ...last,
              ...entry,
              playedAt: Date.now(),
            };
            return { 
              history: updated, 
              newSongsRecommendedCount,
              newSongsCompletedCount,
              analyticsVersion: state.analyticsVersion + 1 
            };
          }

          // Prepend new history record (capping at 1000)
          const newEntry: HistoryEntry = {
            ...entry,
            playedAt: Date.now(),
          };
          const newHistory = [newEntry, ...state.history].slice(0, 1000);
          return { 
            history: newHistory, 
            newSongsRecommendedCount,
            newSongsCompletedCount,
            analyticsVersion: state.analyticsVersion + 1 
          };
        });
        get().rebuildTasteProfile();
      },

      removeHistoryEntry: (id, playedAt) => {
        set((state) => ({
          history: state.history.filter((e) => !(e.id === id && e.playedAt === playedAt)),
          analyticsVersion: state.analyticsVersion + 1
        }));
        get().rebuildTasteProfile();
      },

      clearHistory: () => {
        set((state) => ({ 
          history: [], 
          analyticsVersion: state.analyticsVersion + 1 
        }));
        get().rebuildTasteProfile();
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

            // Compute consecutive skips for same artist from history
            let consecutiveSkips = 0;
            const history = state.history || [];
            for (const entry of history) {
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
        get().rebuildTasteProfile();
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
        get().rebuildTasteProfile();
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
        get().rebuildTasteProfile();
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

      rebuildTasteProfile: () => {
        set((state) => {
          const history = state.history || [];
          if (history.length === 0) return {};

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

          let totalCompleted = 0;
          let totalSkipped = 0;
          const activeHoursMap: Record<number, number> = {};

          for (const entry of history) {
            if (entry.completionRatio >= 0.9 || !entry.skipped) {
              totalCompleted++;
            }
            if (entry.skipped) {
              totalSkipped++;
            }
            const date = new Date(entry.playedAt);
            const hour = date.getHours();
            activeHoursMap[hour] = (activeHoursMap[hour] || 0) + 1;
          }

          const completionRate = history.length > 0 ? totalCompleted / history.length : 0;
          const skipRate = history.length > 0 ? totalSkipped / history.length : 0;

          const activeHours = Object.keys(activeHoursMap)
            .map(Number)
            .sort((a, b) => activeHoursMap[b] - activeHoursMap[a])
            .slice(0, 4);

          const uniqueArtists = new Set(history.map((h) => h.artist));
          const explorationScore = history.length > 0 
            ? Math.min(100, Math.round((uniqueArtists.size / history.length) * 100))
            : 50;

          const userTasteProfile: UserTasteProfile = {
            favoriteArtists: sortedArtists,
            favoriteAlbums: sortedAlbums,
            activeHours,
            completionRate,
            skipRate,
            explorationScore,
          };

          return { userTasteProfile };
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
          shownRecommendationsCount: 0,
          clickedRecommendationsCount: 0,
          completedRecommendationsCount: 0,
          newSongsRecommendedCount: 0,
          newSongsCompletedCount: 0,
          analyticsVersion: 0,
        });
      },
      setCurrentSession: (currentSession) => {
        set({ currentSession });
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
        shownRecommendationsCount: state.shownRecommendationsCount || 0,
        clickedRecommendationsCount: state.clickedRecommendationsCount || 0,
        completedRecommendationsCount: state.completedRecommendationsCount || 0,
        newSongsRecommendedCount: state.newSongsRecommendedCount || 0,
        newSongsCompletedCount: state.newSongsCompletedCount || 0,
      }),
    }
  )
);

// Memo-ready sorted selectors
export const getRecentHistory = (state: AnalyticsState) => {
  return state.history;
};

export const getContinueListeningCandidates = (state: AnalyticsState) => {
  const seen = new Set<string>();
  const list = state.history
    .filter((e) => e.positionMs >= 30000 && e.completionRatio < 0.95 && !e.skipped)
    .sort((a, b) => b.playedAt - a.playedAt);
    
  return list.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
};

export const getRecentlyPlayedCandidates = (state: AnalyticsState) => {
  const seen = new Set<string>();
  const list = state.history
    .filter((e) => {
      if (!e.trackSnapshot) return false;
      const durationMs = e.positionMs || 0;
      const isQualified = durationMs >= 15000 && e.completionRatio >= 0.05 && !e.skipped;
      return isQualified;
    })
    .sort((a, b) => b.playedAt - a.playedAt);
    
  return list.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  }).slice(0, 20);
};

export const getTopArtists = (state: AnalyticsState) => {
  return Object.keys(state.artistAffinities)
    .map((key) => ({ key, ...state.artistAffinities[key] }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.playCount - a.playCount;
    });
};

export const getTopAlbums = (state: AnalyticsState) => {
  return Object.keys(state.albumAffinities)
    .map((key) => ({ key, ...state.albumAffinities[key] }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.playCount - a.playCount;
    });
};

export const getTopTracks = (state: AnalyticsState) => {
  return Object.keys(state.trackAffinities)
    .map((key) => ({ key, ...state.trackAffinities[key] }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.playCount - a.playCount;
    });
};

// Rolling Window selectors
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
