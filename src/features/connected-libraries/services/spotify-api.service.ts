import { ConnectedPlaylist, ExternalTrack } from '../types/provider';
import { SpotifyAuthService } from './spotify-auth.service';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyUserProfile {
  id: string;
  displayName: string;
}

export class SpotifyApiService {
  /**
   * Authenticated request helper with automatic 401 refresh and 429 rate-limit handling
   */
  private static async request<T>(
    endpoint: string,
    retryCount = 0
  ): Promise<{ data: T | null; error?: string; status: number; isAuthExpired?: boolean }> {
    const token = await SpotifyAuthService.getValidAccessToken();
    if (!token) {
      return { data: null, error: 'Not authenticated with Spotify', status: 401, isAuthExpired: true };
    }

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      // 401 Unauthorized: token might have expired on server side
      if (response.status === 401 && retryCount === 0) {
        console.log('[SpotifyAPI] 401 received, attempting token refresh');
        const refreshed = await SpotifyAuthService.refreshAccessToken();
        if (refreshed) {
          return this.request<T>(endpoint, retryCount + 1);
        } else {
          return { data: null, error: 'Spotify session expired', status: 401, isAuthExpired: true };
        }
      }

      // 429 Rate limited
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
        console.warn(`[SpotifyAPI] Rate limited (429). Retry after ${retryAfterSec}s`);
        return {
          data: null,
          error: `Spotify API rate limit reached. Please wait ${retryAfterSec} seconds.`,
          status: 429,
        };
      }

      if (!response.ok) {
        let errorDetails = '';
        try {
          errorDetails = await response.text();
        } catch (_) {}
        console.warn(`[SpotifyAPI] Request ${url} failed with status ${response.status}: ${errorDetails}`);
        return {
          data: null,
          error: `Spotify API error (${response.status}): ${errorDetails}`,
          status: response.status,
        };
      }

      const data = (await response.json()) as T;
      return { data, status: 200 };
    } catch (err: any) {
      console.warn('[SpotifyAPI] Network failure:', err?.message || err);
      return {
        data: null,
        error: err?.message || 'Network connection failed.',
        status: 0,
      };
    }
  }

  /**
   * Fetches current user profile (GET /me)
   */
  static async getCurrentUser(): Promise<SpotifyUserProfile | null> {
    const res = await this.request<any>('/me');
    if (res.data) {
      return {
        id: res.data.id,
        displayName: res.data.display_name || res.data.id || 'Spotify User',
      };
    }
    return null;
  }

  /**
   * Fetches current user's playlists (GET /me/playlists) with pagination
   */
  static async fetchUserPlaylists(): Promise<{
    playlists: ConnectedPlaylist[];
    error?: string;
    isAuthExpired?: boolean;
  }> {
    const allPlaylists: ConnectedPlaylist[] = [];
    let nextUrl: string | null = `${SPOTIFY_API_BASE}/me/playlists?limit=50`;

    while (nextUrl) {
      const res: { data: any; error?: string; status: number; isAuthExpired?: boolean } =
        await this.request<any>(nextUrl);

      if (res.isAuthExpired) {
        return { playlists: allPlaylists, error: res.error, isAuthExpired: true };
      }

      if (!res.data || !Array.isArray(res.data.items)) {
        if (allPlaylists.length > 0) {
          // Return partial success if we already fetched some
          return { playlists: allPlaylists };
        }
        return { playlists: [], error: res.error || 'Failed to fetch playlists' };
      }

      for (const item of res.data.items) {
        if (!item || !item.id) continue;

        const coverUrl =
          item.images && item.images.length > 0 ? item.images[0].url : '';

        const trackCount =
          typeof item.tracks?.total === 'number'
            ? item.tracks.total
            : (typeof item.items?.total === 'number'
                ? item.items.total
                : (typeof item.total_tracks === 'number'
                    ? item.total_tracks
                    : (typeof item.total === 'number'
                        ? item.total
                        : (Array.isArray(item.tracks) ? item.tracks.length : 0))));

        allPlaylists.push({
          providerId: 'spotify',
          externalId: item.id,
          title: item.name || 'Untitled Playlist',
          coverUrl,
          trackCount,
          externalUrl: item.external_urls?.spotify,
          lastSyncedAt: Date.now(),
        });
      }

      nextUrl = res.data.next || null;
    }

    console.log(`[SpotifyAPI] Successfully fetched and normalized ${allPlaylists.length} playlists`);
    return { playlists: allPlaylists };
  }

  /**
   * Fetches tracks for a playlist with pagination.
   * Tries `/playlists/{id}/items` first (modern Spotify Web API endpoint),
   * falling back to `/playlists/{id}/tracks` and `GET /playlists/{id}`.
   */
  static async fetchPlaylistTracks(
    playlistId: string
  ): Promise<{ tracks: ExternalTrack[]; error?: string }> {
    const cleanId = (playlistId || '').replace(/^spotify:playlist:/, '').trim();
    if (!cleanId) {
      return { tracks: [], error: 'Invalid playlist ID' };
    }

    const allTracks: ExternalTrack[] = [];
    const seenTrackIds = new Set<string>();

    const parseSpotifyItems = (items: any[]) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        const track = item?.track || item?.item || (item?.type === 'track' ? item : null);
        if (!track || !track.id || track.is_local) continue;

        const trackId = String(track.id);
        if (seenTrackIds.has(trackId)) continue;
        seenTrackIds.add(trackId);

        const artist =
          Array.isArray(track.artists) && track.artists.length > 0
            ? track.artists.map((a: any) => a?.name).filter(Boolean).join(', ')
            : (track.artist || 'Unknown Artist');

        const artworkUrl =
          track.album?.images && track.album.images.length > 0
            ? track.album.images[0].url
            : (track.images && track.images.length > 0 ? track.images[0].url : undefined);

        allTracks.push({
          externalId: trackId,
          providerId: 'spotify',
          title: track.name || 'Unknown Title',
          artist: artist || 'Unknown Artist',
          album: track.album?.name,
          durationMs: typeof track.duration_ms === 'number' ? track.duration_ms : undefined,
          artworkUrl,
          externalUrl: track.external_urls?.spotify,
          isrc: track.external_ids?.isrc,
        });
      }
    };

    // Strategy 1: Modern Spotify Web API (February 2026+) /v1/playlists/{id}/items
    let endpointTried = `/playlists/${cleanId}/items?limit=100&additional_types=track`;
    let nextUrl: string | null = `${SPOTIFY_API_BASE}${endpointTried}`;
    let res = await this.request<any>(nextUrl);

    // Strategy 2: If /items returned 404 or 403, fallback to /v1/playlists/{id}/tracks
    if ((!res.data || !Array.isArray(res.data.items)) && (res.status === 404 || res.status === 403)) {
      console.log(`[SpotifyAPI] /items returned status ${res.status}, falling back to /tracks`);
      endpointTried = `/playlists/${cleanId}/tracks?limit=100&additional_types=track`;
      nextUrl = `${SPOTIFY_API_BASE}${endpointTried}`;
      res = await this.request<any>(nextUrl);
    }

    // Strategy 3: If still failing, fallback to GET /v1/playlists/{id} directly
    if ((!res.data || !Array.isArray(res.data.items)) && (res.status === 404 || res.status === 403)) {
      console.log(`[SpotifyAPI] /tracks returned status ${res.status}, falling back to GET /playlists/{id}`);
      const directRes = await this.request<any>(`/playlists/${cleanId}`);
      if (directRes.data) {
        const directItems =
          directRes.data.tracks?.items ||
          directRes.data.items?.items ||
          (Array.isArray(directRes.data.items) ? directRes.data.items : null);
        if (Array.isArray(directItems) && directItems.length > 0) {
          parseSpotifyItems(directItems);
          console.log(`[SpotifyAPI] Recovered ${allTracks.length} tracks via GET /playlists/{id}`);
          return { tracks: allTracks };
        }
      }
    }

    // Process pages from the working endpoint
    let pageCount = 0;
    while (nextUrl && res.data && pageCount < 20) {
      pageCount++;
      const items = Array.isArray(res.data.items)
        ? res.data.items
        : (Array.isArray(res.data.tracks?.items) ? res.data.tracks.items : []);

      if (items.length > 0) {
        parseSpotifyItems(items);
      }

      nextUrl = res.data.next || null;
      if (nextUrl) {
        res = await this.request<any>(nextUrl);
      }
    }

    console.log(`[SpotifyAPI] Fetched ${allTracks.length} tracks for playlist ${playlistId}`);
    return { tracks: allTracks };
  }
}
