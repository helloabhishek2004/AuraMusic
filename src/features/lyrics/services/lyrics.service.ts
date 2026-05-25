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
      let timeoutId: NodeJS.Timeout | null = null;
      try {
        const cleanTitle = (title || '').trim() || 'Unknown Title';
        const cleanArtist = (artist || '').trim() || 'Unknown Artist';

        const params = new URLSearchParams();
        params.append("title", cleanTitle);
        params.append("artist", cleanArtist);

        // Standardized Duration parsing - Never send bogus duration
        const parsedDuration = normalizeDuration(duration);
        if (parsedDuration !== null && parsedDuration > 0) {
          params.append("duration", parsedDuration.toString());
        }

        const url = `${this.baseUrl}/lyrics/${trackId}?${params.toString()}`;

        // 5. Diagnostics Logging
        console.log(`[Lyrics Diagnostics] Requesting lyrics:
- Title: "${cleanTitle}"
- Artist: "${cleanArtist}"
- Normalized Duration: ${parsedDuration !== null ? `${parsedDuration}s` : 'OMITTED'}
- Canonical ID: "${canonicalId}"
- Endpoint: "${url}"`);

        timeoutId = setTimeout(() => {
          console.warn(`[Lyrics Service] Timeout reached for track: ${canonicalId}`);
          controller.abort();
        }, this.requestTimeout);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`[Lyrics Service] 404 Not Found for track ${canonicalId}. Caching negative results for 1 hour.`);
            // Cache negative results temporarily (1h) to prevent API spam
            const negativeEntry = { unavailable: true, cachedAt: Date.now() };
            cacheStore.cacheLyrics(canonicalId, negativeEntry);
            return { unavailable: true, trackId } as any;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: LyricsFetchResponse = await response.json();

        // Cache successful result in central store using canonical identity
        cacheStore.cacheLyrics(canonicalId, data);
        return data;
      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);

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
    try {
      const params = new URLSearchParams();
      params.append("title", title);
      params.append("artist", artist);

      const parsedDuration = normalizeDuration(duration);
      if (parsedDuration !== null && parsedDuration > 0) {
        params.append("duration", parsedDuration.toString());
      }

      const url = `${this.baseUrl}/lyrics/search?${params.toString()}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Lyrics not found");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: LyricsFetchResponse = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
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
