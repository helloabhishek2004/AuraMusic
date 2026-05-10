import { LyricsFetchResponse } from "../types/lyrics";

/**
 * Lyrics API Service
 * Handles all lyrics fetching from the backend.
 */
class LyricsAPIService {
  private baseUrl: string;
  private requestTimeout: number = 30000; // 30 seconds

  constructor(baseUrl: string = "http://192.168.1.73:8000") {
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
    duration?: number
  ): Promise<LyricsFetchResponse> {
    try {
      const params = new URLSearchParams();
      params.append("title", title);
      params.append("artist", artist);
      if (duration !== undefined) {
        params.append("duration", duration.toString());
      }

      const url = `${this.baseUrl}/lyrics/${trackId}?${params.toString()}`;
      console.log("[Lyrics Service] Fetching lyrics from:", url);

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
          console.log("[Lyrics Service] No lyrics found for track:", title, "-", artist);
          throw new Error("Lyrics not found");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: LyricsFetchResponse = await response.json();

      console.log("[Lyrics Service] Successfully fetched lyrics:", {
        title: data.title,
        artist: data.artist,
        synced: data.synced,
        confidence: data.confidence,
        lineCount: data.lyrics.length,
      });

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        console.error("[Lyrics Service] Network error - backend may be offline");
        throw new Error("Network error: Backend unreachable");
      }
      console.error("[Lyrics Service] Error fetching lyrics:", error);
      throw error;
    }
  }

  /**
   * Search for lyrics without a specific trackId.
   * Useful for exploring what lyrics are available for a song.
   */
  async searchLyrics(
    title: string,
    artist: string,
    duration?: number
  ): Promise<LyricsFetchResponse> {
    try {
      const params = new URLSearchParams();
      params.append("title", title);
      params.append("artist", artist);
      if (duration !== undefined) {
        params.append("duration", duration.toString());
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
      console.error("[Lyrics Service] Error searching lyrics:", error);
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
