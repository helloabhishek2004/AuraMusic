import { create } from "zustand";
import { lyricsService } from "../services/lyrics.service";
import { LyricsStoreState } from "../types/lyrics";

export const useLyricsStore = create<LyricsStoreState>((set, get) => ({
  lyrics: null,
  isLoading: false,
  error: null,
  
  fetchLyrics: async (trackId: string, title: string, artist: string, duration?: number) => {
    set({ isLoading: true, error: null });
    
    try {
      // Check if we already have these lyrics
      const current = get().lyrics;
      if (current && current.trackId === trackId) {
        set({ isLoading: false });
        return;
      }
      
      const data = await lyricsService.fetchLyrics(trackId, title, artist, duration);
      
      // Strict active track check!
      const { usePlayerStore } = require("../../player/store/player.store");
      const { getCanonicalTrackId } = require("../../player/utils/track-identity");
      const currentActiveTrack = usePlayerStore.getState().currentTrack;
      
      if (!currentActiveTrack) {
        set({ isLoading: false });
        return;
      }
      
      const activeCanonical = getCanonicalTrackId(currentActiveTrack);
      const fetchedCanonical = getCanonicalTrackId({ id: trackId, title, artist });
      
      if (activeCanonical !== fetchedCanonical && currentActiveTrack.id !== trackId) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.warn(`[Lyrics Store] Discarding fetched lyrics for ${trackId} because active track changed to ${currentActiveTrack.id}`);
        }
        return;
      }

      if (data && (data as any).unavailable === true) {
        set({
          lyrics: null,
          isLoading: false,
          error: "Lyrics unavailable",
        });
        return;
      }

      set({
        lyrics: data,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("[Lyrics Store] Failed to fetch lyrics:", error);
      
      // Strict active track check for catch block!
      const { usePlayerStore } = require("../../player/store/player.store");
      const currentActiveTrack = usePlayerStore.getState().currentTrack;
      
      if (currentActiveTrack && currentActiveTrack.id === trackId) {
        set({
          lyrics: null,
          error: error instanceof Error ? error.message : "Failed to fetch lyrics",
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    }
  },

  clearLyrics: () => {
    set({
      lyrics: null,
      error: null,
      isLoading: false,
    });
  },
}));
