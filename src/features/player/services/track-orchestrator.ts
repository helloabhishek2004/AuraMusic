import { PlayerTrack } from "../types/player";
import { useMediaCacheStore } from "../../cache/store/media-cache.store";
import { resolveFullTrack } from "../utils/track-resolver";
import { musicService } from "../../../services/api/music";
import { usePlayerStore } from "../store/player.store";
import { PlaybackService } from "./playback.service";

/**
 * TrackOrchestrator - Unified pipeline for track resolution, enrichment, and prefetching.
 * This is the SINGLE authoritative flow for any track entry point.
 */
export class TrackOrchestrator {
    
    /**
     * Resolves a track with maximum metadata and readiness.
     * Uses cache -> enrichment -> online flow.
     */
    static async resolveAndEnrich(track: PlayerTrack, options: { 
        forceRefresh?: boolean,
        prefetchNext?: boolean 
    } = {}): Promise<PlayerTrack> {
        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);

        // 1. Instant Cache Return (if valid and not forced)
        if (cached && !options.forceRefresh) {
            // Check if it's "full enough"
            const isFull = !!(cached.track.albumId && (cached.lyrics || track.isLocal));
            if (isFull) {
                // Return cached version but maybe trigger background refresh if old
                if (Date.now() - cached.lastUpdated > 1000 * 60 * 60 * 24 * 7) {
                    this.backgroundEnrich(track);
                }
                return { ...track, ...cached.track } as PlayerTrack;
            }
        }

        // 2. Perform Full Resolution
        const resolved = await resolveFullTrack(track);

        // 3. Cache the result
        cacheStore.cacheTrack(resolved);

        // 4. Trigger background tasks
        if (options.prefetchNext) {
            // Predict next track if we are in a queue context
            // This is handled by playerStore.preloadNext usually, 
            // but we can trigger metadata-only prefetch here.
        }

        return resolved;
    }

    /**
     * Prefetches metadata/lyrics/artwork for the next track.
     * Does NOT resolve audio stream to save data/bandwidth unless specifically requested.
     */
    static async prefetchMetadata(track: PlayerTrack) {
        if (!track) return;
        
        const cacheStore = useMediaCacheStore.getState();
        const cached = cacheStore.getCachedTrack(track.id);
        
        if (cached && Date.now() - cached.lastUpdated < 1000 * 60 * 60 * 12) {
            return; // Fresh enough
        }

        try {
            // Metadata & Album Enrichment
            const resolved = await resolveFullTrack(track);
            cacheStore.cacheTrack(resolved);

            // Lyrics Prefetch (if online)
            if (!track.isLocal && !cached?.lyrics) {
                const lyrics = await musicService.resolveLyrics(resolved);
                if (lyrics) {
                    cacheStore.cacheLyrics(track.id, lyrics);
                }
            }
        } catch (e) {
            console.warn("[TrackOrchestrator] Prefetch failed for", track.id, e);
        }
    }

    /**
     * Non-blocking background enrichment
     */
    private static async backgroundEnrich(track: PlayerTrack) {
        try {
            const resolved = await resolveFullTrack(track);
            useMediaCacheStore.getState().cacheTrack(resolved);
        } catch (e) {}
    }

    /**
     * Unifies playback start from any UI point.
     */
    static async play(track: PlayerTrack, context?: any) {
        const store = usePlayerStore.getState();
        
        // 1. Update UI state immediately (optimistic)
        if (context) store.setActiveContext(context);
        
        // 2. Resolve & Play
        await store.setTrack(track);
    }
}
