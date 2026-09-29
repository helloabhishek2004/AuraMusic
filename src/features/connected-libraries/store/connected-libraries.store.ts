import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CachedConnectedPlaylist,
  ConnectedProviderId,
  ConnectedServiceState,
  DevScenario,
  DisconnectResult,
  isYouTubeDataExpired,
  isYouTubeServiceExpired,
} from '../types/provider';
import { providerRegistry } from '../providers/registry';
import { getDevScenarioState } from '../providers/dev-mock.provider';
import { YouTubeDataCleanupService } from '../services/youtube-data-cleanup.service';


interface ConnectedLibrariesStoreState {
  services: Record<ConnectedProviderId, ConnectedServiceState>;
  devScenario: DevScenario;
  playlistCache: Record<string, CachedConnectedPlaylist>;
}

interface ConnectedLibrariesStoreActions {
  connectService: (providerId: ConnectedProviderId) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  disconnectService: (providerId: ConnectedProviderId) => Promise<DisconnectResult>;
  syncService: (providerId: ConnectedProviderId) => Promise<void>;
  reconnectService: (providerId: ConnectedProviderId) => Promise<{ success: boolean; error?: string }>;
  setDevScenario: (scenario: DevScenario) => void;
  getActiveServicesCount: () => number;
  isAnySyncing: () => boolean;
  getExpiredService: () => ConnectedServiceState | null;
  getCachedPlaylist: (providerId: ConnectedProviderId, playlistId: string) => CachedConnectedPlaylist | null;
  setCachedPlaylist: (data: CachedConnectedPlaylist) => void;
  invalidatePlaylistCache: (providerId: ConnectedProviderId, playlistId: string) => void;
  invalidateProviderPlaylistCache: (providerId: ConnectedProviderId) => void;
}

const DEFAULT_SERVICES: Record<ConnectedProviderId, ConnectedServiceState> = {
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

export const useConnectedLibrariesStore = create<
  ConnectedLibrariesStoreState & ConnectedLibrariesStoreActions
>()(
  persist(
    (set, get) => ({
      services: DEFAULT_SERVICES,
      devScenario: 'REAL',
      playlistCache: {},

      connectService: async (providerId: ConnectedProviderId) => {
        const provider = providerRegistry.get(providerId);
        if (!provider) {
          return { success: false, error: 'Unknown provider' };
        }

        // Set connecting status
        set((state) => ({
          services: {
            ...state.services,
            [providerId]: {
              ...state.services[providerId],
              status: 'connecting',
              error: undefined,
            },
          },
        }));

        const authResult = await provider.authenticate();

        if (authResult.cancelled) {
          set((state) => ({
            services: {
              ...state.services,
              [providerId]: {
                ...state.services[providerId],
                status: 'not_connected',
                error: undefined,
              },
            },
          }));
          return { success: false, cancelled: true };
        }

        if (authResult.success) {
          set((state) => ({
            services: {
              ...state.services,
              [providerId]: {
                ...state.services[providerId],
                status: 'connected',
                accountName: authResult.accountName,
                error: undefined,
              },
            },
          }));

          // Trigger library sync
          await get().syncService(providerId);
          return { success: true };
        } else {
          // Authentication was not successful; revert to not_connected with error reported
          set((state) => ({
            services: {
              ...state.services,
              [providerId]: {
                ...state.services[providerId],
                status: 'not_connected',
                error: authResult.error,
              },
            },
          }));
          return { success: false, error: authResult.error };
        }
      },

      disconnectService: async (providerId: ConnectedProviderId): Promise<DisconnectResult> => {
        const provider = providerRegistry.get(providerId);
        let disconnectResult: DisconnectResult = {
          success: true,
          remotelyRevoked: true,
          localSessionCleared: true,
        };

        if (provider) {
          try {
            disconnectResult = await provider.disconnect();
          } catch (err: any) {
            console.warn('[ConnectedLibrariesStore] Provider disconnect error:', err);
            disconnectResult = {
              success: false,
              remotelyRevoked: false,
              localSessionCleared: true,
              error: err?.message || 'Remote revocation could not be completed.',
            };
          }
        }

        if (providerId === 'ytmusic') {
          // Centralized authoritative purge for YouTube Authorized Data:
          // Purges playlists, playlistCache, and decouples downstream provenance
          YouTubeDataCleanupService.purgeAuthorizedData({ targetStatus: 'not_connected' });
        } else {
          // Clear only this provider's connection and cached playlists.
          // Local content and other providers are untouched.
          get().invalidateProviderPlaylistCache(providerId);

          set((state) => ({
            services: {
              ...state.services,
              [providerId]: {
                providerId,
                status: 'not_connected',
                displayName: state.services[providerId]?.displayName || providerId,
                playlists: [],
                lastSyncedAt: undefined,
                accountName: undefined,
                error: undefined,
              },
            },
          }));
        }

        return disconnectResult;
      },

      syncService: async (providerId: ConnectedProviderId) => {
        const provider = providerRegistry.get(providerId);
        if (!provider) return;

        set((state) => ({
          services: {
            ...state.services,
            [providerId]: {
              ...state.services[providerId],
              status: 'syncing',
            },
          },
        }));

        try {
          const playlists = await provider.syncLibrary();
          set((state) => ({
            services: {
              ...state.services,
              [providerId]: {
                ...state.services[providerId],
                status: 'connected',
                playlists,
                lastSyncedAt: Date.now(),
                error: undefined,
              },
            },
          }));
        } catch (err: any) {
          const isAuthExpired = err?.message === 'AUTH_EXPIRED';
          if (isAuthExpired && providerId === 'ytmusic') {
            // Genuine Google OAuth revocation / session expiry:
            // Under YouTube API Services Developer Policies (Section III.D & II),
            // purge all YouTube Authorized Data immediately.
            YouTubeDataCleanupService.purgeAuthorizedData({
              targetStatus: 'auth_expired',
              error: 'Google authorization expired or was revoked. Reconnect to restore your YouTube Music library.',
            });
            return;
          }

          // Non-revocation failures (network offline, HTTP 429, 5xx server errors):
          // Preserve previously synced playlists; do NOT destructively purge.
          set((state) => ({
            services: {
              ...state.services,
              [providerId]: {
                ...state.services[providerId],
                status: isAuthExpired ? 'auth_expired' : 'connected',
                error: isAuthExpired
                  ? `${state.services[providerId]?.displayName || 'Session'} expired. Reconnect to restore imported playlists.`
                  : err?.message || 'Sync failed',
              },
            },
          }));
        }
      },

      reconnectService: async (providerId: ConnectedProviderId) => {
        const provider = providerRegistry.get(providerId);
        if (!provider) {
          return { success: false, error: 'Unknown provider' };
        }

        const refreshResult = await provider.refreshAuthentication();
        if (refreshResult.success) {
          set((state) => ({
            services: {
              ...state.services,
              [providerId]: {
                ...state.services[providerId],
                status: 'connected',
                error: undefined,
              },
            },
          }));
          await get().syncService(providerId);
          return { success: true };
        } else {
          return { success: false, error: refreshResult.error };
        }
      },

      setDevScenario: (scenario: DevScenario) => {
        if (!__DEV__) return;

        if (scenario === 'REAL') {
          set({ devScenario: 'REAL' });
        } else {
          const mockServices = getDevScenarioState(scenario);
          set({
            devScenario: scenario,
            services: mockServices as Record<ConnectedProviderId, ConnectedServiceState>,
          });
        }
      },

      getActiveServicesCount: () => {
        const { services } = get();
        return Object.values(services).filter(
          (s) => s.status === 'connected' || s.status === 'syncing' || s.status === 'auth_expired'
        ).length;
      },

      isAnySyncing: () => {
        const { services } = get();
        return Object.values(services).some((s) => s.status === 'syncing');
      },

      getExpiredService: () => {
        const { services } = get();
        return Object.values(services).find((s) => s.status === 'auth_expired') || null;
      },

      getCachedPlaylist: (providerId: ConnectedProviderId, playlistId: string) => {
        const cacheKey = `${providerId}:${playlistId}`;
        const cached = get().playlistCache?.[cacheKey];
        if (providerId === 'ytmusic') {
          if (cached && isYouTubeDataExpired(cached)) {
            if (__DEV__) {
              console.log(`[ConnectedLibrariesStore] Cache entry expired under 30-day limit: ${cacheKey}`);
            }
            get().invalidatePlaylistCache(providerId, playlistId);
            return null;
          }
          const ytService = get().services?.ytmusic;
          if (ytService && isYouTubeServiceExpired(ytService)) {
            YouTubeDataCleanupService.pruneExpiredCacheEntries();
          }
        }
        return cached || null;
      },

      setCachedPlaylist: (data: CachedConnectedPlaylist) => {
        const cacheKey = data.cacheKey || `${data.providerId}:${data.playlistId}`;
        set((state) => {
          const service = state.services[data.providerId];
          const trackCount = data.trackCount || data.externalTracks?.length || 0;
          const updatedPlaylists =
            service?.playlists?.map((p) =>
              p.externalId === data.playlistId
                ? { ...p, trackCount: trackCount > 0 ? trackCount : p.trackCount }
                : p
            ) || [];

          return {
            services: service
              ? {
                  ...state.services,
                  [data.providerId]: {
                    ...service,
                    playlists: updatedPlaylists,
                  },
                }
              : state.services,
            playlistCache: {
              ...(state.playlistCache || {}),
              [cacheKey]: data,
            },
          };
        });
      },

      invalidatePlaylistCache: (providerId: ConnectedProviderId, playlistId: string) => {
        const cacheKey = `${providerId}:${playlistId}`;
        set((state) => {
          const nextCache = { ...(state.playlistCache || {}) };
          delete nextCache[cacheKey];
          return { playlistCache: nextCache };
        });
      },

      invalidateProviderPlaylistCache: (providerId: ConnectedProviderId) => {
        const prefix = `${providerId}:`;
        set((state) => {
          const nextCache: Record<string, CachedConnectedPlaylist> = {};
          for (const [key, val] of Object.entries(state.playlistCache || {})) {
            if (!key.startsWith(prefix)) {
              nextCache[key] = val;
            }
          }
          return { playlistCache: nextCache };
        });
      },
    }),
    {
      name: 'aura_connected_libraries_v1',
      storage: createJSONStorage(() => AsyncStorage),
      // In dev mode, do not persist devScenario or mock overrides
      partialize: (state) => ({
        services: state.devScenario === 'REAL' ? state.services : DEFAULT_SERVICES,
        devScenario: 'REAL' as DevScenario,
        playlistCache: state.playlistCache || {},
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          YouTubeDataCleanupService.pruneExpiredCacheEntries();
        }
      },
    }
  )
);
