import { useState, useEffect, useCallback, useRef } from 'react';
import { musicService } from '../services/api/music';
import { MusicTrack } from '../types/music';

/**
 * useSearch Hook
 * Manages search state, debouncing, and API interaction.
 */
export function useSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to store the latest query to avoid unnecessary effect triggers
  const lastQueryRef = useRef(initialQuery);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await musicService.searchSongs(searchQuery);
      setResults(data);
    } catch (err) {
      setError('Failed to fetch results. Please check your connection.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounce logic
    const timer = setTimeout(() => {
      if (query !== lastQueryRef.current) {
        lastQueryRef.current = query;
        performSearch(query);
      }
    }, 300); // 300ms debounce (Optimized for AuraMusic)

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    refresh: () => performSearch(query),
  };
}
