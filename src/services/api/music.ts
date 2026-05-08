import { MusicTrack } from "../../types/music";
import apiClient from "./client";

/**
 * Music Service
 * Handles all music-related API calls.
 */
export const musicService = {
  /**
   * Search for songs using the backend ytmusicapi integration.
   * @param query The search query string.
   * @returns A promise resolving to an array of MusicTrack.
   */
  searchSongs: async (query: string): Promise<MusicTrack[]> => {
    try {
      if (!query.trim()) return [];

      const response = await apiClient.get<any[]>(`/search`, {
        params: { q: query },
      });

      // Map backend fields to frontend UI expectations
      return response.data.map((item) => ({
        id: item.videoId,
        title: item.title,
        artist: item.artist,
        art: item.thumbnail,
        url: item.url,
        time: "--:--", // YTMusic search for songs doesn't always provide duration in basic search result
      }));
    } catch (error) {
      console.error("Error searching songs:", error);
      throw error;
    }
  },
};
