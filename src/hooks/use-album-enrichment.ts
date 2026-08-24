import { useState, useEffect, useRef } from 'react';
import { musicService } from '../services/api/music';
import { SearchEntity } from '../utils/search-utils';

// Lightweight in-memory cache for album enrichment
const memoryAlbumCache: Record<string, SearchEntity> = {};

/**
 * Hook to safely enrich album metadata for cards and detail views.
 * Implements caching, deduplication, and graceful fallback.
 */
export function useAlbumEnrichment(albumTitle?: string, artistName?: string) {
  const [enrichedAlbum, setEnrichedAlbum] = useState<SearchEntity | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestedAlbum = useRef<string | null>(null);

  useEffect(() => {
    if (!albumTitle || albumTitle === 'Unknown Album') {
      setEnrichedAlbum(null);
      return;
    }

    const cleanTitle = albumTitle.trim();
    const isGenericArtist = !artistName || artistName === 'Various Artists' || artistName === 'Unknown Artist' || artistName === 'Unknown';
    const effectiveArtist = !isGenericArtist ? artistName.trim() : '';
    const cacheKey = effectiveArtist ? `${cleanTitle}__${effectiveArtist}` : cleanTitle;

    // 1. Check Store and Memory Cache First
    try {
      const { useAnalyticsStore } = require('../features/analytics/store/analytics.store');
      const storeCached = useAnalyticsStore.getState().albumCache?.[cleanTitle];
      if (storeCached?.image && storeCached.id && !storeCached.image.includes('placeholder')) {
        const entity: SearchEntity = {
          type: 'album',
          id: storeCached.id,
          title: cleanTitle,
          artist: storeCached.artist || effectiveArtist || 'Various Artists',
          art: storeCached.image,
        };
        memoryAlbumCache[cacheKey] = entity;
        setEnrichedAlbum(entity);
        return;
      }

      // Check if any song in history contains this album
      const histMatch = useAnalyticsStore.getState().history?.find((h: any) => {
        const hAlb = (h.album || h.trackSnapshot?.album || '').toLowerCase().trim();
        const hTit = (h.title || '').toLowerCase().trim();
        const target = cleanTitle.toLowerCase().trim();
        return (hAlb && (hAlb === target || hAlb.includes(target) || target.includes(hAlb))) ||
               (hTit && (hTit === target || hTit.includes(target) || target.includes(hTit)));
      });

      const histArt = histMatch?.art || histMatch?.artwork || histMatch?.trackSnapshot?.art;
      if (histArt && !histArt.includes('placeholder')) {
        const entity: SearchEntity = {
          type: 'album',
          id: histMatch.albumId || histMatch.id || cleanTitle,
          title: cleanTitle,
          artist: histMatch.artist || effectiveArtist || 'Various Artists',
          art: histArt,
        };
        memoryAlbumCache[cacheKey] = entity;
        setEnrichedAlbum(entity);
        return;
      }
    } catch (e) {}

    if (memoryAlbumCache[cacheKey]) {
      setEnrichedAlbum(memoryAlbumCache[cacheKey]);
      return;
    }

    // 2. Throttling / Deduplication
    if (lastRequestedAlbum.current === cacheKey) return;
    lastRequestedAlbum.current = cacheKey;

    const fetchEnrichedData = async () => {
      // 3. Request Cancellation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);

      try {
        const query = effectiveArtist ? `${cleanTitle} ${effectiveArtist}` : cleanTitle;
        
        // 1. Search for songs inside this album and grab the top song's cover art
        const songs = await musicService.searchSongs(query);
        let result: SearchEntity | null = null;

        if (songs && songs.length > 0 && songs[0].art && !songs[0].art.includes('placeholder')) {
          result = {
            type: 'album',
            id: songs[0].albumId || songs[0].id,
            title: cleanTitle,
            artist: songs[0].artist || effectiveArtist || 'Various Artists',
            art: songs[0].art,
          };
        } else {
          // 2. Fallback to direct album entity lookup
          result = await musicService.lookupAlbumByName(query);
        }

        if (result && result.art && !result.art.includes('placeholder')) {
          memoryAlbumCache[cacheKey] = result;
          try {
            const { useAnalyticsStore } = require('../features/analytics/store/analytics.store');
            if (result.id) {
              useAnalyticsStore.getState().cacheAlbumDetails(cleanTitle, {
                id: result.id,
                image: result.art,
                artist: result.artist || effectiveArtist,
              });
            }
          } catch (e) {}
          setEnrichedAlbum(result);
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce lookup by 400ms to avoid spamming while scrolling
    const timer = setTimeout(fetchEnrichedData, 400);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [albumTitle, artistName]);

  return {
    enrichedAlbum,
    isLoading,
    hasEnrichment: !!enrichedAlbum,
  };
}
