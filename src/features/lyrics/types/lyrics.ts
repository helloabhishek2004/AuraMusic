export interface LyricsLine {
  time: number; // Time in milliseconds
  text: string;
}

export interface LyricsData {
  trackId: string;
  title: string;
  artist: string;
  synced: boolean;
  confidence: number;
  lyrics: LyricsLine[];
  source: string;
}

export interface LyricsStoreState {
  // State
  lyrics: LyricsData | null;
  isLoading: boolean;
  error: string | null;
  
  // Current position tracking
  currentProgress: number;
  activeLineIndex: number;
  
  // UI state
  isFollowingPlayback: boolean;
  hasUserScrolled: boolean;
  
  // Actions
  setCurrentProgress: (progress: number) => void;
  resetUserScroll: () => void;
  setHasUserScrolled: (scrolled: boolean) => void;
  fetchLyrics: (trackId: string, title: string, artist: string, duration?: number) => Promise<void>;
  clearLyrics: () => void;
  getNextLyricTime: () => number | null;
  getActiveLyricLine: () => LyricsLine | null;
  getVisibleLyricRange: (windowSize: number) => LyricsLine[];
}

export interface LyricsFetchResponse {
  trackId: string;
  title: string;
  artist: string;
  synced: boolean;
  confidence: number;
  lyrics: LyricsLine[];
  source: string;
  lrcId?: string;
}
