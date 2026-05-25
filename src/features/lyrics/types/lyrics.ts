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
  
  // Actions
  fetchLyrics: (trackId: string, title: string, artist: string, duration?: number) => Promise<void>;
  clearLyrics: () => void;
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
