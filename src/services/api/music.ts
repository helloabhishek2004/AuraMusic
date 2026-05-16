import apiClient from "./client";
import { 
  SearchEntity, 
  UnifiedSearchResult, 
  getBestThumbnail 
} from "../../utils/search-utils";
import { AlbumDetails, ArtistDetails, MusicTrack } from "../../types/music";

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
    artist: item.artist || item.artists?.[0]?.name || 'Unknown',
    art: item.thumbnail || getBestThumbnail(item.thumbnails),
    duration: item.duration || '--:--',
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
    artist: song.artist,
    art: song.thumbnail,
    duration: song.duration,
    album: song.album,
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
      console.log('[Search API] Fetching for query:', query);

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
      console.log('[Search API] Raw songs count:', rawSongs.length);
      rawSongs.forEach((item: any) => {
        const mapped = mapSongResult(item);
        if (mapped) songs.push(mapped);
      });

      // Process artists
      const rawArtists: any[] = responses[1].data || [];
      console.log('[Search API] Raw artists count:', rawArtists.length);
      rawArtists.forEach((item: any) => {
        const mapped = mapArtistResult(item);
        if (mapped) artists.push(mapped);
      });

      // Process albums
      const rawAlbums: any[] = responses[2].data || [];
      console.log('[Search API] Raw albums count:', rawAlbums.length);
      rawAlbums.forEach((item: any) => {
        const mapped = mapAlbumResult(item);
        if (mapped) albums.push(mapped);
      });

      // Process playlists
      const rawPlaylists: any[] = responses[3].data || [];
      console.log('[Search API] Raw playlists count:', rawPlaylists.length);
      rawPlaylists.forEach((item: any) => {
        const mapped = mapPlaylistResult(item);
        if (mapped) playlists.push(mapped);
      });

      // Limit results
      const limitedSongs = songs.slice(0, 10);
      const limitedArtists = artists.slice(0, 6);
      const limitedAlbums = albums.slice(0, 6);
      const limitedPlaylists = playlists.slice(0, 4);

      console.log('[Search API] Mapped results:', {
        songs: limitedSongs.length,
        artists: limitedArtists.length,
        albums: limitedAlbums.length,
        playlists: limitedPlaylists.length,
      });

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

      const response = await apiClient.get(`/search`, {
        params: { q: query, type: 'artists' },
      });

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

      const response = await apiClient.get(`/search`, {
        params: { q: query, type: 'albums' },
      });

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
          console.log('[Search] Found album:', mapped.title);
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
  resolveStream: async (videoId: string): Promise<{ streamUrl: string; duration?: number }> => {
    try {
      const response = await apiClient.get(`/resolve/${videoId}`);
      return response.data;
    } catch (error) {
      console.error("Error resolving stream:", error);
      throw error;
    }
  },

  /**
   * Resolves lyrics for a track.
   */
  resolveLyrics: async (track: { id: string; title: string; artist: string; duration?: number }) => {
    try {
      const response = await apiClient.get(`/lyrics/${track.id}`, {
        params: {
          title: track.title,
          artist: track.artist,
          duration: track.duration,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error resolving lyrics:", error);
      throw error;
    }
  },
};