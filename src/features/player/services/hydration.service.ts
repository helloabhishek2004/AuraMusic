import { PlayerTrack } from '../types/player';
import { MetadataCache } from '../../cache/services/metadata-cache.service';
import { getCanonicalTrackId } from '../utils/track-identity';
import { requestIdleTask, cancelIdleTask } from '../../../utils/idle-task';
import { musicService } from '../../../services/api/music';
import { usePlayerStore } from '../store/player.store';

class HydrationService {
    private activeJobs: Map<string, number> = new Map();

    /**
     * Schedules a background hydration job for a track.
     * Safe to call on every track play/load.
     */
    scheduleHydration(track: PlayerTrack) {
        const id = getCanonicalTrackId(track);

        // Cancel any pending job for this exact track identity just in case
        this.cancelJob(id);

        const jobId = requestIdleTask(async (deadline) => {
            try {
                // 1. Check cache freshness
                const cached = MetadataCache.getHotEntry(track);
                if (MetadataCache.isFresh(cached)) {
                    this.activeJobs.delete(id);
                    return; // Already fresh, skip
                }

                // 2. Determine enrichment strategy based on source
                // Downloaded/local tracks only get online enrichment if internet is available and checksum/norm matches.
                // For simplicity, we assume musicService handles network states or we just wrap in try-catch.
                
                // Fetch missing heavy metadata from musicService
                // (Assuming musicService has a getTrackDetails or similar, or we fallback to search)
                // If it's a ytmusic track, we can use musicService.getTrackDetails(track.id)
                let enrichedData: Partial<PlayerTrack> = {};
                
                if (track.source === 'ytmusic' || track.url.includes('youtube')) {
                    // Simulated or actual fetch depending on musicService capabilities
                    // const details = await musicService.getTrackDetails(track.id);
                    // enrichedData = { ...details };
                }

                // Example: Merge what we found
                if (Object.keys(enrichedData).length > 0) {
                    MetadataCache.mergeEntry(track, enrichedData);
                    
                    // 3. Patch Player Store if this track is still currently playing
                    this.patchStoreIfActive(id, enrichedData);
                }

            } catch (error) {
                // Soft fail: bump stale time slightly to avoid infinite retry loops
                MetadataCache.mergeEntry(track, { staleAt: Date.now() + 60 * 60 * 1000 }); // +1 hour
            } finally {
                this.activeJobs.delete(id);
            }
        });

        this.activeJobs.set(id, jobId);
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
                store.updateTrackMetadata(canonicalId, partial);
            }
        }
    }
}

export const HydrationScheduler = new HydrationService();
