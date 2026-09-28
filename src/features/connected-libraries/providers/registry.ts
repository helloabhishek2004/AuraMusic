import { ConnectedLibraryProvider, ConnectedProviderId } from '../types/provider';
import { SpotifyProvider } from './spotify.provider';
import { YouTubeMusicProvider } from './ytmusic.provider';
import { AppleMusicProvider } from './applemusic.provider';

class ProviderRegistry {
  private providers: Map<ConnectedProviderId, ConnectedLibraryProvider> = new Map();

  constructor() {
    this.providers.set('spotify', new SpotifyProvider());
    this.providers.set('ytmusic', new YouTubeMusicProvider());
    this.providers.set('applemusic', new AppleMusicProvider());
  }

  get(id: ConnectedProviderId): ConnectedLibraryProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): ConnectedLibraryProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
