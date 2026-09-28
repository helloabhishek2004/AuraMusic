/**
 * AuraMusic V3 — Connected Libraries Types
 *
 * Source-aware external library synchronization contracts.
 * External track identities are strictly separated from canonical AuraMusic track IDs.
 */

export type ConnectedProviderId = 'spotify' | 'ytmusic' | 'applemusic';

export type ConnectionStatus =
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'auth_expired'
  | 'error';

/**
 * Normalized representation of an external track.
 * Does NOT overwrite or collide with AuraMusic canonical track IDs.
 */
export interface ExternalTrack {
  externalId: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  artworkUrl?: string;
  providerId: ConnectedProviderId;
  externalUrl?: string;
  isrc?: string;
}

/**
 * Source-aware playlist model representing an imported external collection.
 * Distinguishable from local AuraMusic playlists.
 */
export interface ConnectedPlaylist {
  providerId: ConnectedProviderId;
  externalId: string;
  title: string;
  coverUrl: string;
  trackCount: number;
  externalUrl?: string;
  lastSyncedAt?: number;
  tracks?: ExternalTrack[];
}

/**
 * Cache TTL for connected playlist tracks and metadata.
 * Fresh: < 10 minutes (render immediately, no network request)
 * Stale: >= 10 minutes (render immediately, revalidate in background)
 */
export const CONNECTED_PLAYLIST_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Persisted and normalized playlist cache model.
 * Does NOT contain access tokens, credentials, or secrets.
 */
export interface CachedConnectedPlaylist {
  cacheKey: string; // `${providerId}:${externalId}`
  playlistId: string;
  providerId: ConnectedProviderId;
  title: string;
  description?: string;
  coverUrl: string;
  trackCount: number;
  externalTracks: ExternalTrack[];
  resolvedTracks: any[]; // PlayerTrack[]
  fetchedAt: number;
  lastHydratedAt: number;
}

/**
 * Public provider presentation metadata
 */
export interface ProviderMeta {
  id: ConnectedProviderId;
  name: string;
  subtitle: string;
  brandColor: string;
  brandBgColor: string;
  brandBorderColor: string;
  iconType: 'spotify' | 'ytmusic' | 'applemusic';
}

/**
 * Persisted provider connection state stored in application state.
 * SENSITIVE TOKENS / SECRETS ARE NEVER STORED HERE.
 */
export interface ConnectedServiceState {
  providerId: ConnectedProviderId;
  status: ConnectionStatus;
  displayName: string;
  accountName?: string;
  lastSyncedAt?: number;
  error?: string;
  playlists: ConnectedPlaylist[];
}

/**
 * Authentication result contract
 */
export interface ProviderAuthResult {
  success: boolean;
  cancelled?: boolean;
  accountName?: string;
  error?: string;
}

/**
 * Provider interface contract
 */
export interface ConnectedLibraryProvider {
  readonly id: ConnectedProviderId;
  readonly meta: ProviderMeta;

  authenticate(): Promise<ProviderAuthResult>;
  disconnect(): Promise<void>;
  refreshAuthentication(): Promise<ProviderAuthResult>;
  fetchPlaylists(): Promise<ConnectedPlaylist[]>;
  fetchPlaylistTracks(externalPlaylistId: string): Promise<ExternalTrack[]>;
  syncLibrary(): Promise<ConnectedPlaylist[]>;
  getStatus(): Promise<ConnectionStatus>;
}

/**
 * Development-only visual evaluation scenarios matching the Stitch prototype
 */
export type DevScenario =
  | 'REAL'
  | 'EMPTY'
  | 'SERVICE_HUB'
  | 'SINGLE_SERVICE'
  | 'MULTI_SERVICE'
  | 'SYNCING'
  | 'AUTH_EXPIRED'
  | 'ERROR';
