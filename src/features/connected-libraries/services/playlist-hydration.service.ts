import {
  CachedConnectedPlaylist,
  ConnectedPlaylist,
  ConnectedProviderId,
  CONNECTED_PLAYLIST_CACHE_TTL_MS,
  ExternalTrack,
} from '../types/provider';
import { providerRegistry } from '../providers/registry';
import { trackResolverService } from './track-resolver.service';
import { useConnectedLibrariesStore } from '../store/connected-libraries.store';
import { PlayerTrack } from '@/src/features/player/types/player';

export function getPlaylistCacheKey(providerId: ConnectedProviderId, playlistId: string): string {
  return `${providerId}:${playlistId}`;
}

export function isPlaylistCacheStale(cached: CachedConnectedPlaylist | null): boolean {
  if (!cached) return true;
  if (!cached.externalTracks || cached.externalTracks.length === 0) return true;
  const timestamp = cached.lastHydratedAt || cached.fetchedAt || 0;
  return Date.now() - timestamp >= CONNECTED_PLAYLIST_CACHE_TTL_MS;
}

export interface HydrateOptions {
  forceRefresh?: boolean;
}

export interface HydrationResult {
  success: boolean;
  cachedPlaylist: CachedConnectedPlaylist | null;
  fromCache: boolean;
  error?: string;
}

// In-flight deduplication map: key -> Promise<HydrationResult>
const inFlightHydrations = new Map<string, Promise<HydrationResult>>();

/**
 * Hydrates a connected playlist following stale-while-revalidate pattern:
 * 1. Checks memory/persisted cache.
 * 2. Deduplicates concurrent requests for the same playlist.
 * 3. Fetches fresh external tracks from provider.
 * 4. Resolves playable tracks (reusing resolved tracks if track list didn't change).
 * 5. Updates cache and notifies store.
 * 6. Preserves existing cache on error.
 */
export async function hydrateConnectedPlaylist(
  playlist: ConnectedPlaylist,
  options: HydrateOptions = {}
): Promise<HydrationResult> {
  const { forceRefresh = false } = options;
  const cacheKey = getPlaylistCacheKey(playlist.providerId, playlist.externalId);
  const store = useConnectedLibrariesStore.getState();
  const existingCached = store.getCachedPlaylist(playlist.providerId, playlist.externalId);

  // If cache is fresh and not forced, return immediately
  if (!forceRefresh && existingCached && !isPlaylistCacheStale(existingCached)) {
    return {
      success: true,
      cachedPlaylist: existingCached,
      fromCache: true,
    };
  }

  // Deduplicate in-flight requests
  const existingPromise = inFlightHydrations.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const hydrationPromise = (async (): Promise<HydrationResult> => {
    try {
      const provider = providerRegistry.get(playlist.providerId);
      if (!provider) {
        throw new Error(`Provider ${playlist.providerId} is not available.`);
      }

      // Fetch fresh external tracks from the provider
      const freshExternalTracks = await provider.fetchPlaylistTracks(playlist.externalId);

      // Check if external tracks are identical to existing cached tracks
      let resolvedTracks: PlayerTrack[] = [];
      const hasSameTracks =
        existingCached?.resolvedTracks?.length &&
        existingCached.externalTracks?.length === freshExternalTracks.length &&
        existingCached.externalTracks.every(
          (t, idx) => t.externalId === freshExternalTracks[idx]?.externalId
        );

      if (hasSameTracks && existingCached) {
        // Reuse already resolved tracks
        resolvedTracks = existingCached.resolvedTracks;
      } else if (freshExternalTracks.length > 0) {
        // Resolve tracks with canonical trackResolverService
        resolvedTracks = await trackResolverService.resolvePlaylistTracks(freshExternalTracks);
      }

      const updatedCache: CachedConnectedPlaylist = {
        cacheKey,
        playlistId: playlist.externalId,
        providerId: playlist.providerId,
        title: playlist.title,
        coverUrl: playlist.coverUrl,
        trackCount: freshExternalTracks.length,
        externalTracks: freshExternalTracks,
        resolvedTracks,
        fetchedAt: existingCached?.fetchedAt || Date.now(),
        lastHydratedAt: Date.now(),
      };

      store.setCachedPlaylist(updatedCache);

      return {
        success: true,
        cachedPlaylist: updatedCache,
        fromCache: false,
      };
    } catch (err: any) {
      console.warn(`[PlaylistHydration] Failed to hydrate ${cacheKey}:`, err);
      // Return existing cached data if available (graceful degradation)
      return {
        success: false,
        cachedPlaylist: existingCached || null,
        fromCache: true,
        error: err?.message || 'Failed to refresh playlist',
      };
    } finally {
      inFlightHydrations.delete(cacheKey);
    }
  })();

  inFlightHydrations.set(cacheKey, hydrationPromise);
  return hydrationPromise;
}
