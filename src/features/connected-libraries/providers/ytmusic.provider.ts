import {
  ConnectedLibraryProvider,
  ConnectedPlaylist,
  ConnectedProviderId,
  ConnectionStatus,
  DisconnectResult,
  ExternalTrack,
  ProviderAuthResult,
  ProviderMeta,
} from '../types/provider';
import { PROVIDER_METAS } from './base';
import { GoogleAuthService } from '../services/google-auth.service';
import { YouTubeApiService } from '../services/youtube-api.service';

/**
 * Real YouTube Music Connected Library Provider.
 * Status: IMPLEMENTED (Native Google Play Services Sign-In + YouTube Data API v3)
 *
 * Flow:
 * GoogleSignin (Original API) -> Native Android Play Services ->
 * Scope Verification (youtube.readonly) -> YouTube Data API (User Playlists) ->
 * Normalized ConnectedPlaylist -> Canonical Candidate-Scored Track Resolver ->
 * Canonical PlayerTrack -> AuraMusic Queue
 */
export class YouTubeMusicProvider implements ConnectedLibraryProvider {
  readonly id: ConnectedProviderId = 'ytmusic';
  readonly meta: ProviderMeta = PROVIDER_METAS.ytmusic;

  async getStatus(): Promise<ConnectionStatus> {
    const authenticated = await GoogleAuthService.isAuthenticated();
    return authenticated ? 'connected' : 'not_connected';
  }

  async authenticate(): Promise<ProviderAuthResult> {
    const authResult = await GoogleAuthService.signIn();

    if (authResult.cancelled) {
      return { success: false, cancelled: true };
    }

    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error || 'Google authorization failed.',
      };
    }

    return {
      success: true,
      accountName: authResult.accountName || 'YouTube User',
    };
  }

  async disconnect(): Promise<DisconnectResult> {
    // Revokes Google OAuth authorization on Google servers and terminates local session
    return await GoogleAuthService.revokeAccess();
  }

  async refreshAuthentication(): Promise<ProviderAuthResult> {
    const token = await GoogleAuthService.getValidAccessToken();
    if (!token) {
      return {
        success: false,
        error: 'YouTube Music session expired. Please re-authenticate.',
      };
    }

    return {
      success: true,
      accountName: 'YouTube User',
    };
  }

  async fetchPlaylists(): Promise<ConnectedPlaylist[]> {
    const res = await YouTubeApiService.fetchUserPlaylists();
    if (res.isAuthExpired) {
      throw new Error('AUTH_EXPIRED');
    }
    return res.playlists;
  }

  async fetchPlaylistTracks(externalPlaylistId: string): Promise<ExternalTrack[]> {
    const res = await YouTubeApiService.fetchPlaylistTracks(externalPlaylistId);
    if (res.isAuthExpired) {
      throw new Error('AUTH_EXPIRED');
    }
    return res.tracks;
  }

  async syncLibrary(): Promise<ConnectedPlaylist[]> {
    const res = await YouTubeApiService.fetchUserPlaylists();
    if (res.isAuthExpired) {
      throw new Error('AUTH_EXPIRED');
    }
    if (res.error && res.playlists.length === 0) {
      throw new Error(res.error);
    }
    return res.playlists;
  }
}
