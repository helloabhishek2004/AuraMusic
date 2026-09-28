import { ConnectedPlaylist, ExternalTrack } from '../types/provider';
import { GoogleAuthService } from './google-auth.service';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeApiResponse<T> {
  data: T | null;
  error?: string;
  status: number;
  isAuthExpired?: boolean;
}

/**
 * Parses ISO 8601 duration strings (e.g. PT3M45S, PT1H2M10S) to milliseconds
 */
export function parseIsoDurationToMs(isoDuration?: string): number | undefined {
  if (!isoDuration) return undefined;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Splits an array into chunks of specified maximum size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export class YouTubeApiService {
  /**
   * Authenticated request helper with automatic 401 cache invalidation and retry
   */
  private static async request<T>(
    endpoint: string,
    retryCount = 0
  ): Promise<YouTubeApiResponse<T>> {
    const token = await GoogleAuthService.getValidAccessToken();
    if (!token) {
      return {
        data: null,
        error: 'Not authenticated with YouTube Music.',
        status: 401,
        isAuthExpired: true,
      };
    }

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${YOUTUBE_API_BASE}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      // 401 Unauthorized: token in Android cache is stale or revoked
      if (response.status === 401 && retryCount === 0) {
        if (__DEV__) {
          console.log('[YouTubeAPI] 401 received, clearing cached token and retrying');
        }
        await GoogleAuthService.clearCachedAccessToken(token);
        return this.request<T>(endpoint, retryCount + 1);
      }

      if (response.status === 401) {
        return {
          data: null,
          error: 'YouTube session expired. Please re-authenticate.',
          status: 401,
          isAuthExpired: true,
        };
      }

      if (response.status === 403) {
        const errJson = await response.json().catch(() => null);
        const reason = errJson?.error?.errors?.[0]?.reason || 'forbidden';
        if (__DEV__) {
          console.warn('[YouTubeAPI] 403 Forbidden:', reason);
        }
        return {
          data: null,
          error: `YouTube API access denied (${reason}).`,
          status: 403,
        };
      }

      if (!response.ok) {
        if (__DEV__) {
          console.warn(`[YouTubeAPI] Request failed with status ${response.status}`);
        }
        return {
          data: null,
          error: `YouTube API request failed (${response.status})`,
          status: response.status,
        };
      }

      const json = await response.json();
      return { data: json, status: response.status };
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[YouTubeAPI] Network exception:', err?.message || err);
      }
      return {
        data: null,
        error: err?.message || 'Network connection failure.',
        status: 0,
      };
    }
  }

  /**
   * Fetches user-owned playlists (playlists created by the authenticated channel)
   */
  static async fetchUserPlaylists(): Promise<{
    playlists: ConnectedPlaylist[];
    error?: string;
    isAuthExpired?: boolean;
  }> {
    const playlists: ConnectedPlaylist[] = [];
    let pageToken: string | undefined = undefined;

    try {
      do {
        const queryParams = new URLSearchParams({
          part: 'snippet,contentDetails',
          mine: 'true',
          maxResults: '50',
        });
        if (pageToken) {
          queryParams.set('pageToken', pageToken);
        }

        const res = await this.request<any>(`/playlists?${queryParams.toString()}`);
        if (res.isAuthExpired) {
          return { playlists: [], error: res.error, isAuthExpired: true };
        }
        if (res.error && playlists.length === 0) {
          return { playlists: [], error: res.error };
        }

        const items = res.data?.items || [];
        for (const item of items) {
          if (!item.id || !item.snippet) continue;

          const snippet = item.snippet;
          const contentDetails = item.contentDetails;

          const thumb =
            snippet.thumbnails?.high?.url ||
            snippet.thumbnails?.medium?.url ||
            snippet.thumbnails?.default?.url ||
            '';

          playlists.push({
            providerId: 'ytmusic',
            externalId: item.id,
            title: snippet.title || 'Untitled Playlist',
            coverUrl: thumb,
            trackCount: contentDetails?.itemCount || 0,
            externalUrl: `https://music.youtube.com/playlist?list=${item.id}`,
            lastSyncedAt: Date.now(),
          });
        }

        pageToken = res.data?.nextPageToken;
      } while (pageToken);

      return { playlists };
    } catch (err: any) {
      return { playlists, error: err?.message || 'Failed to fetch user playlists.' };
    }
  }

  /**
   * Fetches items from a specific playlist with batched video metadata for duration
   */
  static async fetchPlaylistTracks(externalPlaylistId: string): Promise<{
    tracks: ExternalTrack[];
    error?: string;
    isAuthExpired?: boolean;
  }> {
    const rawItems: any[] = [];
    let pageToken: string | undefined = undefined;

    try {
      // Step 1: Fetch all playlistItems (pages of 50)
      do {
        const queryParams = new URLSearchParams({
          part: 'snippet,contentDetails',
          playlistId: externalPlaylistId,
          maxResults: '50',
        });
        if (pageToken) {
          queryParams.set('pageToken', pageToken);
        }

        const res = await this.request<any>(`/playlistItems?${queryParams.toString()}`);
        if (res.isAuthExpired) {
          return { tracks: [], error: res.error, isAuthExpired: true };
        }
        if (res.error && rawItems.length === 0) {
          return { tracks: [], error: res.error };
        }

        const items = res.data?.items || [];
        for (const item of items) {
          const videoId =
            item.snippet?.resourceId?.videoId || item.contentDetails?.videoId;
          const title = item.snippet?.title;

          // Exclude deleted and private videos
          if (
            !videoId ||
            !title ||
            title === 'Private video' ||
            title === 'Deleted video'
          ) {
            continue;
          }

          rawItems.push(item);
        }

        pageToken = res.data?.nextPageToken;
      } while (pageToken);

      // Step 2: Batch fetch video contentDetails (durations) in chunks of up to 50
      const videoIds = rawItems.map(
        (i) => i.snippet?.resourceId?.videoId || i.contentDetails?.videoId
      );
      const chunks = chunkArray(videoIds, 50);
      const durationMap = new Map<string, number>();

      for (const batch of chunks) {
        if (batch.length === 0) continue;
        const videoRes = await this.request<any>(
          `/videos?part=contentDetails&id=${batch.join(',')}&maxResults=50`
        );
        if (videoRes.data?.items) {
          for (const v of videoRes.data.items) {
            if (v.id && v.contentDetails?.duration) {
              const ms = parseIsoDurationToMs(v.contentDetails.duration);
              if (ms !== undefined) {
                durationMap.set(v.id, ms);
              }
            }
          }
        }
      }

      // Step 3: Map to ExternalTrack with best-effort metadata
      const tracks: ExternalTrack[] = rawItems.map((item) => {
        const snippet = item.snippet;
        const videoId =
          snippet.resourceId?.videoId || item.contentDetails?.videoId;
        const thumb =
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          '';

        const artist =
          snippet.videoOwnerChannelTitle ||
          snippet.channelTitle ||
          'Unknown Artist';

        return {
          externalId: videoId,
          title: snippet.title ? snippet.title.trim() : 'Unknown Title',
          artist: artist.trim(),
          artworkUrl: thumb,
          providerId: 'ytmusic',
          durationMs: durationMap.get(videoId),
          externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      });

      return { tracks };
    } catch (err: any) {
      return { tracks: [], error: err?.message || 'Failed to fetch playlist tracks.' };
    }
  }
}
