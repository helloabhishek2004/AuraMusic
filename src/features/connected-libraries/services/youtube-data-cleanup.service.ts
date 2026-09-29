/**
 * YouTube Data Cleanup Service
 *
 * Centralized, authoritative lifecycle contract for YouTube Authorized Data.
 * Enforces YouTube API Services Developer Policies (Section III.D & Section II):
 * 1. Purges all YouTube Authorized Data (playlists, cached tracks, account name)
 *    upon in-app disconnect or remote Google Security Settings revocation.
 * 2. Prunes cached Authorized Data older than 30 calendar days.
 * 3. Decouples downstream user preferences (likes, offline downloads) so unrelated
 *    user data remains intact while removing YouTube library provenance.
 * 4. Idempotent and safe to invoke repeatedly or after partial failure.
 */

import { ConnectionStatus, YOUTUBE_API_DATA_MAX_CACHE_TTL_MS } from '../types/provider';

export interface PurgeOptions {
  targetStatus?: ConnectionStatus;
  error?: string;
}

export class YouTubeDataCleanupService {
  /**
   * Authoritatively purges all YouTube Authorized Data from application stores.
   * Executed during in-app disconnect and upon genuine Google auth revocation (AUTH_EXPIRED).
   */
  static purgeAuthorizedData(options: PurgeOptions = {}): void {
    const { targetStatus = 'not_connected', error } = options;

    if (__DEV__) {
      console.log(`[YouTubeDataCleanup] Starting Authorized Data purge (targetStatus: ${targetStatus})...`);
    }

    try {
      // 1. Purge from Connected Libraries Store (AsyncStorage)
      const { useConnectedLibrariesStore } = require('../store/connected-libraries.store');
      const store = useConnectedLibrariesStore.getState();

      // Collect known YouTube playlist IDs before clearing state
      const ytPlaylistIds = new Set<string>();
      const ytService = store.services?.ytmusic;
      if (ytService?.playlists && Array.isArray(ytService.playlists)) {
        for (const pl of ytService.playlists) {
          if (pl.externalId) {
            ytPlaylistIds.add(pl.externalId);
          }
        }
      }

      // Invalidate all cached playlists belonging to ytmusic
      store.invalidateProviderPlaylistCache('ytmusic');

      // Reset the ytmusic service state to empty
      useConnectedLibrariesStore.setState((state: any) => ({
        services: {
          ...state.services,
          ytmusic: {
            providerId: 'ytmusic',
            status: targetStatus,
            displayName: state.services?.ytmusic?.displayName || 'YouTube Music',
            playlists: [],
            lastSyncedAt: undefined,
            accountName: undefined,
            error: error !== undefined ? error : undefined,
          },
        },
      }));

      // 2. Decouple downstream Likes provenance
      try {
        const { useLikesStore } = require('@/src/features/likes/store/likes.store');
        const likesStore = useLikesStore.getState();
        const currentMeta = likesStore.trackMetadata || {};
        let modifiedLikes = false;
        const nextMeta = { ...currentMeta };

        for (const [trackId, meta] of Object.entries(currentMeta)) {
          if ((meta as any)?.source === 'ytmusic_imported') {
            nextMeta[trackId] = {
              ...(meta as Record<string, any>),
              source: 'ytmusic', // Decouple from connected library to general public source
            };
            modifiedLikes = true;
          }
        }

        if (modifiedLikes) {
          useLikesStore.setState({ trackMetadata: nextMeta });
          if (__DEV__) {
            console.log('[YouTubeDataCleanup] Decoupled ytmusic_imported provenance from liked tracks');
          }
        }
      } catch (likesErr) {
        if (__DEV__) {
          console.warn('[YouTubeDataCleanup] Non-fatal error during likes decoupling:', likesErr);
        }
      }

      // 3. Decouple downstream Downloads provenance
      try {
        const { useDownloadStore } = require('@/src/features/download/store/download.store');
        const downloadStore = useDownloadStore.getState();
        const dlTracks = downloadStore.downloadedTracks || {};
        let modifiedDownloads = false;
        const nextDlTracks = { ...dlTracks };

        for (const [trackId, dl] of Object.entries(dlTracks)) {
          if ((dl as any)?.source === 'ytmusic_imported') {
            nextDlTracks[trackId] = {
              ...(dl as Record<string, any>),
              source: 'ytmusic', // Decouple from connected library to general public source
            };
            modifiedDownloads = true;
          }
        }

        if (modifiedDownloads) {
          useDownloadStore.setState({ downloadedTracks: nextDlTracks });
          if (__DEV__) {
            console.log('[YouTubeDataCleanup] Decoupled ytmusic_imported provenance from downloaded tracks');
          }
        }
      } catch (dlErr) {
        if (__DEV__) {
          console.warn('[YouTubeDataCleanup] Non-fatal error during downloads decoupling:', dlErr);
        }
      }

      // 4. Sanitize Analytics History: Decouple provenance & purge authorized playlist context
      try {
        const { useAnalyticsStore } = require('@/src/features/analytics/store/analytics.store');
        const analyticsStore = useAnalyticsStore.getState();
        const history = analyticsStore.history || [];
        let modifiedHistory = false;

        const nextHistory = history.map((entry: any) => {
          let entryModified = false;
          let nextTrackSnapshot = entry.trackSnapshot;
          let nextSourceContext = entry.sourceContext;

          // Decouple trackSnapshot source if it was imported from ytmusic
          if (entry.trackSnapshot?.source === 'ytmusic_imported') {
            nextTrackSnapshot = {
              ...entry.trackSnapshot,
              source: 'ytmusic', // Decouple from connected library to general public source
            };
            entryModified = true;
          }

          // Check if sourceContext was an authorized YouTube playlist
          const isYtPlaylistContext =
            entry.trackSnapshot?.source === 'ytmusic_imported' ||
            (entry.sourceContext?.type === 'playlist' &&
              ((entry.sourceContext?.id && ytPlaylistIds.has(entry.sourceContext.id)) ||
                entry.sourceContext?.id?.startsWith('PL') ||
                entry.sourceContext?.id?.startsWith('RD') ||
                entry.sourceContext?.id?.startsWith('UU') ||
                entry.sourceContext?.id?.startsWith('LL') ||
                entry.sourceContext?.id?.startsWith('FL') ||
                entry.sourceContext?.id?.startsWith('ytmusic:')));

          if (entry.sourceContext && (isYtPlaylistContext || entry.trackSnapshot?.source === 'ytmusic_imported')) {
            if (entry.sourceContext.id || entry.sourceContext.title) {
              nextSourceContext = {
                ...entry.sourceContext,
                id: undefined,
                title: undefined,
              };
              entryModified = true;
            }
          }

          if (entryModified) {
            modifiedHistory = true;
            return {
              ...entry,
              trackSnapshot: nextTrackSnapshot,
              sourceContext: nextSourceContext,
            };
          }

          return entry;
        });

        if (modifiedHistory) {
          useAnalyticsStore.setState({ history: nextHistory });
          if (typeof analyticsStore.rebuildComputedCollections === 'function') {
            analyticsStore.rebuildComputedCollections();
          }
          if (__DEV__) {
            console.log('[YouTubeDataCleanup] Sanitized analytics history and decoupled ytmusic_imported provenance');
          }
        }
      } catch (analyticsErr) {
        if (__DEV__) {
          console.warn('[YouTubeDataCleanup] Non-fatal error during analytics history sanitization:', analyticsErr);
        }
      }

      if (__DEV__) {
        console.log('[YouTubeDataCleanup] Authorized Data purge successfully completed.');
      }
    } catch (err) {
      console.error('[YouTubeDataCleanup] Critical error during Authorized Data purge:', err);
    }
  }

  /**
   * Deterministically prunes cached YouTube playlist entries and summaries older than 30 calendar days.
   * Required by YouTube API Services Developer Policies Section III.D:
   * "You must not store YouTube API Data for more than 30 calendar days without refreshing..."
   * Can be called during app startup, rehydration, or periodic cache maintenance.
   */
  static pruneExpiredCacheEntries(): number {
    try {
      const { useConnectedLibrariesStore } = require('../store/connected-libraries.store');
      const store = useConnectedLibrariesStore.getState();
      const cache = store.playlistCache || {};
      const now = Date.now();
      let prunedCount = 0;

      // 1. Prune cached detailed playlist entries (>30 days)
      const nextCache: Record<string, any> = {};

      for (const [key, val] of Object.entries(cache)) {
        if (key.startsWith('ytmusic:')) {
          const timestamp = (val as any).lastHydratedAt || (val as any).fetchedAt || 0;
          if (timestamp > 0 && now - timestamp >= YOUTUBE_API_DATA_MAX_CACHE_TTL_MS) {
            prunedCount++;
            if (__DEV__) {
              console.log(`[YouTubeDataCleanup] Pruning expired 30-day cache entry: ${key}`);
            }
            continue; // Evict expired entry
          }
        }
        nextCache[key] = val;
      }

      if (prunedCount > 0) {
        useConnectedLibrariesStore.setState({ playlistCache: nextCache });
        if (__DEV__) {
          console.log(`[YouTubeDataCleanup] Pruned ${prunedCount} expired YouTube cache entries (>30 days)`);
        }
      }

      // 2. Prune playlist summaries from services.ytmusic.playlists (>30 days)
      const ytService = store.services?.ytmusic;
      if (ytService && ytService.playlists && ytService.playlists.length > 0) {
        const lastSyncedAt = ytService.lastSyncedAt || 0;
        if (lastSyncedAt > 0 && now - lastSyncedAt >= YOUTUBE_API_DATA_MAX_CACHE_TTL_MS) {
          useConnectedLibrariesStore.setState((state: any) => ({
            services: {
              ...state.services,
              ytmusic: {
                ...state.services?.ytmusic,
                playlists: [],
                lastSyncedAt: undefined,
              },
            },
          }));
          if (__DEV__) {
            console.log(
              `[YouTubeDataCleanup] Pruned ${ytService.playlists.length} expired YouTube playlist summaries (>30 days)`
            );
          }
          prunedCount += ytService.playlists.length;
        }
      }

      return prunedCount;
    } catch (err) {
      console.warn('[YouTubeDataCleanup] Error pruning expired cache entries:', err);
      return 0;
    }
  }
}
