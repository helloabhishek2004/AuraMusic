import { useState, useEffect, useCallback, useRef } from 'react';
import { musicService } from '../services/api/music';
import { AuraYouTube, isNativeCoreAvailable } from '../services/native-core';
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
      // 1. PARALLEL SEARCH
      console.log(`[Search] PRIMARY: Searching for: ${trimmed}`);
      
      const [songsData, artistResults, albumResults] = await Promise.all([
        musicService.searchSongs(trimmed),
        musicService.searchArtists(trimmed).catch(() => []),
        musicService.searchAlbums(trimmed).catch(() => [])
      ]);
      
      if (controller.signal.aborted) return;

      if (songsData.length === 0 && artistResults.length === 0 && albumResults.length === 0) {
        setResults(EMPTY_RESULT);
        setIsLoading(false);
        return;
      }

      setIsEnriching(true);

      // Filter and Deduplicate Artists
      const enrichedArtists: SearchEntity[] = [];
      const seenArtistIds = new Set<string>();
      artistResults.forEach(artist => {
        if (artist && !seenArtistIds.has(artist.id)) {
          seenArtistIds.add(artist.id);
          enrichedArtists.push(artist);
        }
      });

      // Filter and Deduplicate Albums
      const enrichedAlbums: SearchEntity[] = [];
      const seenAlbumIds = new Set<string>();
      albumResults.flat().forEach(album => {
        if (album && !seenAlbumIds.has(album.id)) {
          seenAlbumIds.add(album.id);
          enrichedAlbums.push(album);
        }
      });

      // SINGLE COMMIT: Update all results at once to minimize render churn
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
    // 150ms single debounce for optimized production latency
    const timer = setTimeout(() => {
      if (query.trim() !== lastQueryRef.current.trim()) {
        lastQueryRef.current = query;
        performSearch(query);
      }
    }, 150);

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

