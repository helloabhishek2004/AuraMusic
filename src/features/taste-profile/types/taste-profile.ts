/**
 * AuraMusic — Music Taste Profile & Preference Prior Types
 *
 * Strictly local-first, versioned, persistent music preference schema.
 * Represents musical intent, distinct from behavioral playback telemetry.
 */

export interface OnboardingArtist {
  id: string;          // YouTube Music browseId / channelId or catalog ID
  name: string;        // Artist display name
  artworkUrl?: string; // High-resolution thumbnail reference
  source: 'curated' | 'search' | 'dynamic';
}

export interface LanguageItem {
  id: string;
  name: string;
  nativeName: string;
  searchTag: string;   // Canonical query tag for music search
  suggested?: boolean; // Subtle recommendation flag based on locale
}

export interface GenreItem {
  id: string;
  name: string;
  icon: string;        // Ionicons icon identifier
  gradient: [string, string];
  searchQuery: string; // YouTube Music query for this category
  description: string;
}

export interface MusicTasteProfile {
  version: number;
  name: string;
  songLanguages: string[];
  genres: string[];
  favoriteArtists: OnboardingArtist[];
  onboardingCompleted: boolean;
  onboardingCompletedAt: number | null;
  updatedAt: number;
}

export interface PreferencePriorResult {
  artistPriorScores: Record<string, number>; // normalized artist name -> prior score
  preferredLanguages: string[];
  preferredGenres: string[];
  seedQueries: string[];
  decayFactor: number; // 1.0 (cold) down to 0.1 (mature)
}
