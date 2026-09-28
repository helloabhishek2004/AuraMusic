import {
  ConnectedPlaylist,
  ConnectedServiceState,
  DevScenario,
  ExternalTrack,
} from '../types/provider';

/**
 * Isolated development-only fixtures matching the Stitch design
 * ("Connected Libraries - AuraMusic V3 Mobile", Stitch ID: b1eb2688099a40939beacfad37f22543).
 *
 * Gated strictly behind __DEV__.
 * Never used in production.
 */

const SPOTIFY_MOCK_PLAYLISTS: ConnectedPlaylist[] = [
  {
    providerId: 'spotify',
    externalId: 'sp-pl-01',
    title: 'Night Drive',
    trackCount: 42,
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
    externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM',
    lastSyncedAt: Date.now() - 3600000,
    tracks: [
      {
        externalId: 'sp-tr-01',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        durationMs: 200000,
        providerId: 'spotify',
        artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
      },
      {
        externalId: 'sp-tr-02',
        title: 'Starboy',
        artist: 'The Weeknd, Daft Punk',
        album: 'Starboy',
        durationMs: 230000,
        providerId: 'spotify',
        artworkUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
      },
    ],
  },
  {
    providerId: 'spotify',
    externalId: 'sp-pl-02',
    title: 'Workout Energy',
    trackCount: 68,
    coverUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80',
    externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP',
    lastSyncedAt: Date.now() - 7200000,
    tracks: [
      {
        externalId: 'sp-tr-03',
        title: 'Stronger',
        artist: 'Kanye West',
        album: 'Graduation',
        durationMs: 311000,
        providerId: 'spotify',
      },
    ],
  },
  {
    providerId: 'spotify',
    externalId: 'sp-pl-03',
    title: 'Starred Favorites',
    trackCount: 114,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    externalUrl: 'https://open.spotify.com/collection/tracks',
    lastSyncedAt: Date.now() - 1800000,
    tracks: [
      {
        externalId: 'sp-tr-04',
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up, We\'re Dreaming',
        durationMs: 243000,
        providerId: 'spotify',
      },
    ],
  },
];

const YTMUSIC_MOCK_PLAYLISTS: ConnectedPlaylist[] = [
  {
    providerId: 'ytmusic',
    externalId: 'yt-pl-01',
    title: 'Cosmic Mix',
    trackCount: 50,
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80',
    externalUrl: 'https://music.youtube.com/playlist?list=RDCLAK5uy_k',
    lastSyncedAt: Date.now() - 14400000,
    tracks: [
      {
        externalId: 'yt-tr-01',
        title: 'Resonance',
        artist: 'HOME',
        album: 'Odyssey',
        durationMs: 212000,
        providerId: 'ytmusic',
      },
    ],
  },
  {
    providerId: 'ytmusic',
    externalId: 'yt-pl-02',
    title: 'Road Trip Synth',
    trackCount: 36,
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80',
    externalUrl: 'https://music.youtube.com/playlist?list=RDCLAK5uy_l',
    lastSyncedAt: Date.now() - 28800000,
    tracks: [
      {
        externalId: 'yt-tr-02',
        title: 'Days of Thunder',
        artist: 'The Midnight',
        album: 'Days of Thunder',
        durationMs: 329000,
        providerId: 'ytmusic',
      },
    ],
  },
];

const APPLEMUSIC_MOCK_PLAYLISTS: ConnectedPlaylist[] = [
  {
    providerId: 'applemusic',
    externalId: 'am-pl-01',
    title: 'Ambient Focus',
    trackCount: 28,
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
    externalUrl: 'https://music.apple.com/playlist/ambient-focus',
    lastSyncedAt: Date.now() - 86400000,
    tracks: [
      {
        externalId: 'am-tr-01',
        title: 'Weightless',
        artist: 'Marconi Union',
        album: 'Weightless',
        durationMs: 480000,
        providerId: 'applemusic',
      },
    ],
  },
];

export function getDevScenarioState(scenario: DevScenario): Record<string, ConnectedServiceState> {
  const base: Record<string, ConnectedServiceState> = {
    spotify: {
      providerId: 'spotify',
      status: 'not_connected',
      displayName: 'Spotify',
      playlists: [],
    },
    ytmusic: {
      providerId: 'ytmusic',
      status: 'not_connected',
      displayName: 'YouTube Music',
      playlists: [],
    },
    applemusic: {
      providerId: 'applemusic',
      status: 'not_connected',
      displayName: 'Apple Music',
      playlists: [],
    },
  };

  switch (scenario) {
    case 'EMPTY':
    case 'SERVICE_HUB':
      return base;

    case 'SINGLE_SERVICE':
      return {
        ...base,
        spotify: {
          providerId: 'spotify',
          status: 'connected',
          displayName: 'Spotify',
          accountName: 'Spotify User',
          lastSyncedAt: Date.now() - 120000,
          playlists: SPOTIFY_MOCK_PLAYLISTS,
        },
      };

    case 'MULTI_SERVICE':
      return {
        spotify: {
          providerId: 'spotify',
          status: 'connected',
          displayName: 'Spotify',
          accountName: 'Spotify User',
          lastSyncedAt: Date.now() - 60000,
          playlists: SPOTIFY_MOCK_PLAYLISTS,
        },
        ytmusic: {
          providerId: 'ytmusic',
          status: 'connected',
          displayName: 'YouTube Music',
          accountName: 'Google Music Account',
          lastSyncedAt: Date.now() - 300000,
          playlists: YTMUSIC_MOCK_PLAYLISTS,
        },
        applemusic: {
          providerId: 'applemusic',
          status: 'connected',
          displayName: 'Apple Music',
          accountName: 'Apple ID',
          lastSyncedAt: Date.now() - 1800000,
          playlists: APPLEMUSIC_MOCK_PLAYLISTS,
        },
      };

    case 'SYNCING':
      return {
        spotify: {
          providerId: 'spotify',
          status: 'syncing',
          displayName: 'Spotify',
          accountName: 'Spotify User',
          lastSyncedAt: Date.now(),
          playlists: SPOTIFY_MOCK_PLAYLISTS,
        },
        ytmusic: {
          providerId: 'ytmusic',
          status: 'syncing',
          displayName: 'YouTube Music',
          accountName: 'Google Music Account',
          lastSyncedAt: Date.now(),
          playlists: YTMUSIC_MOCK_PLAYLISTS,
        },
        applemusic: {
          providerId: 'applemusic',
          status: 'connected',
          displayName: 'Apple Music',
          accountName: 'Apple ID',
          lastSyncedAt: Date.now() - 1800000,
          playlists: APPLEMUSIC_MOCK_PLAYLISTS,
        },
      };

    case 'AUTH_EXPIRED':
      return {
        spotify: {
          providerId: 'spotify',
          status: 'auth_expired',
          displayName: 'Spotify',
          accountName: 'Spotify User',
          error: 'Spotify session expired. Reconnect to restore 3 imported playlists.',
          lastSyncedAt: Date.now() - 86400000 * 2,
          playlists: SPOTIFY_MOCK_PLAYLISTS,
        },
        ytmusic: {
          providerId: 'ytmusic',
          status: 'connected',
          displayName: 'YouTube Music',
          accountName: 'Google Music Account',
          lastSyncedAt: Date.now() - 300000,
          playlists: YTMUSIC_MOCK_PLAYLISTS,
        },
        applemusic: {
          providerId: 'applemusic',
          status: 'connected',
          displayName: 'Apple Music',
          accountName: 'Apple ID',
          lastSyncedAt: Date.now() - 1800000,
          playlists: APPLEMUSIC_MOCK_PLAYLISTS,
        },
      };

    case 'ERROR':
      return {
        ...base,
        spotify: {
          providerId: 'spotify',
          status: 'error',
          displayName: 'Spotify',
          error: 'Network timeout connecting to Spotify API.',
          playlists: [],
        },
      };

    default:
      return base;
  }
}
