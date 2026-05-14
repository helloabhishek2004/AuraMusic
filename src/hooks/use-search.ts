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
    if (!searchQuery.trim()) {
      setResults(EMPTY_RESULT);
      setIsLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      // STEP 1: Search songs first
      console.log('[Search] Step 1: Searching songs for:', searchQuery);
      const songsData = await musicService.searchSongs(searchQuery);
      
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // If no songs found, return empty
      if (songsData.length === 0) {
        setResults(EMPTY_RESULT);
        setIsLoading(false);
        return;
      }

      // STEP 2: Extract context from songs for enrichment
      const uniqueArtists = extractUniqueArtists(songsData);
      const uniqueAlbums = extractUniqueAlbums(songsData);
      
      console.log('[Search] Step 2: Context extracted - Artists:', uniqueArtists.length, 'Albums:', uniqueAlbums.length);

      // STEP 3: Fetch artist entities contextually
      const enrichedArtists: SearchEntity[] = [];
      setIsEnriching(true);
      
      if (uniqueArtists.length > 0) {
        console.log('[Search] Step 3: Fetching artist entities...');
        
        // Fetch artists in parallel, limit to 5
        const artistPromises = uniqueArtists.slice(0, 5).map(async (artistName) => {
          try {
            const artist = await musicService.lookupArtistByName(artistName);
            return artist;
          } catch (e) {
            console.error('[Search] Error fetching artist:', artistName, e);
            return null;
          }
        });

        const artistResults = await Promise.all(artistPromises);
        
        // Filter out nulls and duplicates
        const seenArtistIds = new Set<string>();
        artistResults.forEach(artist => {
          if (artist && !seenArtistIds.has(artist.id)) {
            seenArtistIds.add(artist.id);
            enrichedArtists.push(artist);
          }
        });

        console.log('[Search] Enriched artists:', enrichedArtists.length);
      }

      // STEP 4: Fetch album entities based on artist names
      const enrichedAlbums: SearchEntity[] = [];
      
      if (uniqueArtists.length > 0) {
        console.log('[Search] Step 4: Fetching album entities...');
        
        // For each artist, search their albums
        const albumPromises = uniqueArtists.slice(0, 3).map(async (artistName) => {
          try {
            // Search for "artistName albums" to get their albums
            const albums = await musicService.searchAlbums(`${artistName} albums`);
            return albums.slice(0, 2); // Limit 2 albums per artist
          } catch (e) {
            console.error('[Search] Error fetching albums for:', artistName, e);
            return [];
          }
        });

        const albumResults = await Promise.all(albumPromises);
        
        // Flatten and deduplicate
        const seenAlbumIds = new Set<string>();
        albumResults.flat().forEach(album => {
          if (album && !seenAlbumIds.has(album.id)) {
            seenAlbumIds.add(album.id);
            enrichedAlbums.push(album);
          }
        });

        console.log('[Search] Enriched albums:', enrichedAlbums.length);
      }

      setIsEnriching(false);

      // Determine top result (song only)
      const topResult = songsData.length > 0 ? songsData[0] : null;

      setResults({
        songs: songsData.slice(0, 10),
        artists: enrichedArtists.slice(0, 6),
        albums: enrichedAlbums.slice(0, 6),
        playlists: [], // Could enhance later
        topResult,
        isEmpty: songsData.length === 0 && enrichedArtists.length === 0 && enrichedAlbums.length === 0,
      });

      console.log('[Search] Final results:', {
        query: searchQuery,
        songs: songsData.length,
        artists: enrichedArtists.length,
        albums: enrichedAlbums.length,
        topResult: topResult?.title,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return;
      }
      console.error('[Search] Error:', err);
      setError('Failed to search. Please try again.');
      setResults(EMPTY_RESULT);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false);
        setIsEnriching(false);
      }
    }
  }, []);

  useEffect(() => {
    // Debounce logic - 300ms debounce
    const timer = setTimeout(() => {
      if (query !== lastQueryRef.current) {
        lastQueryRef.current = query;
        performSearch(query);
      }
    }, 300);

    return () => clearTimeout(timer);
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