import { isNativeCoreAvailable, AuraYouTube } from "../native-core";
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
      if (isNativeCoreAvailable() && AuraYouTube && typeof AuraYouTube.searchUnified === 'function') {
        const nativeResult = await AuraYouTube.searchUnified(query);
        if (nativeResult) {
          const songs: SearchEntity[] = (nativeResult.songs || []).map((t: any) => ({
            type: 'song' as const,
            id: t.id,
            title: t.title,
            artist: t.artistName || t.artist || 'Unknown Artist',
            art: t.thumbnail || t.artworkUrl || '',
            duration: t.duration || '--:--',
            album: t.albumName || t.album || undefined,
            albumId: t.albumId || undefined,
            source: 'ytmusic' as const,
          }));

          const artists: SearchEntity[] = (nativeResult.artists || []).map((a: any) => ({
            type: 'artist' as const,
            id: a.id || a.browseId,
            title: a.title || a.name || 'Unknown Artist',
            artist: a.title || a.name || 'Unknown Artist',
            art: a.thumbnail || a.art || '',
            subscribers: a.subscribers || '',
          }));

          const albums: SearchEntity[] = (nativeResult.albums || []).map((al: any) => ({
            type: 'album' as const,
            id: al.id || al.browseId,
            title: al.title || 'Unknown Album',
            artist: al.artistName || al.artist || 'Unknown Artist',
            art: al.thumbnail || al.art || '',
            year: al.year || '',
          }));

          const playlists: SearchEntity[] = (nativeResult.playlists || []).map((pl: any) => ({
            type: 'playlist' as const,
            id: pl.id || pl.browseId,
            title: pl.title || 'Playlist',
            artist: pl.artistName || pl.author || 'Unknown',
            art: pl.thumbnail || pl.art || '',
            trackCount: pl.trackCount || '',
          }));

          return {
            songs: songs.slice(0, 10),
            artists: artists.slice(0, 6),
            albums: albums.slice(0, 6),
            playlists: playlists.slice(0, 4),
            query,
          };
        }
      }

      return {
        songs: [],
        artists: [],
        albums: [],
        playlists: [],
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

      return [];
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
      return [];
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
      return [];
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
      let targetId = browseId;
      if (isNativeCoreAvailable() && AuraYouTube) {
        const nData = await AuraYouTube.getArtistDetails(targetId);
        if (nData) {
          let songs = (nData.songs || []).map((s: any) => ({
            id: s.id, title: s.title, artist: s.artist || nData.name || "", album: s.album || "", duration: s.duration, art: s.artworkUrl || s.art || nData.art || "", source: 'ytmusic'
          }));
          let albums = (nData.albums || []).map((a: any) => ({
            id: a.id, title: a.title, year: a.year || "", thumbnail: a.art || a.thumbnail || ""
          }));

          // If songs are empty from channel tabs, supplement with top songs search
          if (songs.length === 0 && (nData.name || targetId)) {
            try {
              const searchedSongs = await AuraYouTube.search(nData.name || targetId);
              if (Array.isArray(searchedSongs) && searchedSongs.length > 0) {
                songs = searchedSongs.slice(0, 15).map((s: any) => ({
                  id: s.id,
                  title: s.title,
                  artist: s.artistName || s.artist || nData.name || "",
                  album: s.albumName || s.album || "",
                  duration: s.duration || (s.durationMs ? Math.floor(s.durationMs / 1000) : 240),
                  art: s.thumbnail || s.art || nData.art || "",
                  source: 'ytmusic'
                }));
              }
            } catch (e) {
              console.warn('[Music Service] Supplement songs failed:', e);
            }
          }

          // If albums are empty from channel tabs, supplement with albums search
          if (albums.length === 0 && (nData.name || targetId)) {
            try {
              const searchedAlbums = await AuraYouTube.searchAlbums(nData.name || targetId);
              if (Array.isArray(searchedAlbums) && searchedAlbums.length > 0) {
                albums = searchedAlbums.slice(0, 10).map((a: any) => ({
                  id: a.id || a.browseId,
                  title: a.title,
                  year: a.year || "",
                  thumbnail: a.thumbnail || a.art || ""
                }));
              }
            } catch (e) {
              console.warn('[Music Service] Supplement albums failed:', e);
            }
          }

          return {
            id: nData.id || targetId,
            name: nData.name || nData.title || targetId,
            description: nData.description || "",
            thumbnail: nData.art || nData.thumbnail || "",
            subscribers: "",
            songs,
            songs_params: "",
            albums,
            albums_params: "",
            singles: [],
            singles_params: "",
            related: []
          };
        }
      }
      return null;
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
      if (isNativeCoreAvailable() && AuraYouTube) {
        if (typeof AuraYouTube.getArtistDetails === 'function') {
          const details = await AuraYouTube.getArtistDetails(browseId);
          if (details?.songs && details.songs.length > 0) {
            return details.songs.map((s: any) => ({
              id: s.id,
              title: s.title,
              artist: s.artist || details.name || 'Unknown Artist',
              art: s.artworkUrl || s.art || details.art || '',
              duration: s.duration || 240,
              album: s.album || '',
              albumId: s.albumId || undefined,
              artistId: browseId,
              source: 'ytmusic',
            }));
          }
        }
        if (typeof AuraYouTube.search === 'function') {
          const songs = await AuraYouTube.search(browseId);
          if (Array.isArray(songs) && songs.length > 0) {
            return songs.map((s: any) => ({
              id: s.id,
              title: s.title,
              artist: s.artist || 'Unknown Artist',
              art: s.artworkUrl || '',
              duration: s.duration || 240,
              album: s.album || '',
              albumId: s.albumId || undefined,
              artistId: browseId,
              source: 'ytmusic',
            }));
          }
        }
      }

      return [];
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
      if (isNativeCoreAvailable() && AuraYouTube) {
        if (typeof AuraYouTube.getArtistDetails === 'function') {
          const details = await AuraYouTube.getArtistDetails(browseId);
          if (details?.albums && details.albums.length > 0) {
            return details.albums.map((a: any) => ({
              id: a.id,
              title: a.title,
              artist: details.name || 'Unknown Artist',
              year: a.year || '',
              thumbnail: a.art || a.thumbnail || '',
              type: 'album',
            }));
          }
        }
        if (typeof AuraYouTube.searchAlbums === 'function') {
          const albums = await AuraYouTube.searchAlbums(browseId);
          if (Array.isArray(albums) && albums.length > 0) {
            return albums.map((a: any) => ({
              id: a.id,
              title: a.title,
              artist: a.artist || 'Unknown Artist',
              year: a.year || '',
              thumbnail: a.art || '',
              type: 'album',
            }));
          }
        }
      }

      return [];
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
              id: s.id,
              title: s.title,
              artist: s.artist || nData.artist || "",
              artistId: s.artistId || undefined,
              album: nData.title,
              albumId: nData.id,
              duration: s.duration,
              art: s.artworkUrl || s.art || nData.thumbnail || "",
              source: 'ytmusic'
            }))
          };
        }
      }
      return null;
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
      const cleanTarget = albumName.trim().toLowerCase();
      if (!cleanTarget) return null;

      if (isNativeCoreAvailable() && AuraYouTube) {
        if (typeof AuraYouTube.searchAlbums === 'function') {
          const albums = await AuraYouTube.searchAlbums(albumName);
          if (Array.isArray(albums) && albums.length > 0) {
            const match = albums.find((a: any) => {
              const aTitle = (a.title || "").toLowerCase();
              return aTitle.includes(cleanTarget) || cleanTarget.includes(aTitle);
            }) || albums[0];

            if (match) {
              return {
                type: 'album',
                id: match.id || match.browseId,
                title: match.title,
                artist: match.artistName || match.artist || '',
                art: match.thumbnail || match.art || '',
                year: match.year,
                source: 'ytmusic',
              };
            }
          }
        }
        if (typeof AuraYouTube.searchUnified === 'function') {
          const res = await AuraYouTube.searchUnified(albumName);
          if (res?.albums && res.albums.length > 0) {
            const match = res.albums.find((a: any) => {
              const aTitle = (a.title || "").toLowerCase();
              return aTitle.includes(cleanTarget) || cleanTarget.includes(aTitle);
            }) || res.albums[0];

            if (match) {
              return {
                type: 'album',
                id: match.id || match.browseId,
                title: match.title,
                artist: match.artistName || match.artist || '',
                art: match.thumbnail || match.art || '',
                year: match.year,
                source: 'ytmusic',
              };
            }
          }
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

    throw new Error('[MusicAPI] Remote backend stream resolution disabled. Native UnifiedStreamResolver is authoritative.');
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
   * Fetch trending and top charts natively on-device.
   */
  getCharts: async (country?: string): Promise<{ trending: any[]; songs: any[]; artists: any[] }> => {
    try {
      if (isNativeCoreAvailable() && AuraYouTube) {
        const query = country === 'IN' ? 'Trending Songs India' : 'Top Global Hits';
        if (typeof AuraYouTube.searchUnified === 'function') {
          const res = await AuraYouTube.searchUnified(query);
          if (res) {
            const songs = (res.songs || []).map((t: any) => ({
              id: t.id,
              title: t.title,
              artist: t.artistName || t.artist || 'Unknown Artist',
              album: t.albumName || t.album || '',
              duration: t.duration || '--:--',
              art: t.thumbnail || t.artworkUrl || '',
              source: 'ytmusic',
            }));
            const artists = (res.artists || []).map((a: any) => ({
              id: a.id || a.browseId,
              title: a.title || a.name || 'Unknown Artist',
              art: a.thumbnail || a.art || '',
            }));
            return { trending: songs, songs, artists };
          }
        }
        if (typeof AuraYouTube.search === 'function') {
          const rawSongs = await AuraYouTube.search(query);
          const songs = (rawSongs || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            artist: t.artist || 'Unknown Artist',
            album: t.album || '',
            duration: t.duration ? `${Math.floor(t.duration / 60)}:${(t.duration % 60).toString().padStart(2, '0')}` : '--:--',
            art: t.artworkUrl || '',
            source: 'ytmusic',
          }));
          return { trending: songs, songs, artists: [] };
        }
      }

      return { trending: [], songs: [], artists: [] };
    } catch (error) {
      console.error('[MusicAPI] Error fetching charts:', error);
      return { trending: [], songs: [], artists: [] };
    }
  },
};