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
    // [Phase 2.17] Disable JS queue repair since stream resolution is handled natively via BotGuard.
    return;
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
