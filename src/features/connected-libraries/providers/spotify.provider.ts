import {
  ConnectedLibraryProvider,
  ConnectedPlaylist,
  ConnectedProviderId,
  ConnectionStatus,
  ExternalTrack,
  ProviderAuthResult,
  ProviderMeta,
} from '../types/provider';
import { PROVIDER_METAS } from './base';
import {
  SpotifyAuthService,
  getSpotifyClientId,
} from '../services/spotify-auth.service';
import { SpotifyApiService } from '../services/spotify-api.service';
import { useConnectedLibrariesStore } from '../store/connected-libraries.store';

/**
 * Real Spotify Connected Library Provider.
 * Status: IMPLEMENTED (P0 Complete Pipeline)
 *
 * Flow:
 * OAuth2 PKCE -> Spotify Callback (auramusic://auth/spotify) ->
 * Secure Keystore Token Storage -> Spotify Web API ->
 * Normalized ConnectedPlaylist -> Candidate-Scored Track Resolver ->
 * Canonical PlayerTrack -> AuraMusic Queue
 */
export class SpotifyProvider implements ConnectedLibraryProvider {
  readonly id: ConnectedProviderId = 'spotify';
  readonly meta: ProviderMeta = PROVIDER_METAS.spotify;

  isConfigured(): boolean {
    return getSpotifyClientId() !== null;
  }

  async getStatus(): Promise<ConnectionStatus> {
    const authenticated = await SpotifyAuthService.isAuthenticated();
    return authenticated ? 'connected' : 'not_connected';
  }

  async authenticate(): Promise<ProviderAuthResult> {
    const authResult = await SpotifyAuthService.authenticate();

    if (authResult.cancelled) {
      return { success: false, cancelled: true };
    }

    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error || 'Spotify authorization failed.',
      };
    }

    // Fetch user profile name
    const user = await SpotifyApiService.getCurrentUser();
    return {
      success: true,
      accountName: user?.displayName || 'Spotify User',
    };
  }

  async disconnect(): Promise<void> {
    await SpotifyAuthService.clearSession();
  }

  async refreshAuthentication(): Promise<ProviderAuthResult> {
    const refreshed = await SpotifyAuthService.refreshAccessToken();
    if (!refreshed) {
      return {
        success: false,
        error: 'Spotify session expired. Please re-authenticate.',
      };
    }
    const user = await SpotifyApiService.getCurrentUser();
    return {
      success: true,
      accountName: user?.displayName || 'Spotify User',
    };
  }

  private async enrichPlaylistTrackCounts(playlists: ConnectedPlaylist[]): Promise<void> {
    const store = useConnectedLibrariesStore.getState();
    await Promise.all(
      playlists.map(async (playlist) => {
        const cached = store.getCachedPlaylist('spotify', playlist.externalId);
        if (cached && (cached.trackCount > 0 || cached.externalTracks?.length > 0)) {
          playlist.trackCount = cached.trackCount || cached.externalTracks.length;
          return;
        }
        if (!playlist.trackCount || playlist.trackCount === 0) {
          try {
            const tracksRes = await SpotifyApiService.fetchPlaylistTracks(playlist.externalId);
            if (tracksRes.tracks.length > 0) {
              playlist.trackCount = tracksRes.tracks.length;
            }
          } catch (_) {}
        }
      })
    );
  }

  async fetchPlaylists(): Promise<ConnectedPlaylist[]> {
    const res = await SpotifyApiService.fetchUserPlaylists();
    if (res.isAuthExpired) {
      throw new Error('AUTH_EXPIRED');
    }
    await this.enrichPlaylistTrackCounts(res.playlists);
    return res.playlists;
  }

  async fetchPlaylistTracks(externalPlaylistId: string): Promise<ExternalTrack[]> {
    const res = await SpotifyApiService.fetchPlaylistTracks(externalPlaylistId);
    return res.tracks;
  }

  async syncLibrary(): Promise<ConnectedPlaylist[]> {
    const res = await SpotifyApiService.fetchUserPlaylists();
    if (res.isAuthExpired) {
      throw new Error('AUTH_EXPIRED');
    }
    if (res.error && res.playlists.length === 0) {
      throw new Error(res.error);
    }
    await this.enrichPlaylistTrackCounts(res.playlists);
    return res.playlists;
  }
}
