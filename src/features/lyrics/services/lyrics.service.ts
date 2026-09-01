import { LyricsFetchResponse } from "../types/lyrics";
import { BASE_URL } from "@/src/services/api/client";
import { normalizeDuration } from "@/src/utils/time";
import { getCanonicalTrackId } from "@/src/features/player/utils/track-identity";
import { useMediaCacheStore } from "@/src/features/cache/store/media-cache.store";

/**
 * Lyrics API Service
 * Handles all lyrics fetching from the backend with robust deduplication, caching,
 * diagnostics, and skip abort logic.
 */
class LyricsAPIService {
  private baseUrl: string;
  private requestTimeout: number = 30000; // 30 seconds
  private pendingRequests: Map<string, Promise<LyricsFetchResponse>> = new Map();
  private activeControllers: Map<string, AbortController> = new Map();

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch lyrics for a track from the backend.
   * Uses track metadata for matching against LRCLIB.
   */
  async fetchLyrics(
    trackId: string,
    title: string,
    artist: string,
    duration?: number | string
  ): Promise<LyricsFetchResponse> {
    const canonicalId = getCanonicalTrackId({ id: trackId, title, artist });

    // 1. Cache-First Policy
    const cacheStore = useMediaCacheStore.getState();
    const cached = cacheStore.getCachedTrack(canonicalId) || cacheStore.getCachedTrack(trackId);
    if (cached?.lyrics) {
      if (cached.lyrics.unavailable === true) {
        const NEGATIVE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
        const age = Date.now() - (cached.lyrics.cachedAt || 0);
        if (age < NEGATIVE_CACHE_TTL) {
          console.log(`[Lyrics Service] Cache hit (Negative Cache) for canonical ID: ${canonicalId}`);
          return { unavailable: true, trackId } as any;
        }
      } else {
        console.log(`[Lyrics Service] Cache hit for canonical ID: ${canonicalId}`);
        return cached.lyrics;
      }
    }

    // 2. Request Deduplication
    const existingPromise = this.pendingRequests.get(canonicalId);
    if (existingPromise) {
      console.log(`[Lyrics Service] Deduplicating concurrent request for canonical ID: ${canonicalId}`);
      return existingPromise;
    }

    // Create AbortController for this request
    const controller = new AbortController();

    // 3. Abort predecessors on skip (Abort stale requests for other tracks)
    for (const [key, oldController] of this.activeControllers.entries()) {
      if (key !== canonicalId) {
        console.log(`[Lyrics Service] Aborting stale in-flight request for track: ${key}`);
        oldController.abort();
        this.activeControllers.delete(key);
        this.pendingRequests.delete(key);
      }
    }

    this.activeControllers.set(canonicalId, controller);

    const promise = (async () => {
      try {
        const cleanTitle = (title || '').trim() || 'Unknown Title';
        const cleanArtist = (artist || '').trim() || 'Unknown Artist';

        // Standardized Duration parsing
        const parsedDuration = normalizeDuration(duration);
        const durationSec = parsedDuration !== null && parsedDuration > 0 ? parsedDuration : 0;

        console.log(`[Lyrics Service] Fetching lyrics on-device: "${cleanTitle}" - "${cleanArtist}" (${durationSec}s)`);

        const { NativeModules } = require("react-native");
        const { AuraLyricsModule } = NativeModules;

        if (AuraLyricsModule && AuraLyricsModule.fetchLyrics) {
          const data: LyricsFetchResponse = await AuraLyricsModule.fetchLyrics(
            trackId,
            cleanTitle,
            cleanArtist,
            durationSec,
            null
          );

          if (data.unavailable) {
            console.log(`[Lyrics Service] Lyrics unavailable for track ${canonicalId}. Caching negative result.`);
            const negativeEntry = { unavailable: true, cachedAt: Date.now() };
            cacheStore.cacheLyrics(canonicalId, negativeEntry);
            return { unavailable: true, trackId } as any;
          }

          console.log(`[Lyrics Service] On-device lyrics received for ${canonicalId} (source=${data.source}, synced=${data.synced}, lines=${data.lyrics?.length || 0})`);
          cacheStore.cacheLyrics(canonicalId, data);
          return data;
        } else {
          console.warn("[Lyrics Service] AuraLyricsModule is not available on this platform.");
          return { unavailable: true, trackId } as any;
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`[Lyrics Service] Request aborted for track: ${canonicalId}`);
          throw new Error("Request aborted");
        }

        console.warn(`[Lyrics Service] Fetch error for track ${canonicalId}:`, error.message || error);
        throw error;
      } finally {
        this.activeControllers.delete(canonicalId);
        this.pendingRequests.delete(canonicalId);
      }
    })();

    this.pendingRequests.set(canonicalId, promise);
    return promise;
  }

  /**
   * Search for lyrics without a specific trackId.
   */
  async searchLyrics(
    title: string,
    artist: string,
    duration?: number | string
  ): Promise<LyricsFetchResponse> {
    return this.fetchLyrics("", title, artist, duration);
  }

  /**
   * Set the base URL for the backend (useful for dynamic configuration).
   */
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Set request timeout in milliseconds.
   */
  setRequestTimeout(ms: number) {
    this.requestTimeout = ms;
  }
}

export const lyricsService = new LyricsAPIService();
