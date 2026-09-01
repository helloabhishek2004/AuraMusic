/**
 * Search Repository
 * Orchestrates:
 * 1. Intent Classification
 * 2. Native YouTube Music Unified Retrieval
 * 3. Offline Room DB Search Fallback
 * 4. Normalization & Deduplication
 * 5. Multi-Signal Local Ranking
 * 6. Dynamic Section Formatting
 * 7. In-Memory Search Caching
 */

import { AuraYouTube, AuraHistory, AuraDownload, isNativeCoreAvailable } from '../../../services/native-core';
import { UnifiedSearchResponse, SearchEntity } from '../types/search-engine.types';
import { classifySearchIntent } from './search-intent';
import { deduplicateSearchResults } from './search-deduplicator';
import { rankSearchResults, formatSearchSections, PersonalizationContext } from './search-ranker';

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
   * Executes intent-aware unified search
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
      console.log(`[SearchTrace] CACHE_HIT query="${trimmed}"`);
      return cached.response;
    }

    // 2. Classify intent
    const intent = classifySearchIntent(trimmed);
    console.log(`[SearchTrace] query="${trimmed}" intent=${intent.type} confidence=${intent.confidence} modifiers=[${intent.modifiers.join(',')}]`);

    let rawEntities: SearchEntity[] = [];
    let isOffline = false;

    // 3. Retrieval
    try {
      if (isNativeCoreAvailable() && AuraYouTube) {
        // Native On-Device YouTube Music Search
        const rawResponse = await (AuraYouTube as any).searchUnified(trimmed);
        
        if (options?.signal?.aborted) throw new Error('Aborted');

        const nativeResponse = typeof rawResponse === 'string'
          ? JSON.parse(rawResponse)
          : rawResponse;

        if (nativeResponse) {
          // Top Result hero if present
          if (nativeResponse.topResult) {
            rawEntities.push(nativeResponse.topResult);
          }
          if (Array.isArray(nativeResponse.songs)) rawEntities.push(...nativeResponse.songs);
          if (Array.isArray(nativeResponse.artists)) rawEntities.push(...nativeResponse.artists);
          if (Array.isArray(nativeResponse.albums)) rawEntities.push(...nativeResponse.albums);
          if (Array.isArray(nativeResponse.playlists)) rawEntities.push(...nativeResponse.playlists);
          if (Array.isArray(nativeResponse.videos)) rawEntities.push(...nativeResponse.videos);
        }
      } else {
        // Fallback for mock/test
        console.warn('[SearchRepository] NativeCore unavailable, using local fallback');
        isOffline = true;
      }
    } catch (err: any) {
      if (err.message === 'Aborted' || err.name === 'AbortError') {
        throw err;
      }
      console.warn('[SearchRepository] Network search failed, activating offline search fallback:', err);
      isOffline = true;
    }

    // 4. Offline Fallback from Room DB if rawEntities is empty or network failed
    if (rawEntities.length === 0 && isNativeCoreAvailable() && AuraDownload) {
      try {
        const downloaded = await AuraDownload.getDownloadedTracks();
        const normQ = trimmed.toLowerCase();
        downloaded.forEach(d => {
          if (d.title.toLowerCase().includes(normQ) || d.artist.toLowerCase().includes(normQ) || (d.album && d.album.toLowerCase().includes(normQ))) {
            rawEntities.push({
              id: d.id,
              type: 'SONG',
              title: d.title,
              artistName: d.artist,
              albumName: d.album || '',
              durationMs: d.duration * 1000,
              thumbnail: d.artworkUrl || '',
              isOfficial: true,
              sourceRank: 1
            });
          }
        });
        isOffline = true;
      } catch (e) {
        console.warn('[SearchRepository] Offline local retrieval error:', e);
      }
    }

    // 5. Deduplicate
    const deduplicated = deduplicateSearchResults(rawEntities);

    // 6. Rank with Multi-Signal Scoring
    if (options?.likedIds) {
      this.personalizationContext.likedTrackIds = new Set(options.likedIds);
    }
    const ranked = rankSearchResults(deduplicated, trimmed, intent, this.personalizationContext);

    // 7. Format dynamic sections
    const formatted = formatSearchSections(ranked, intent);

    const latencyMs = Date.now() - startTime;
    console.log(`[SearchTrace] query="${trimmed}" retrieved=${rawEntities.length} deduped=${deduplicated.length} ranked=${ranked.length} top=[${formatted.topResult?.type || 'NONE'}] ${formatted.topResult?.title || ''} latency=${latencyMs}ms`);

    const response: UnifiedSearchResponse = {
      query: trimmed,
      intent,
      ...formatted,
      isEmpty: ranked.length === 0,
      isOffline,
      latencyMs
    };

    // Cache valid response
    if (!response.isEmpty && !isOffline) {
      SEARCH_CACHE.set(cacheKey, { response, timestamp: Date.now() });
    }

    return response;
  }
}
