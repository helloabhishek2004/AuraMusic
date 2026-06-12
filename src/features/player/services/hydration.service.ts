import { PlayerTrack } from '../types/player';
import { MetadataCache } from '../../cache/services/metadata-cache.service';
import { getCanonicalTrackId } from '../utils/track-identity';
import { requestIdleTask, cancelIdleTask } from '../../../utils/idle-task';
import { musicService } from '../../../services/api/music';
import { usePlayerStore } from '../store/player.store';
import { useMediaCacheStore } from '../../cache/store/media-cache.store';

// Helper to normalize strings for robust fuzzy comparison
function cleanStringForComparison(str: string): string {
    return str.toLowerCase()
        .replace(/\(feat\..*?\)/g, '')
        .replace(/\[feat\..*?\]/g, '')
        .replace(/\(with.*?\)/g, '')
        .replace(/remix/g, '')
        .replace(/live/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Levenshtein string similarity utility (0.0 to 1.0)
export function calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = cleanStringForComparison(str1);
    const s2 = cleanStringForComparison(str2);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    
    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1.0;
    
    const track = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    for (let i = 0; i <= len1; i++) track[0][i] = i;
    for (let j = 0; j <= len2; j++) track[j][0] = j;
    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator // substitution
            );
        }
    }
    const distance = track[len2][len1];
    return (maxLen - distance) / maxLen;
}

class HydrationService {
    private activeJobs: Map<string, number> = new Map();
    private inFlightHydrations: Map<string, Promise<Partial<PlayerTrack>>> = new Map();

    /**
     * Schedules a background hydration job for a track.
     * Safe to call on every track play/load. Runs at idle priority.
     */
    scheduleHydration(track: PlayerTrack) {
        if (!track) return;
        const isLocal = track.isLocal || track.url?.startsWith("file://") || track.url?.startsWith("content://");
        if (isLocal) return;

        const id = getCanonicalTrackId(track);

        // Cancel any pending task for this exact track identity
        this.cancelJob(id);

        const jobId = requestIdleTask(async () => {
            try {
                // 1. Check hot cache memory freshness first
                const cached = MetadataCache.getHotEntry(track);
                if (MetadataCache.isFresh(cached)) {
                    this.activeJobs.delete(id);
                    
                    // Even if fresh, ensure store contains the cached fields
                    if (cached) {
                        this.patchStoreIfActive(id, {
                            album: cached.album || undefined,
                            albumId: cached.albumId || undefined,
                            artistId: cached.artistId || undefined,
                        });
                    }
                    return;
                }

                // 2. Coalesce/Deduplicate in-flight hydration requests
                let enrichmentPromise = this.inFlightHydrations.get(id);
                if (!enrichmentPromise) {
                    enrichmentPromise = this.performHydrationEnrichment(track);
                    this.inFlightHydrations.set(id, enrichmentPromise);
                }

                const enrichedData = await enrichmentPromise;
                this.inFlightHydrations.delete(id);

                // 3. Merge enriched data into caches and store atomically
                if (Object.keys(enrichedData).length > 0) {
                    // Save to memory and debounced AsyncStorage cache
                    MetadataCache.mergeEntry(track, {
                        album: enrichedData.album || null,
                        albumId: enrichedData.albumId || null,
                        artistId: enrichedData.artistId || null,
                    });

                    // Save to Zustand MediaCacheStore
                    const cacheStore = useMediaCacheStore.getState();
                    cacheStore.cacheTrack(track, {
                        track: { ...track, ...enrichedData },
                        lastUpdated: Date.now()
                    });

                    // 4. Patch Player Store if track is still actively playing (queue immutable)
                    this.patchStoreIfActive(id, enrichedData);
                }

            } catch (error) {
                console.warn(`[HydrationService] Failed to hydrate track: ${id}`, error);
                // Soft fail: bump stale time slightly to avoid infinite retry loops
                MetadataCache.mergeEntry(track, { staleAt: Date.now() + 60 * 60 * 1000 }); // +1 hour
            } finally {
                this.activeJobs.delete(id);
            }
        });

        this.activeJobs.set(id, jobId);
    }

    /**
     * Internal async worker to fetch metadata and resolve fallbacks.
     */
    private async performHydrationEnrichment(track: PlayerTrack): Promise<Partial<PlayerTrack>> {
        const enriched: Partial<PlayerTrack> = {};
        const cacheStore = useMediaCacheStore.getState();

        try {
            // A. Fetch Online/Synced Lyrics in Background (Track-Identity Driven)
            const id = getCanonicalTrackId(track);
            const cachedTrackRecord = cacheStore.getCachedTrack(id) || cacheStore.getCachedTrack(track.id);
            if (!cachedTrackRecord?.lyrics) {
                try {
                    const lyricsData = await musicService.resolveLyrics({
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration
                    });
                    if (lyricsData && lyricsData.unavailable !== true) {
                        // Also make sure to update store lyrics if this track is active
                        const currentTrack = usePlayerStore.getState().currentTrack;
                        if (currentTrack && getCanonicalTrackId(currentTrack) === id) {
                            const { parseLyricsData } = require("../utils/lyrics-parser");
                            const parsed = parseLyricsData(lyricsData);
                            usePlayerStore.setState({ lyrics: parsed, isLyricsLoading: false });
                        }
                    }
                } catch (e) {
                    // Fail silently for lyrics pre-fetch
                }
            } else {
                // Instantly sync with store if active to avoid delays
                const currentTrack = usePlayerStore.getState().currentTrack;
                if (currentTrack && getCanonicalTrackId(currentTrack) === id && cachedTrackRecord.lyrics.unavailable !== true) {
                    const { parseLyricsData } = require("../utils/lyrics-parser");
                    const parsed = parseLyricsData(cachedTrackRecord.lyrics);
                    usePlayerStore.setState({ lyrics: parsed, isLyricsLoading: false });
                }
            }

            // B. Resolve Album Metadata & Album ID Fallbacks
            let albumId = track.albumId || cachedTrackRecord?.track?.albumId;
            let artistId = track.artistId || cachedTrackRecord?.track?.artistId;
            let albumName = track.album || cachedTrackRecord?.track?.album;

            // Confidence-based album resolver: (song title + primary artist) -> top-confidence album match
            if (!albumId) {
                try {
                    const searchResults = await musicService.searchSongs(`${track.title} ${track.artist}`);
                    if (searchResults && searchResults.length > 0) {
                        let bestMatch: any = null;
                        let bestScore = 0;

                        for (const res of searchResults) {
                            if (res.albumId && res.album && res.album !== 'Unknown') {
                                const titleScore = calculateStringSimilarity(track.title, res.title || '');
                                const artistScore = calculateStringSimilarity(track.artist, res.artist || '');
                                
                                // Weighted average score: title (40%) and artist (60%)
                                const confidence = (titleScore * 0.4) + (artistScore * 0.6);
                                if (confidence > bestScore) {
                                    bestScore = confidence;
                                    bestMatch = res;
                                }
                            }
                        }

                        // Confidence threshold passes (ex: 0.85)
                        if (bestMatch && bestScore > 0.85) {
                            console.log(`[HydrationService] Confidence-based album matched with score ${bestScore.toFixed(2)}: "${bestMatch.album}" (${bestMatch.albumId})`);
                            albumId = bestMatch.albumId;
                            albumName = bestMatch.album;
                            
                            // Persist resolved albumId into metadata cache permanently
                            cacheStore.cacheAlbumId(albumName || '', track.artist, bestMatch.albumId);
                        }
                    }
                } catch (e) {
                    console.warn('[HydrationService] Album confidence-based resolution failed:', e);
                }
            }

            // If still missing, try direct album name matching as fallback
            if (!albumId && albumName && albumName !== 'Unknown' && albumName !== '') {
                albumId = cacheStore.getAlbumId(albumName, track.artist) || undefined;

                if (!albumId) {
                    const cleanedArtist = cleanStringForComparison(track.artist);
                    const cleanedAlbum = cleanStringForComparison(albumName);

                    const albumResults = await musicService.searchAlbums(albumName);
                    if (albumResults && albumResults.length > 0) {
                        for (const res of albumResults) {
                            if (res.type === 'album') {
                                const cleanResTitle = cleanStringForComparison(res.title || '');
                                const cleanResArtist = cleanStringForComparison(res.artist || '');

                                const albumMatches = cleanResTitle.includes(cleanedAlbum) || cleanedAlbum.includes(cleanResTitle);
                                const artistMatches = cleanResArtist.includes(cleanedArtist) || cleanedArtist.includes(cleanedArtist);

                                if (albumMatches && artistMatches) {
                                    albumId = res.id;
                                    cacheStore.cacheAlbumId(albumName, track.artist, res.id);
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // C. Resolve Artist ID
            if (!artistId && track.artist) {
                try {
                    const artistRes = await musicService.lookupArtistByName(track.artist);
                    if (artistRes && artistRes.id) {
                        artistId = artistRes.id;
                    }
                } catch (e) {}
            }

            // D. Populate enriched object
            if (albumId) enriched.albumId = albumId;
            if (artistId) enriched.artistId = artistId;
            if (albumName) enriched.album = albumName;

        } catch (e) {
            console.warn('[HydrationService] Resolution error:', e);
        }

        return enriched;
    }

    /**
     * Cancels an active hydration job for a track if it hasn't fired yet.
     */
    cancelJob(id: string) {
        if (this.activeJobs.has(id)) {
            cancelIdleTask(this.activeJobs.get(id)!);
            this.activeJobs.delete(id);
        }
    }

    /**
     * Patches the Zustand store ONLY if the hydrated track is still the current track.
     * Enforces shallow comparison to prevent re-render storms.
     */
    private patchStoreIfActive(canonicalId: string, partial: Partial<PlayerTrack>) {
        const store = usePlayerStore.getState();
        if (!store.currentTrack) return;

        const currentCanonical = getCanonicalTrackId(store.currentTrack);
        if (currentCanonical === canonicalId) {
            // Shallow compare before dispatching
            let hasChanges = false;
            for (const key of Object.keys(partial)) {
                if ((store.currentTrack as any)[key] !== (partial as any)[key]) {
                    hasChanges = true;
                    break;
                }
            }

            if (hasChanges) {
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.info(`[HydrationService] [Aura_Stabilization] Patching active track: ${canonicalId}`, partial);
                }
                store.updateTrackMetadata(canonicalId, partial);
            }
        }
    }
}

export const HydrationScheduler = new HydrationService();
