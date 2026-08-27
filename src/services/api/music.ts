import { isNativeCoreAvailable, AuraYouTube } from "../native-core";
import apiClient from "./client";
import { 
  SearchEntity, 
  UnifiedSearchResult, 
  getBestThumbnail 
} from "../../utils/search-utils";
import { AlbumDetails, ArtistDetails, MusicTrack } from "../../types/music";

const streamUrlCache = new Map<string, { url: string; timestamp: number }>();
const STREAM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Map a song entity from API response
 */
function mapSongResult(item: any): SearchEntity | null {
  // Validate: songs MUST have videoId and title
  if (!item.videoId || !item.title) {
    return null;
  }
  
  // Reject if it looks like an artist or album (no duration, has browseId)
  if (item.browseId && !item.duration) {
    return null;
  }

  return {
    type: 'song',
    id: item.videoId,
    title: item.title,
    artist: Array.isArray(item.artists) && item.artists.length > 0
      ? item.artists.map((a: any) => a.name).join(', ')
      : (item.artist || 'Unknown'),
    art: item.thumbnail || getBestThumbnail(item.thumbnails),
    duration: item.duration || '--:--',
    album: item.album?.name || (typeof item.album === 'string' ? item.album : undefined),
    albumId: item.album?.id || undefined,
    source: 'ytmusic',
  };
}

/**
 * Map a backend song to MusicTrack
 */
function mapBackendSongToMusicTrack(song: any): MusicTrack {
  return {
    id: song.id || song.videoId,
    title: song.title,
    artist: Array.isArray(song.artists) && song.artists.length > 0
      ? song.artists.map((a: any) => a.name).join(', ')
      : (song.artist || 'Unknown'),
    art: song.thumbnail,
    duration: song.duration,
    album: song.album?.name || (typeof song.album === 'string' ? song.album : undefined),
    albumId: song.album?.id || song.albumId || undefined,
    source: song.source || 'ytmusic',
  };
}

/**
 * Map an artist entity from API response
 */
function mapArtistResult(item: any): SearchEntity | null {
  // Validate: artists MUST have browseId and should NOT have videoId
  if (!item.browseId && !item.channelId) {
    return null;
  }

  // Reject if it has duration (it's a song)
  if (item.duration) {
    return null;
  }

  // Reject if it has videoId (it's a song/music video)
  if (item.videoId) {
    return null;
  }

  return {
    type: 'artist',
    id: item.browseId || item.channelId,
    title: item.title,
    artist: item.title, // Artist name is the title
    art: item.thumbnail || getBestThumbnail(item.thumbnails),
    subscribers: item.subscribers || item.subscriberCount,
  };
}

/**
 * Map an album entity from API response
 */
function mapAlbumResult(item: any): SearchEntity | null {
  // Validate: albums MUST have browseId
  if (!item.browseId && !item.albumId) {
    return null;
  }

  // Reject if it has videoId (it's a song)
  if (item.videoId) {
    return null;
  }

  // Reject if it has duration (it's a track, not album metadata)
  if (item.duration && !item.year) {
    return null;
  }

  return {
    type: 'album',
    id: item.browseId || item.albumId,
    title: item.title,
    artist: item.artist || item.artistName || item.albumArtistName || 'Unknown',
    art: item.thumbnail || getBestThumbnail(item.thumbnails),
    year: item.year,
  };
}

/**
 * Map a playlist entity from API response
 */
function mapPlaylistResult(item: any): SearchEntity | null {
  if (!item.playlistId && !item.browseId) {
    return null;
  }

  return {
    type: 'playlist',
    id: item.playlistId || item.browseId,
    title: item.title,
    artist: item.author || 'Unknown',
    art: item.thumbnail || getBestThumbnail(item.thumbnails),
    trackCount: item.trackCount,
  };
}

/**
 * Music Service
 * Handles all music-related API calls.
 */
export const musicService = {
  /**
   * Unified search - fetches all entity types in parallel with proper filtering
   */
  unifiedSearch: async (query: string): Promise<UnifiedSearchResult> => {
    if (!query.trim()) {
      return { songs: [], artists: [], albums: [], playlists: [], query };
    }

    try {
      // Fetch all categories in parallel with specific type filters
      const responses = await Promise.all([
        apiClient.get(`/search`, { params: { q: query, type: 'songs' } }).catch(() => ({ data: [] })),
        apiClient.get(`/search`, { params: { q: query, type: 'artists' } }).catch(() => ({ data: [] })),
        apiClient.get(`/search`, { params: { q: query, type: 'albums' } }).catch(() => ({ data: [] })),
        apiClient.get(`/search`, { params: { q: query, type: 'playlists' } }).catch(() => ({ data: [] })),
      ]);

      // Map and filter each category with validation
      const songs: SearchEntity[] = [];
      const artists: SearchEntity[] = [];
      const albums: SearchEntity[] = [];
      const playlists: SearchEntity[] = [];

      // Process songs
      const rawSongs: any[] = responses[0].data || [];
      rawSongs.forEach((item: any) => {
        const mapped = mapSongResult(item);
        if (mapped) songs.push(mapped);
      });

      // Process artists
      const rawArtists: any[] = responses[1].data || [];
      rawArtists.forEach((item: any) => {
        const mapped = mapArtistResult(item);
        if (mapped) artists.push(mapped);
      });

      // Process albums
      const rawAlbums: any[] = responses[2].data || [];
      rawAlbums.forEach((item: any) => {
        const mapped = mapAlbumResult(item);
        if (mapped) albums.push(mapped);
      });

      // Process playlists
      const rawPlaylists: any[] = responses[3].data || [];
      rawPlaylists.forEach((item: any) => {
        const mapped = mapPlaylistResult(item);
        if (mapped) playlists.push(mapped);
      });

      // Limit results
      const limitedSongs = songs.slice(0, 10);
      const limitedArtists = artists.slice(0, 6);
      const limitedAlbums = albums.slice(0, 6);
      const limitedPlaylists = playlists.slice(0, 4);

      return {
        songs: limitedSongs,
        artists: limitedArtists,
        albums: limitedAlbums,
        playlists: limitedPlaylists,
        query,
      };
    } catch (error) {
      console.error('[Search API] Error:', error);
      return { songs: [], artists: [], albums: [], playlists: [], query };
    }
  },

  /**
   * Search for songs only
   */
  searchSongs: async (query: string): Promise<SearchEntity[]> => {
    try {
      if (!query.trim()) return [];

      const { AuraYouTube, isNativeCoreAvailable } = require('../native-core');
      if (isNativeCoreAvailable() && AuraYouTube) {
        console.log('[Search] Redirecting music.ts searchSongs to native AuraYouTube');
        const nativeTracks = await AuraYouTube.search(query);
        return nativeTracks.map((t: any) => ({
          type: 'song',
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration ? `${Math.floor(t.duration/60)}:${(t.duration%60).toString().padStart(2, '0')}` : '--:--',
          art: t.artworkUrl,
          source: 'ytmusic'
        }));
      }

      const response = await apiClient.get(`/search`, {
        params: { q: query, type: 'songs' },
      });

      return (response.data || [] as any[])
        .map(mapSongResult)
        .filter((item: any): item is SearchEntity => item !== null);
    } catch (error) {
      console.error("Error searching songs:", error);
      return [];
    }
  },

  /**
   * Search for artists
   */
  searchArtists: async (query: string): Promise<SearchEntity[]> => {
    try {
      if (!query.trim()) return [];
      if (isNativeCoreAvailable() && AuraYouTube) {
        const data = await AuraYouTube.searchArtists(query);
        return data.map((a: any) => ({
          id: a.id, title: a.title, type: 'artist', art: a.art || "", subscribers: ""
        }));
      }
      const response = await apiClient.get(`/search`, { params: { q: query, type: 'artists' } });

      return (response.data || [] as any[])
        .map(mapArtistResult)
        .filter((item: any): item is SearchEntity => item !== null);
    } catch (error) {
      console.error("Error searching artists:", error);
      return [];
    }
  },

  /**
   * Search for albums
   */
  searchAlbums: async (query: string): Promise<SearchEntity[]> => {
    try {
      if (!query.trim()) return [];
      if (isNativeCoreAvailable() && AuraYouTube) {
        const data = await AuraYouTube.searchAlbums(query);
        return data.map((a: any) => ({
          id: a.id, title: a.title, type: 'album', artist: a.artist || "", art: a.art || ""
        }));
      }
      const response = await apiClient.get(`/search`, { params: { q: query, type: 'albums' } });

      return (response.data || [] as any[])
        .map(mapAlbumResult)
        .filter((item: any): item is SearchEntity => item !== null);
    } catch (error) {
      console.error("Error searching albums:", error);
      return [];
    }
  },

  /**
   * Lookup artist by name - for contextual enrichment
   */
  lookupArtistByName: async (artistName: string): Promise<SearchEntity | null> => {
    try {
      if (!artistName.trim()) return null;

      if (isNativeCoreAvailable() && AuraYouTube) {
        const data = await AuraYouTube.searchArtists(artistName);
        if (data && data.length > 0) {
          const a = data[0];
          return { id: a.id, title: a.title, type: 'artist', artist: a.title, art: a.art || "", subscribers: "" };
        }
        return null;
      }

      const response = await apiClient.get(`/search`, {
        params: { q: artistName, type: 'artists' },
      }).catch(() => ({ data: [] }));

      const items = response.data || [];
      for (const item of items) {
        const mapped = mapArtistResult(item);
        if (mapped) {
          return mapped;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Fetches detailed artist information including top songs, albums, and related artists.
   */
  getArtistDetails: async (browseId: string): Promise<ArtistDetails | null> => {
    try {
      if (!browseId) return null;
      if (isNativeCoreAvailable() && AuraYouTube) {
        const nData = await AuraYouTube.getArtistDetails(browseId);
        if (nData) {
          return {
            id: nData.id,
            name: nData.name || nData.title,
            description: nData.description || "",
            thumbnail: nData.art || nData.thumbnail || "",
            subscribers: "",
            songs: (nData.songs || []).map((s: any) => ({
              id: s.id, title: s.title, artist: s.artist, album: s.album, duration: s.duration, art: s.artworkUrl || s.art || "", source: 'ytmusic'
            })),
            songs_params: "",
            albums: (nData.albums || []).map((a: any) => ({
              id: a.id, title: a.title, year: a.year || "", thumbnail: a.art || a.thumbnail || ""
            })),
            albums_params: "",
            singles: [],
            singles_params: "",
            related: []
          };
        }
      }
      const response = await apiClient.get(`/artist/${browseId}`);
      const data = response.data;

      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        thumbnail: data.thumbnail,
        subscribers: data.subscribers,
        songs: (data.songs || []).map((s: any) => ({
          ...mapBackendSongToMusicTrack(s),
          artistId: data.id,
          source: 'ytmusic',
        })),
        songs_params: data.songs_params,
        albums: (data.albums || []).map((album: any) => ({
          id: album.id,
          title: album.title,
          artist: album.artist,
          year: album.year,
          thumbnail: album.thumbnail,
          type: 'album',
        })),
        albums_params: data.albums_params,
        singles: (data.singles || []).map((single: any) => ({
          id: single.id,
          title: single.title,
          artist: single.artist,
          year: single.year,
          thumbnail: single.thumbnail,
          type: 'single',
        })),
        singles_params: data.singles_params,
        related: (data.related || []).map((artist: any) => ({
          id: artist.id,
          title: artist.title,
          thumbnail: artist.thumbnail,
          subscribers: artist.subscribers,
        })),
      };
    } catch (error) {
      console.error('[Music Service] Error fetching artist details:', error);
      return null;
    }
  },

  /**
   * Fetches expanded artist tracks.
   */
  getArtistSongs: async (browseId: string, params?: string): Promise<MusicTrack[]> => {
    try {
      const response = await apiClient.get(`/artist/${browseId}/songs`, {
        params: { params },
      });
      return (response.data || []).map((s: any) => ({
        ...mapBackendSongToMusicTrack(s),
        artistId: browseId,
        source: 'ytmusic',
      }));
    } catch (error) {
      console.error('[Music Service] Error fetching artist songs:', error);
      return [];
    }
  },

  /**
   * Fetches expanded artist albums or singles.
   */
  getArtistAlbums: async (browseId: string, params?: string): Promise<AlbumDetails[]> => {
    try {
      const response = await apiClient.get(`/artist/${browseId}/albums`, {
        params: { params },
      });
      return (response.data || []).map((album: any) => ({
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year,
        thumbnail: album.thumbnail,
        type: album.type || 'album',
      }));
    } catch (error) {
      console.error('[Music Service] Error fetching artist albums:', error);
      return [];
    }
  },

  /**
   * Fetches detailed album information including tracklist.
   */
  getAlbumDetails: async (browseId: string): Promise<AlbumDetails | null> => {
    try {
      if (!browseId) return null;
      if (isNativeCoreAvailable() && AuraYouTube) {
        const nData = await AuraYouTube.getAlbumDetails(browseId);
        if (nData) {
          return {
            id: nData.id,
            title: nData.title,
            artist: nData.artist || "",
            year: nData.year || "",
            thumbnail: nData.thumbnail || nData.art || "",
            tracks: (nData.tracks || nData.songs || []).map((s: any) => ({
              id: s.id, title: s.title, artist: s.artist || nData.artist || "", album: nData.title, duration: s.duration, art: s.artworkUrl || s.art || nData.thumbnail || "", source: 'ytmusic'
            }))
          };
        }
      }
      const response = await apiClient.get(`/album/${browseId}`);
      const data = response.data;

      if (!data) return null;

      return {
        id: data.id,
        title: data.title,
        artist: data.artist,
        artistId: data.artistId,
        year: data.year,
        thumbnail: data.thumbnail,
        description: data.description,
        trackCount: data.trackCount,
        duration: data.duration,
        tracks: (data.tracks || []).map((track: any) => {
          const mapped = mapBackendSongToMusicTrack(track);
          return {
            ...mapped,
            art: mapped.art || data.thumbnail, // Fallback to album thumbnail
            album: data.title,
            albumId: data.id,
            artistId: data.artistId,
            source: 'ytmusic',
          };
        }),
      };
    } catch (error) {
      console.error('[Music Service] Error fetching album details:', error);
      return null;
    }
  },

  /**
   * Lookup album by name - for contextual enrichment
   */
  lookupAlbumByName: async (albumName: string): Promise<SearchEntity | null> => {
    try {
      if (!albumName.trim()) return null;

      const response = await apiClient.get(`/search`, {
        params: { q: albumName, type: 'albums' },
      });

      const items = response.data || [];
      // Return first valid album result
      for (const item of items) {
        const mapped = mapAlbumResult(item);
        if (mapped) {
          return mapped;
        }
      }
      return null;
    } catch (error) {
      console.error('[Search] Error looking up album:', error);
      return null;
    }
  },

  /**
   * Resolves a videoId to a playable stream URL.
   */
  resolveStream: async (videoId: string, quality?: string): Promise<{ streamUrl: string; duration?: number }> => {
    // Cache key includes quality hint
    const cacheKey = `${videoId}:${quality || 'default'}`;
    const cached = streamUrlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
      return { streamUrl: cached.url };
    }

    try {
      const response = await apiClient.get(`/resolve/${videoId}`, {
          params: { quality }
      });
      const result = response.data;
      if (result.streamUrl) {
        streamUrlCache.set(cacheKey, { url: result.streamUrl, timestamp: Date.now() });
      }
      return result;
    } catch (error) {
      console.error("Error resolving stream:", error);
      throw error;
    }
  },

  /**
   * Invalidates the stream URL cache for a specific videoId.
   */
  invalidateStreamCache: (videoId: string) => {
    streamUrlCache.delete(videoId);
    console.info(`[MusicAPI] Invalidated stream URL cache for: ${videoId}`);
  },

  /**
   * Resolves lyrics for a track.
   */
  resolveLyrics: async (track: { id: string; title: string; artist: string; duration?: any }) => {
    try {
      const { lyricsService } = require("../../features/lyrics/services/lyrics.service");
      return await lyricsService.fetchLyrics(track.id, track.title, track.artist, track.duration);
    } catch (error: any) {
      const { isAbortError } = require("../../utils/logger");
      if (isAbortError(error)) {
        console.info(`[Lyrics] stale request cancelled: ${track.id}`);
      } else {
        console.warn("[MusicAPI] Error resolving lyrics through centralized service:", error.message || error);
      }
      throw error;
    }
  },

  /**
   * Fetch trending and top charts from backend.
   */
  getCharts: async (country?: string): Promise<{ trending: any[]; songs: any[]; artists: any[] }> => {
    try {
      const response = await apiClient.get(`/charts`, { params: { country } });
      return response.data || { trending: [], songs: [], artists: [] };
    } catch (error) {
      console.error('[MusicAPI] Error fetching charts:', error);
      return { trending: [], songs: [], artists: [] };
    }
  },
};