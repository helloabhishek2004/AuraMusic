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
        time: item.duration || "--:--",
      }));
    } catch (error) {
      console.error("Error searching songs:", error);
      throw error;
    }
  },

  /**
   * Resolves a videoId to a playable stream URL.
   */
  resolveStream: async (videoId: string): Promise<{ streamUrl: string; duration?: number }> => {
    try {
      const response = await apiClient.get(`/resolve/${videoId}`);
      return response.data;
    } catch (error) {
      console.error("Error resolving stream:", error);
      throw error;
    }
  },

  /**
   * Resolves lyrics for a track.
   */
  resolveLyrics: async (track: { id: string; title: string; artist: string; duration?: number }) => {
    try {
      const response = await apiClient.get(`/lyrics/${track.id}`, {
        params: {
          title: track.title,
          artist: track.artist,
          duration: track.duration,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error resolving lyrics:", error);
      throw error;
    }
  },
};
