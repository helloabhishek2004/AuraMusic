import { useState, useEffect, useRef } from 'react';
import { musicService } from '../services/api/music';
import { SearchEntity } from '../utils/search-utils';

// Lightweight in-memory cache for artist enrichment
const artistCache: Record<string, SearchEntity> = {};

/**
 * Hook to safely enrich artist metadata for the Now Playing panel.
 * Implements caching, throttling, and graceful fallback.
 */
export function useArtistEnrichment(artistName?: string) {
  const [enrichedArtist, setEnrichedArtist] = useState<SearchEntity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestedArtist = useRef<string | null>(null);

  useEffect(() => {
    if (!artistName || artistName === 'Unknown Artist') {
      setEnrichedArtist(null);
      return;
    }

    // 1. Check Cache First
    try {
      const { useAnalyticsStore } = require('../features/analytics/store/analytics.store');
      const storeCached = useAnalyticsStore.getState().artistCache?.[artistName] || useAnalyticsStore.getState().artistProfileCache?.[artistName];
      if (storeCached?.image && storeCached.id) {
        const entity: SearchEntity = {
          type: 'artist',
          id: storeCached.id,
          title: artistName,
          artist: artistName,
          art: storeCached.image,
        };
        artistCache[artistName] = entity;
        setEnrichedArtist(entity);
        return;
      }
    } catch (e) {}

    if (artistCache[artistName]) {
      setEnrichedArtist(artistCache[artistName]);
      return;
    }

    // 2. Throttling / Deduplication
    if (lastRequestedArtist.current === artistName) return;
    lastRequestedArtist.current = artistName;

    const fetchEnrichedData = async () => {
      // 3. Request Cancellation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        console.log(`[Artist Enrichment] Looking up: ${artistName}`);
        const result = await musicService.lookupArtistByName(artistName);
        
        if (result) {
          // 4. Cache Result in memory and in analytics store
          artistCache[artistName] = result;
          try {
            const { useAnalyticsStore } = require('../features/analytics/store/analytics.store');
            if (result.art && result.id) {
              useAnalyticsStore.getState().cacheArtistDetails(artistName, {
                id: result.id,
                image: result.art,
              });
            }
          } catch (e) {}
          setEnrichedArtist(result);
        } else {
          console.log(`[Artist Enrichment] No detailed metadata found for: ${artistName}`);
        }
      } catch (err: any) {
        // 5. Silent Fail for Enrichment (Secondary Data)
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
        
        console.warn(`[Artist Enrichment] Optional lookup failed for ${artistName}:`, err.message);
        // We don't set a critical error state because the UI should fallback gracefully
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce lookup by 400ms to avoid spamming while swiping/transitioning
    const timer = setTimeout(fetchEnrichedData, 400);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [artistName]);

  return {
    enrichedArtist,
    isLoading,
    // We return a boolean instead of error string to simplify UI logic
    hasEnrichment: !!enrichedArtist,
  };
}
