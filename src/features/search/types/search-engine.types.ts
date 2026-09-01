export type SearchEntityType = 'SONG' | 'ARTIST' | 'ALBUM' | 'PLAYLIST' | 'VIDEO';

export interface SearchEntity {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  artistName?: string;
  artistId?: string;
  albumName?: string;
  albumId?: string;
  durationMs?: number;
  duration?: string;
  thumbnail?: string;
  browseId?: string;
  videoId?: string;
  year?: string;
  subscribers?: string;
  trackCount?: string;
  badges?: string[];
  isOfficial?: boolean;
  isExplicit?: boolean;
  sourceRank?: number;
  rawText?: string;
  versionType?: 'canonical' | 'live' | 'remix' | 'acoustic' | 'instrumental' | 'cover' | 'slowed' | 'sped_up' | 'video';
}

export type SearchIntentType =
  | 'SONG'
  | 'ARTIST'
  | 'ALBUM'
  | 'PLAYLIST'
  | 'ARTIST_SONG'
  | 'ARTIST_ALBUM'
  | 'SONG_MODIFIER'
  | 'GENRE_DISCOVERY'
  | 'MOOD_DISCOVERY'
  | 'ACTIVITY_DISCOVERY'
  | 'AMBIGUOUS';

export interface SearchIntent {
  type: SearchIntentType;
  confidence: number;
  normalizedQuery: string;
  entities?: {
    artist?: string;
    song?: string;
    album?: string;
  };
  modifiers: string[];
  discoveryTerms: string[];
}

export interface RankedSearchResult extends SearchEntity {
  score: number;
  scoreBreakdown: {
    textRelevance: number;
    intentMatch: number;
    modifierMatch: number;
    quality: number;
    personalization: number;
    penalties: number;
  };
}

export interface SectionOrdering {
  topResult: RankedSearchResult | null;
  songs: RankedSearchResult[];
  artists: RankedSearchResult[];
  albums: RankedSearchResult[];
  playlists: RankedSearchResult[];
  videos: RankedSearchResult[];
  sectionOrder: Array<'topResult' | 'songs' | 'artists' | 'albums' | 'playlists' | 'videos'>;
}

export interface UnifiedSearchResponse extends SectionOrdering {
  query: string;
  intent: SearchIntent;
  isEmpty: boolean;
  isOffline: boolean;
  latencyMs: number;
}
