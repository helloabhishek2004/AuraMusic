import { ConnectedProviderId, ProviderMeta } from '../types/provider';

export const PROVIDER_METAS: Record<ConnectedProviderId, ProviderMeta> = {
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    subtitle: 'Your playlists and saved music',
    brandColor: '#1ED760',
    brandBgColor: 'rgba(30, 215, 96, 0.15)',
    brandBorderColor: 'rgba(30, 215, 96, 0.35)',
    iconType: 'spotify',
  },
  ytmusic: {
    id: 'ytmusic',
    name: 'YouTube Music',
    subtitle: 'Your playlists and liked music',
    brandColor: '#FF0033',
    brandBgColor: 'rgba(255, 0, 51, 0.15)',
    brandBorderColor: 'rgba(255, 0, 51, 0.35)',
    iconType: 'ytmusic',
  },
  applemusic: {
    id: 'applemusic',
    name: 'Apple Music',
    subtitle: 'Your library and playlists',
    brandColor: '#FC3C44',
    brandBgColor: 'rgba(252, 60, 68, 0.15)',
    brandBorderColor: 'rgba(252, 60, 68, 0.35)',
    iconType: 'applemusic',
  },
};
