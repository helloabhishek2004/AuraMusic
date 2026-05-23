/**
 * AuraMusic Playlist Type Definitions
 * schemaVersion: 1
 *
 * IMPORTANT: trackIds is the SOURCE OF TRUTH.
 * trackSnapshots are OFFLINE RESILIENCE ONLY — never primary source.
 */

import { PlayerTrack } from '@/src/features/player/types/player';

// ─── Download State Enum ──────────────────────────────────────────────────────

export type PlaylistDownloadState = 'none' | 'partial' | 'downloading' | 'downloaded';

// ─── Track Snapshot (offline fallback only) ───────────────────────────────────

/**
 * Minimal snapshot of a track's metadata.
 * Stored alongside trackIds for offline resilience ONLY.
 * Never used as the authoritative source — always prefer:
 *   1. downloadedTracks from DownloadStore (local file, most authoritative)
 *   2. Online resolution via musicService
 *   3. This snapshot as last-resort fallback
 */
export interface PlaylistTrackSnapshot {
  id: string;
  title: string;
  artist: string;
  art: string;
  duration?: number;        // ms
  isLocal?: boolean;
  albumId?: string;
  artistId?: string;
  source?: string;
  album?: string;
}

// ─── Playlist Model ───────────────────────────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  mood?: string;             // e.g. '#Chill', '#Workout'
  coverArt?: string;         // custom URI — if absent, collage is auto-generated

  // ── SOURCE OF TRUTH ──────────────────────────────────────────────────────
  trackIds: string[];        // Ordered. This is the canonical track list.

  // ── OFFLINE FALLBACK (do NOT use as primary source) ──────────────────────
  trackSnapshots?: Record<string, PlaylistTrackSnapshot>;

  // ── Metadata ──────────────────────────────────────────────────────────────
  createdAt: number;         // Unix ms
  updatedAt: number;         // Unix ms
  lastPlayedAt?: number;     // Unix ms
  pinned: boolean;
  liked: boolean;
  gradientColors: [string, string];  // Auto-derived or from dominant colors
}

// ─── Library Sort Preference ─────────────────────────────────────────────────

export type PlaylistSortBy = 'recent' | 'alphabetical' | 'mostPlayed' | 'custom';

// ─── Playback Context ─────────────────────────────────────────────────────────

/**
 * Injected into player store when playback starts from a specific source.
 * Enables: active playlist highlight, queue recovery, autoplay recommendations.
 */
export interface PlaybackContext {
  type: 'playlist' | 'album' | 'artist' | 'queue' | 'search' | 'local' | 'downloads' | 'home';
  id: string;
  name?: string;
}

// ─── Store Shape ──────────────────────────────────────────────────────────────

export interface PlaylistStoreState {
  schemaVersion: 1;
  playlists: Record<string, Playlist>;
  playlistOrder: string[];           // Custom ordering of playlist IDs
  sortBy: PlaylistSortBy;
  lastUsedPlaylistId: string | null; // For "Quick Add" shortcut
}

export interface PlaylistStoreActions {
  // CRUD
  createPlaylist(
    id: string,
    name: string,
    description?: string,
    mood?: string,
    coverArt?: string
  ): Playlist;
  deletePlaylist(id: string): void;
  renamePlaylist(id: string, name: string): void;
  updateDescription(id: string, description: string): void;
  duplicatePlaylist(id: string): string;  // returns new id
  clearPlaylist(id: string): void;

  // Track management
  addTrack(playlistId: string, track: PlayerTrack): 'added' | 'duplicate';
  addMultipleTracks(
    playlistId: string,
    tracks: PlayerTrack[]
  ): { added: number; skipped: number };
  removeTrack(playlistId: string, trackId: string): void;
  reorderTracks(playlistId: string, from: number, to: number): void;
  // ↑ ONLY mutates playlist data — NEVER touches player queue

  // Metadata
  toggleLike(id: string): void;
  togglePin(id: string): void;
  updateArtwork(id: string, uri: string): void;
  updateLastPlayed(id: string): void;
  setLastUsedPlaylist(id: string): void;
  setSortBy(sort: PlaylistSortBy): void;

  // Queries
  getPlaylistById(id: string): Playlist | undefined;
  getPlaylistsContainingTrack(trackId: string): Playlist[];
  getSortedPlaylists(): Playlist[];
  resolveTracks(playlistId: string): PlayerTrack[];
}

export type PlaylistStore = PlaylistStoreState & PlaylistStoreActions;
