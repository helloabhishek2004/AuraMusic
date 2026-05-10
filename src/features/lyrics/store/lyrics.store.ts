import { create } from "zustand";
import { lyricsService } from "../services/lyrics.service";
import { LyricsData, LyricsLine, LyricsStoreState } from "../types/lyrics";

export const useLyricsStore = create<LyricsStoreState>((set, get) => ({
  // State
  lyrics: null,
  isLoading: false,
  error: null,
  
  // Current position tracking
  currentProgress: 0, // Current playback position in ms
  activeLineIndex: -1, // Index of currently active lyric line
  
  // UI state
  isFollowingPlayback: true, // Should lyrics auto-scroll with playback
  hasUserScrolled: false, // User manually scrolled, pause auto-follow
  
  // Actions
  setCurrentProgress: (progress: number) => {
    set({ currentProgress: progress });
    
    // Calculate active line based on progress
    const lyricsData = get().lyrics;
    if (!lyricsData || !lyricsData.lyrics || !lyricsData.synced) {
      return;
    }
    
    // Find the active line index by finding the last lyric before current position
    let newActiveIndex = -1;
    for (let i = lyricsData.lyrics.length - 1; i >= 0; i--) {
      if (lyricsData.lyrics[i].time <= progress) {
        newActiveIndex = i;
        break;
      }
    }
    
    set({ activeLineIndex: newActiveIndex });
  },

  resetUserScroll: () => {
    set({ hasUserScrolled: false, isFollowingPlayback: true });
  },

  setHasUserScrolled: (scrolled: boolean) => {
    set({ hasUserScrolled: scrolled, isFollowingPlayback: !scrolled });
  },

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
      
      set({
        lyrics: data,
        isLoading: false,
        activeLineIndex: -1,
        currentProgress: 0,
        hasUserScrolled: false,
        isFollowingPlayback: true,
      });
    } catch (error) {
      console.error("[Lyrics Store] Failed to fetch lyrics:", error);
      set({
        lyrics: null,
        error: error instanceof Error ? error.message : "Failed to fetch lyrics",
        isLoading: false,
        activeLineIndex: -1,
      });
    }
  },

  clearLyrics: () => {
    set({
      lyrics: null,
      error: null,
      isLoading: false,
      activeLineIndex: -1,
      currentProgress: 0,
      hasUserScrolled: false,
      isFollowingPlayback: true,
    });
  },

  getNextLyricTime: () => {
    const { lyrics, activeLineIndex } = get();
    if (!lyrics || !lyrics.lyrics || activeLineIndex < 0) return null;
    
    if (activeLineIndex + 1 < lyrics.lyrics.length) {
      return lyrics.lyrics[activeLineIndex + 1].time;
    }
    return null;
  },

  getActiveLyricLine: (): LyricsLine | null => {
    const { lyrics, activeLineIndex } = get();
    if (!lyrics || !lyrics.lyrics || activeLineIndex < 0) {
      return null;
    }
    return lyrics.lyrics[activeLineIndex] || null;
  },

  getVisibleLyricRange: (windowSize: number = 5) => {
    const { lyrics, activeLineIndex } = get();
    if (!lyrics || !lyrics.lyrics) return [];
    
    const start = Math.max(0, activeLineIndex - windowSize);
    const end = Math.min(lyrics.lyrics.length, activeLineIndex + windowSize + 1);
    
    return lyrics.lyrics.slice(start, end);
  },
}));
