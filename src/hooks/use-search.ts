import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchRepository } from '../features/search/engine/search-repository';
import { UnifiedSearchResponse, RankedSearchResult, SearchEntity } from '../features/search/types/search-engine.types';
import { useLikesStore } from '../features/likes/store/likes.store';

export interface SearchCategoryResults {
  songs: RankedSearchResult[];
  artists: RankedSearchResult[];
  albums: RankedSearchResult[];
  playlists: RankedSearchResult[];
  videos: RankedSearchResult[];
  topResult: RankedSearchResult | null;
  intent: any;
  isEmpty: boolean;
  isOffline: boolean;
  sectionOrder: string[];
}

const EMPTY_RESULT: SearchCategoryResults = {
  songs: [],
  artists: [],
  albums: [],
  playlists: [],
  videos: [],
  topResult: null,
  intent: null,
  isEmpty: true,
  isOffline: false,
  sectionOrder: ['topResult', 'songs', 'artists', 'albums', 'playlists']
};

/**
 * useSearch Hook — Powered by Intent-Aware Search Engine
 */
export function useSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchCategoryResults>(EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastQueryRef = useRef(initialQuery);
  const abortControllerRef = useRef<AbortController | null>(null);
  const likedRecord = useLikesStore(s => s.likedTrackIds);
  const likedTrackIds = Object.keys(likedRecord).filter(k => likedRecord[k]);

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
      // Refresh local personalization signals (likes, downloads, history)
      await SearchRepository.refreshPersonalization(likedTrackIds);

      const response: UnifiedSearchResponse = await SearchRepository.search(trimmed, {
        signal: controller.signal,
        likedIds: likedTrackIds
      });

      if (controller.signal.aborted) return;

      setResults({
        songs: response.songs,
        artists: response.artists,
        albums: response.albums,
        playlists: response.playlists,
        videos: response.videos,
        topResult: response.topResult,
        intent: response.intent,
        isEmpty: response.isEmpty,
        isOffline: response.isOffline,
        sectionOrder: response.sectionOrder
      });

    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.message === 'Aborted') return;
      console.error('[Search] Error:', err);
      setError('Search temporarily unavailable. Please try again.');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsEnriching(false);
      }
    }
  }, [likedTrackIds]);

  useEffect(() => {
    // 250ms debounce for responsive typing & cancellation
    const timer = setTimeout(() => {
      if (query.trim() !== lastQueryRef.current.trim()) {
        lastQueryRef.current = query;
        performSearch(query);
      }
    }, 250);

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
