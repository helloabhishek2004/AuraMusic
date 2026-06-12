import { usePlayerStore } from "../store/player.store";
import { validateTrackSource } from "./source-validator";
import { isSourceStale } from "./source-freshness-policy";
import { ensurePlayableTrack } from "./source-authority";
import { PlaybackService } from "./playback.service";
import { useTelemetryStore } from "../store/telemetry.store";
import { useSourceHealthStore } from "../store/source-health.store";

export class QueueRepairService {
  private static repairInProgress = false;
  private static lastRepairTime = 0;
  private static MIN_REPAIR_INTERVAL = 60_000;
  private static maintenanceTimer: NodeJS.Timeout | null = null;

  /**
   * Repairs queue tracks within a sliding window (2 behind, 5 ahead) wrapping boundaries.
   */
  static async repairQueue(forceRepair: boolean = false): Promise<void> {
    if (this.repairInProgress) return;

    const now = Date.now();
    if (!forceRepair && (now - this.lastRepairTime < this.MIN_REPAIR_INTERVAL)) {
      console.info("[QueueRepairService] Skipping repair: last repair ran less than 60s ago.");
      return;
    }

    const store = usePlayerStore.getState();
    const queue = store.queue;
    const currentIndex = store.currentIndex;
    const currentTrack = store.currentTrack;

    if (queue.length === 0) {
      return;
    }

    this.repairInProgress = true;
    this.lastRepairTime = now;

    try {
      const N = queue.length;
      const indicesToRepair = new Set<number>();
      
      // Build sliding window: 2 behind, current, 5 ahead
      indicesToRepair.add(currentIndex);
      indicesToRepair.add((currentIndex - 1 + N) % N);
      indicesToRepair.add((currentIndex - 2 + N) % N);
      for (let i = 1; i <= 5; i++) {
        indicesToRepair.add((currentIndex + i) % N);
      }

      console.info(`[QueueRepairService] Running sliding window repair on indices: ${Array.from(indicesToRepair).join(", ")}`);

      let repairedCount = 0;

      for (const idx of indicesToRepair) {
        if (idx < 0 || idx >= N) continue;
        const track = queue[idx];
        if (!track) continue;

        // Skip current track if playing to avoid audio gaps during active stream changes
        if (currentTrack && track.id === currentTrack.id && store.isPlaying) {
          continue;
        }

        if (useSourceHealthStore.getState().isCooldownActive(track.id)) {
          console.info(`Skipped repair: track currently in cooldown (id: ${track.id}, title: "${track.title}")`);
          continue;
        }

        const validation = await validateTrackSource(track);
        const stale = isSourceStale(track);

        if (!validation.valid || stale) {
          console.info(`[QueueRepairService] Repairing track at index ${idx}: "${track.title}" (Valid: ${validation.valid}, Stale: ${stale})`);
          try {
            const repairedTrack = await ensurePlayableTrack(track);

            // Re-fetch state in case queue mutated during resolution
            const latestStore = usePlayerStore.getState();
            const newQueue = [...latestStore.queue];
            
            // Re-verify track index to be absolutely safe
            const latestIdx = newQueue.findIndex(t => t.id === track.id);
            if (latestIdx !== -1) {
              const mergedTrack = { ...track, ...repairedTrack };
              newQueue[latestIdx] = mergedTrack;

              const isCurrentTrack = latestStore.currentTrack?.id === track.id;
              
              usePlayerStore.setState({
                queue: newQueue,
                currentTrack: isCurrentTrack ? mergedTrack : latestStore.currentTrack
              });

              // Sync natively
              await PlaybackService.updateMediaItem(latestIdx, mergedTrack);

              repairedCount++;
              useTelemetryStore.getState().incrementMetric("queueRepairCount");
              if (stale) {
                useTelemetryStore.getState().incrementMetric("streamRecoveryCount");
              }
            }
          } catch (err) {
            console.warn(`[QueueRepairService] Failed to repair track at index ${idx} ("${track.title}"):`, err);
            useTelemetryStore.getState().incrementMetric("sourceErrorCount");
          }
        }
      }

      if (repairedCount > 0) {
        console.info(`[QueueRepairService] Completed sliding window repair. Repaired ${repairedCount} tracks.`);
      }
    } catch (err) {
      console.error("[QueueRepairService] Error in repairQueue:", err);
    } finally {
      this.repairInProgress = false;
    }
  }

  /**
   * Starts the 30-minute interval worker to check and refresh current + next 2 tracks proactively.
   */
  static startMaintenanceWorker(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }

    console.info("[QueueRepairService] Proactive maintenance worker started. (30 min interval)");

    this.maintenanceTimer = setInterval(async () => {
      try {
        const store = usePlayerStore.getState();
        const queue = store.queue;
        const currentIndex = store.currentIndex;
        const currentTrack = store.currentTrack;

        if (queue.length === 0) return;

        const { useDeviceStateStore } = require("../../device/store/device-state.store");
        const isOffline = useDeviceStateStore.getState().connectionType === "none";
        if (isOffline) {
          console.info("[QueueRepairService] Maintenance worker: offline, skipping check.");
          return;
        }

        const N = queue.length;
        const tracksToMaintenance = [];
        
        // current, next, next-next
        tracksToMaintenance.push({ index: currentIndex, track: currentTrack });
        const nextIdx = (currentIndex + 1) % N;
        tracksToMaintenance.push({ index: nextIdx, track: queue[nextIdx] });
        const nextNextIdx = (currentIndex + 2) % N;
        tracksToMaintenance.push({ index: nextNextIdx, track: queue[nextNextIdx] });

        for (const entry of tracksToMaintenance) {
          const { index, track } = entry;
          if (!track) continue;

          if (useSourceHealthStore.getState().isCooldownActive(track.id)) {
            console.info(`[QueueMaintenanceWorker] Skipped proactive maintenance: track currently in cooldown (id: ${track.id}, title: "${track.title}")`);
            continue;
          }

          // Only maintenance if stale (> 6 hours)
          if (isSourceStale(track)) {
            console.info(`[QueueMaintenanceWorker] Proactively refreshing stale track: "${track.title}"`);
            try {
              const refreshed = await ensurePlayableTrack(track);
              
              const latestStore = usePlayerStore.getState();
              const newQueue = [...latestStore.queue];
              const actualIndex = newQueue.findIndex(t => t.id === track.id);
              
              if (actualIndex !== -1) {
                const mergedTrack = { ...track, ...refreshed };
                newQueue[actualIndex] = mergedTrack;
                const isCurrent = latestStore.currentTrack?.id === track.id;
                
                usePlayerStore.setState({
                  queue: newQueue,
                  currentTrack: isCurrent ? mergedTrack : latestStore.currentTrack
                });
                
                await PlaybackService.updateMediaItem(actualIndex, mergedTrack);
                useTelemetryStore.getState().incrementMetric("streamRecoveryCount");
              }
            } catch (err) {
              console.warn(`[QueueMaintenanceWorker] Failed to proactively refresh "${track.title}":`, err);
            }
          }
        }
      } catch (err) {
        console.error("[QueueMaintenanceWorker] Error in periodic worker loop:", err);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  static stopMaintenanceWorker(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
  }
}
