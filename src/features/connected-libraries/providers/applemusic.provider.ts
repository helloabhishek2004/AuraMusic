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

/**
 * Real Apple Music Connected Library Provider.
 * Status: PREPARED
 *
 * Architectural Boundary:
 * Apple MusicKit JS / Developer Token & Music User Token flow.
 */
export class AppleMusicProvider implements ConnectedLibraryProvider {
  readonly id: ConnectedProviderId = 'applemusic';
  readonly meta: ProviderMeta = PROVIDER_METAS.applemusic;

  async getStatus(): Promise<ConnectionStatus> {
    return 'not_connected';
  }

  async authenticate(): Promise<ProviderAuthResult> {
    return {
      success: false,
      error: 'Apple MusicKit Developer Token is required to connect Apple Music.',
    };
  }

  async disconnect(): Promise<void> {
    // Clear Apple Music user tokens
  }

  async refreshAuthentication(): Promise<ProviderAuthResult> {
    return {
      success: false,
      error: 'No active Apple Music session to refresh.',
    };
  }

  async fetchPlaylists(): Promise<ConnectedPlaylist[]> {
    return [];
  }

  async fetchPlaylistTracks(_externalPlaylistId: string): Promise<ExternalTrack[]> {
    return [];
  }

  async syncLibrary(): Promise<ConnectedPlaylist[]> {
    return [];
  }
}
