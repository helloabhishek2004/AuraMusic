/**
 * Search Repository — Local-First + Online Enhancement Architecture
 * 
 * Orchestrates:
 * 1. Intent Classification
 * 2. Instant Multi-Source Local Search (Room Tracks, Downloads, Playlists, History, Likes)
 * 3. Bounded-Latency Online InnerTube Search (When connected & reachable)
 * 4. Deduplication & Local-Prioritized Merging
 * 5. Multi-Signal Local Ranking (Affinity, Exact match, Downloaded boost)
 * 6. Dynamic Section Formatting
 * 7. In-Memory Search Caching
 */

import { AuraYouTube, AuraHistory, AuraDownload, isNativeCoreAvailable } from '../../../services/native-core';
import { UnifiedSearchResponse, SearchEntity } from '../types/search-engine.types';
import { classifySearchIntent } from './search-intent';
import { deduplicateSearchResults } from './search-deduplicator';
import { rankSearchResults, formatSearchSections, PersonalizationContext } from './search-ranker';
import { useNetworkStore } from '../../network/store/network.store';

interface CacheEntry {
  response: UnifiedSearchResponse;
  timestamp: number;
}

const SEARCH_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export class SearchRepository {
  private static personalizationContext: PersonalizationContext = {
    likedTrackIds: new Set(),
    downloadedTrackIds: new Set(),
    playedTrackCounts: new Map(),
    topArtists: new Set()
  };

  /**
   * Refreshes local personalization signals from Room DB and Likes store
   */
  static async refreshPersonalization(likedIds: string[] = []): Promise<void> {
    try {
      const likedSet = new Set(likedIds);
      const dlSet = new Set<string>();
      const playCounts = new Map<string, number>();
      const topArtists = new Set<string>();

      if (isNativeCoreAvailable()) {
        if (AuraDownload) {
          const downloaded = await AuraDownload.getDownloadedTracks().catch(() => []);
          downloaded.forEach(d => dlSet.add(d.id));
        }

        if (AuraHistory) {
          const history = await AuraHistory.getHistory().catch(() => []);
          history.forEach(h => {
            const count = playCounts.get(h.trackId) || 0;
            playCounts.set(h.trackId, count + 1);
          });
        }
      }

      this.personalizationContext = {
        likedTrackIds: likedSet,
        downloadedTrackIds: dlSet,
        playedTrackCounts: playCounts,
        topArtists
      };
    } catch (e) {
      console.warn('[SearchRepository] Failed to refresh personalization:', e);
    }
  }

  /**
   * Multi-source local search across:
   * 1. Media3 DownloadCache
   * 2. Room DB User Playlists & their tracks
   * 3. Room DB Listening History
   * 4. Liked Songs Metadata
   */
  static async searchLocal(query: string): Promise<SearchEntity[]> {
    const normQ = query.trim().toLowerCase();
    if (!normQ) return [];

    const entities: SearchEntity[] = [];
    const seenIds = new Set<string>();

    // 1. Downloaded Tracks
    if (isNativeCoreAvailable() && AuraDownload) {
      try {
        const downloaded = await AuraDownload.getDownloadedTracks().catch(() => []);
        for (const d of downloaded) {
          const matchTitle = d.title?.toLowerCase().includes(normQ);
          const matchArtist = d.artist?.toLowerCase().includes(normQ);
          const matchAlbum = d.album?.toLowerCase().includes(normQ);

          if (matchTitle || matchArtist || matchAlbum) {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              entities.push({
                id: d.id,
                type: 'SONG',
                title: d.title,
                artistName: d.artist || 'Unknown Artist',
                albumName: d.album || '',
                durationMs: (d.duration || 0) * 1000,
                thumbnail: d.artworkUrl || '',
                isOfficial: true,
                sourceRank: 1, // Highest local priority
              });
            }
          }
        }
      } catch (e) {
        console.warn('[SearchRepository] Local download search error:', e);
      }
    }

    // 2. Room User Playlists & constituent tracks
    try {
      const { usePlaylistStore } = require('../../playlist/store/playlist.store');
      const playlists = usePlaylistStore.getState().playlists || [];
      for (const pl of playlists) {
        // Playlist match
        if (pl.name?.toLowerCase().includes(normQ)) {
          if (!seenIds.has(pl.id)) {
            seenIds.add(pl.id);
            entities.push({
              id: pl.id,
              type: 'PLAYLIST',
              title: pl.name,
              artistName: `${pl.trackCount || pl.tracks?.length || 0} tracks`,
              albumName: '',
              durationMs: 0,
              thumbnail: pl.customArtworkUri || '',
              isOfficial: false,
              sourceRank: 2,
            });
          }
        }

        // Search tracks inside playlist
        if (Array.isArray(pl.tracks)) {
          for (const t of pl.tracks) {
            if (!t || !t.id) continue;
            const matchTitle = t.title?.toLowerCase().includes(normQ);
            const matchArtist = t.artist?.toLowerCase().includes(normQ);
            if (matchTitle || matchArtist) {
              if (!seenIds.has(t.id)) {
                seenIds.add(t.id);
                entities.push({
                  id: t.id,
                  type: 'SONG',
                  title: t.title,
                  artistName: t.artist || 'Unknown Artist',
                  albumName: t.album || '',
                  durationMs: (t.duration || 240) * 1000,
                  thumbnail: t.art || '',
                  isOfficial: true,
                  sourceRank: 3,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[SearchRepository] Playlist search error:', e);
    }

    // 3. Listening History Tracks
    try {
      const { useAnalyticsStore } = require('../../analytics/store/analytics.store');
      const history = useAnalyticsStore.getState().history || [];
      for (const h of history) {
        const track = h.trackSnapshot || h;
        if (!track || !track.id) continue;
        const matchTitle = track.title?.toLowerCase().includes(normQ);
        const matchArtist = track.artist?.toLowerCase().includes(normQ);
        if (matchTitle || matchArtist) {
          if (!seenIds.has(track.id)) {
            seenIds.add(track.id);
            entities.push({
              id: track.id,
              type: 'SONG',
              title: track.title,
              artistName: track.artist || 'Unknown Artist',
              albumName: track.album || '',
              durationMs: (track.duration || 240) * 1000,
              thumbnail: track.art || track.artwork || '',
              isOfficial: true,
              sourceRank: 4,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[SearchRepository] History search error:', e);
    }

    // 4. Liked Songs
    try {
      const { useLikesStore } = require('../../likes/store/likes.store');
      const meta = (useLikesStore.getState().trackMetadata || {}) as Record<string, any>;
      for (const [id, t] of Object.entries(meta)) {
        if (!t) continue;
        const matchTitle = t.title?.toLowerCase().includes(normQ);
        const matchArtist = t.artist?.toLowerCase().includes(normQ);
        if (matchTitle || matchArtist) {
          if (!seenIds.has(id)) {
            seenIds.add(id);
            entities.push({
              id,
              type: 'SONG',
              title: t.title || '',
              artistName: t.artist || 'Unknown Artist',
              albumName: t.album || '',
              durationMs: (t.duration || 240) * 1000,
              thumbnail: t.art || '',
              isOfficial: true,
              sourceRank: 2,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[SearchRepository] Likes search error:', e);
    }

    return entities;
  }

  /**
   * Executes intent-aware unified search:
   * Local First -> Online InnerTube Enhancement when reachable
   */
  static async search(query: string, options?: { signal?: AbortSignal; likedIds?: string[] }): Promise<UnifiedSearchResponse> {
    const startTime = Date.now();
    const trimmed = query.trim();

    if (!trimmed) {
      return {
        query: '',
        intent: { type: 'AMBIGUOUS', confidence: 0, normalizedQuery: '', modifiers: [], discoveryTerms: [] },
        topResult: null,
        songs: [],
        artists: [],
        albums: [],
        playlists: [],
        videos: [],
        sectionOrder: ['topResult', 'songs', 'artists', 'albums', 'playlists'],
        isEmpty: true,
        isOffline: false,
        latencyMs: 0
      };
    }

    // 1. Check in-memory cache
    const cacheKey = trimmed.toLowerCase();
    const cached = SEARCH_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.response;
    }

    // 2. Classify intent
    const intent = classifySearchIntent(trimmed);

    // 3. Multi-Source Local Search (always executed first)
    const localEntities = await this.searchLocal(trimmed);

    const isOnline = useNetworkStore.getState().isOnline;
    let remoteEntities: SearchEntity[] = [];
    let isOffline = !isOnline;

    // 4. Online Enhancement via Native InnerTube (if connected & reachable)
    if (isOnline) {
      try {
        if (isNativeCoreAvailable() && AuraYouTube) {
          // Bounded 5.5-second timeout race to prevent Wi-Fi without WAN hangs
          const remotePromise = (AuraYouTube as any).searchUnified(trimmed);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('SearchTimeout')), 5500)
          );

          const rawResponse = await Promise.race([remotePromise, timeoutPromise]);
          
          if (options?.signal?.aborted) throw new Error('Aborted');

          const nativeResponse = typeof rawResponse === 'string'
            ? JSON.parse(rawResponse)
            : rawResponse;

          if (nativeResponse) {
            if (nativeResponse.topResult) {
              remoteEntities.push(nativeResponse.topResult);
            }
            if (Array.isArray(nativeResponse.songs)) remoteEntities.push(...nativeResponse.songs);
            if (Array.isArray(nativeResponse.artists)) remoteEntities.push(...nativeResponse.artists);
            if (Array.isArray(nativeResponse.albums)) remoteEntities.push(...nativeResponse.albums);
            if (Array.isArray(nativeResponse.playlists)) remoteEntities.push(...nativeResponse.playlists);
            if (Array.isArray(nativeResponse.videos)) remoteEntities.push(...nativeResponse.videos);
          }
        }
      } catch (err: any) {
        if (err.message === 'Aborted' || err.name === 'AbortError') {
          throw err;
        }
        console.warn('[SearchRepository] Remote search failed or timed out; falling back to local results:', err?.message || err);
        isOffline = true;
      }
    }

    // 5. Merge Local + Remote: Local entities have higher priority in deduplication
    const combinedEntities = [...localEntities, ...remoteEntities];

    // 6. Deduplicate
    const deduplicated = deduplicateSearchResults(combinedEntities);

    // 7. Rank with Multi-Signal Scoring
    if (options?.likedIds) {
      this.personalizationContext.likedTrackIds = new Set(options.likedIds);
    }
    const ranked = rankSearchResults(deduplicated, trimmed, intent, this.personalizationContext);

    // 8. Format Dynamic Sections
    const formatted = formatSearchSections(ranked, intent);

    const isEmpty = !formatted.topResult &&
      formatted.songs.length === 0 &&
      formatted.artists.length === 0 &&
      formatted.albums.length === 0 &&
      formatted.playlists.length === 0 &&
      formatted.videos.length === 0;

    const response: UnifiedSearchResponse = {
      query: trimmed,
      intent,
      ...formatted,
      isEmpty,
      isOffline,
      latencyMs: Date.now() - startTime
    };

    // Cache successful search responses
    if (!response.isEmpty) {
      SEARCH_CACHE.set(cacheKey, { response, timestamp: Date.now() });
    }

    return response;
  }

  /**
   * Clears in-memory search cache
   */
  static clearCache(): void {
    SEARCH_CACHE.clear();
  }
}
