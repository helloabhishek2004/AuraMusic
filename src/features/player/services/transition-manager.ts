import { PlayerTrack } from "../types/player";
import { musicService } from "../../../services/api/music";

interface CachedTrack {
  track: PlayerTrack;
  timestamp: number;
}

class TransitionManager {
  private static instance: TransitionManager;
  private preloadedTracks: Map<string, CachedTrack> = new Map();
  private artworkCache: Map<string, boolean> = new Map();
  private isTransitioning = false;
  private isPreloading = false;
  private currentPreloadTrackId: string | null = null;
  private lastPreloadTime = 0;
  private preloadDebounceMs = 2000;

  static getInstance(): TransitionManager {
    if (!this.instance) {
      this.instance = new TransitionManager();
    }
    return this.instance;
  }

  shouldPreload(positionMs: number, durationMs: number): boolean {
    if (durationMs <= 0) return false;
    
    const progress = positionMs / durationMs;
    const remainingSeconds = (durationMs - positionMs) / 1000;
    
    // Level 3 Preloading: Start preloading stream URLs when progress >= 70% OR <= 45 seconds remain.
    return progress >= 0.70 || remainingSeconds <= 45;
  }

  async preloadNextTrack(nextTrack: PlayerTrack, currentTrackId: string): Promise<PlayerTrack | null> {
    if (!nextTrack || nextTrack.id === currentTrackId) return null;
    
    const cached = this.getCachedTrack(nextTrack.id);
    if (cached) {
      return cached;
    }

    if (this.isPreloading && this.currentPreloadTrackId === nextTrack.id) {
      return null;
    }

    const now = Date.now();
    if (now - this.lastPreloadTime < this.preloadDebounceMs) {
      return null;
    }

    this.isPreloading = true;
    this.currentPreloadTrackId = nextTrack.id;
    this.lastPreloadTime = now;
    
    try {
      let resolvedTrack: PlayerTrack;
      
      if (nextTrack.isLocal || (nextTrack.url && nextTrack.url.startsWith('http'))) {
        resolvedTrack = nextTrack;
      } else {
        const { streamUrl } = await musicService.resolveStream(nextTrack.id);
        resolvedTrack = { ...nextTrack, url: streamUrl };
      }

      if (!resolvedTrack.url) {
        this.isPreloading = false;
        this.currentPreloadTrackId = null;
        return null;
      }

      this.preloadedTracks.set(nextTrack.id, {
        track: resolvedTrack,
        timestamp: Date.now()
      });

      if (nextTrack.art) {
        this.artworkCache.set(nextTrack.art, true);
      }
      
      this.isPreloading = false;
      this.currentPreloadTrackId = null;
      return resolvedTrack;
    } catch (error) {
      this.isPreloading = false;
      this.currentPreloadTrackId = null;
      return null;
    }
  }

  async preloadSecondaryTrack(track: PlayerTrack, currentTrackId: string): Promise<void> {
    if (!track || track.id === currentTrackId) return;
    if (this.getCachedTrack(track.id)) return;

    try {
      let resolvedTrack: PlayerTrack;
      
      if (track.isLocal || (track.url && track.url.startsWith('http'))) {
        resolvedTrack = track;
      } else {
        const { streamUrl } = await musicService.resolveStream(track.id);
        resolvedTrack = { ...track, url: streamUrl };
      }

      if (resolvedTrack.url) {
        this.preloadedTracks.set(track.id, {
          track: resolvedTrack,
          timestamp: Date.now()
        });
      }
    } catch (e) {}
  }

  getCachedTrack(trackId: string): PlayerTrack | null {
    const cached = this.preloadedTracks.get(trackId);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.track;
    }
    return null;
  }

  setTransitioning(value: boolean): void {
    this.isTransitioning = value;
  }

  getTransitionState(): boolean {
    return this.isTransitioning;
  }

  clearCache(keepIds: string[] = []) {
    for (const [id] of this.preloadedTracks) {
      if (!keepIds.includes(id)) {
        this.preloadedTracks.delete(id);
      }
    }
  }

  validatePreload(track: PlayerTrack): boolean {
    if (!(track && track.id && track.url && track.url.length > 0)) return false;
    const cached = this.preloadedTracks.get(track.id);
    if (cached && Date.now() - cached.timestamp > 30000) return false;
    return true;
  }
}

export const transitionManager = TransitionManager.getInstance();