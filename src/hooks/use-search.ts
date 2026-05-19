import { useState, useEffect, useCallback, useRef } from 'react';
import { musicService } from '../services/api/music';
import { SearchEntity, getBestThumbnail } from '../utils/search-utils';

export interface SearchCategoryResults {
  songs: SearchEntity[];
  artists: SearchEntity[];
  albums: SearchEntity[];
  playlists: SearchEntity[];
  topResult: SearchEntity | null;
  isEmpty: boolean;
}

const EMPTY_RESULT: SearchCategoryResults = {
  songs: [],
  artists: [],
  albums: [],
  playlists: [],
  topResult: null,
  isEmpty: true,
};

/**
 * Extract unique artists from song results for contextual enrichment
 */
function extractUniqueArtists(songs: SearchEntity[]): string[] {
  const artistMap = new Map<string, number>();
  
  songs.forEach(song => {
    if (song.artist) {
      const artistLower = song.artist.toLowerCase().trim();
      const count = artistMap.get(artistLower) || 0;
      artistMap.set(artistLower, count + 1);
    }
  });

  // Sort by frequency (most mentioned first)
  const sorted = Array.from(artistMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // Limit to 5 artists
    .map(([name]) => name);

  console.log('[Search] Extracted artists:', sorted);
  return sorted;
}

/**
 * Extract unique albums from song results for contextual enrichment
 */
function extractUniqueAlbums(songs: SearchEntity[]): string[] {
  // Album detection from song metadata - check for album info in artist field
  // or use a more sophisticated approach based on song patterns
  // For now, we'll use the artist-based approach + top songs
  
  // Get unique artist names to search albums for
  const artistNames = extractUniqueArtists(songs);
  
  // For now, we'll primarily rely on artist-based album lookup
  // Future: enhance with album field in song metadata
  return artistNames.slice(0, 3);
}

/**
 * useSearch Hook
 * Manages unified search with contextual enrichment.
 */
export function useSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchCategoryResults>(EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastQueryRef = useRef(initialQuery);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults(EMPTY_RESULT);
      setIsLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // 1. PRIMARY SEARCH: Songs
      console.log('[Search] PRIMARY: Searching songs for:', trimmed);
      const songsData = await musicService.searchSongs(trimmed);
      
      if (controller.signal.aborted) return;

      if (songsData.length === 0) {
        setResults(EMPTY_RESULT);
        setIsLoading(false);
        return;
      }

      // 2. PARALLEL ENRICHMENT: Contextual Extraction
      const uniqueArtists = extractUniqueArtists(songsData);
      
      // Update intermediate results with songs to reduce perceived delay
      setResults(prev => ({
        ...prev,
        songs: songsData.slice(0, 15),
        topResult: songsData[0],
        isEmpty: false
      }));

      setIsEnriching(true);

      // Fetch artists and albums in parallel
      const [artistResults, albumResults] = await Promise.all([
        // Artists Enrichment
        Promise.all(uniqueArtists.slice(0, 5).map(async (name) => {
          try {
            return await musicService.lookupArtistByName(name);
          } catch (e) { return null; }
        })),
        // Albums Enrichment (Artist-based)
        Promise.all(uniqueArtists.slice(0, 3).map(async (name) => {
          try {
            const albums = await musicService.searchAlbums(`${name} albums`);
            return albums.slice(0, 2);
          } catch (e) { return []; }
        }))
      ]);

      if (controller.signal.aborted) return;

      // Filter and Deduplicate
      const enrichedArtists: SearchEntity[] = [];
      const seenArtistIds = new Set<string>();
      artistResults.forEach(artist => {
        if (artist && !seenArtistIds.has(artist.id)) {
          seenArtistIds.add(artist.id);
          enrichedArtists.push(artist);
        }
      });

      const enrichedAlbums: SearchEntity[] = [];
      const seenAlbumIds = new Set<string>();
      albumResults.flat().forEach(album => {
        if (album && !seenAlbumIds.has(album.id)) {
          seenAlbumIds.add(album.id);
          enrichedAlbums.push(album);
        }
      });

      setResults({
        songs: songsData.slice(0, 15),
        artists: enrichedArtists.slice(0, 6),
        albums: enrichedAlbums.slice(0, 8),
        playlists: [],
        topResult: songsData[0],
        isEmpty: false,
      });

    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return;
      console.error('[Search] Error:', err);
      setError('Search temporarily unavailable. Please try again.');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsEnriching(false);
      }
    }
  }, []);

  useEffect(() => {
    // 350ms debounce for typing responsiveness
    const timer = setTimeout(() => {
      if (query.trim() !== lastQueryRef.current.trim()) {
        lastQueryRef.current = query;
        performSearch(query);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [query, performSearch]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isEnriching,
    error,
    refresh: () => performSearch(query),
  };
}