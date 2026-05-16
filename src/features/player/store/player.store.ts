import { create } from "zustand";
import { PlaybackService } from "../services/playback.service";
import { musicService } from "../../../services/api/music";
import {
    PlaybackStatus,
    PlayerStore,
    PlayerTrack,
    RepeatMode,
} from "../types/player";

// Extend PlayerStore type for internal flags if needed, 
// but we'll stick to the defined interface and add private-ish state.
interface ExtendedPlayerStore extends PlayerStore {
  isPreloading: boolean;
}

export const usePlayerStore = create<ExtendedPlayerStore>((set, get) => ({
  // State
  currentTrack: null,
  originalQueue: [], 
  queue: [],         
  currentIndex: -1,
  status: "idle",
  isPlaying: false,
  isBuffering: false,
  duration: 0,
  position: 0,
  bufferedPosition: 0,
  volume: 1.0,
  repeatMode: "off",
  isShuffle: false,
  error: null,
  
  // Lyrics State
  lyrics: null as any,
  isLyricsLoading: false,

  // Transition / Sync State
  lastResolutionId: 0,
  preloadedTrack: null,
  isTransitioning: false,
  isPreloading: false,
  _lastVolumeSync: 0,

  // Actions
  setTrack: async (track: PlayerTrack) => {
    const resolutionId = ++get().lastResolutionId;
    
    // 1. Check if it's already the current track and playing
    if (get().currentTrack?.id === track.id && get().status === "playing") {
      return;
    }

    console.log(`[Player] setTrack -> ${track.title} (ID: ${resolutionId})`);
    
    // 2. Optimistic Update & Lock (Ensuring all status flags are set)
    set({ 
      isTransitioning: true,
      currentTrack: track,
      status: "buffering",
      isBuffering: true,
      isPlaying: false,
      position: 0,
      lyrics: null,
      error: null
    });

    try {
      // 3. STOP previous native playback to free resources
      await PlaybackService.stop();

      let resolvedTrack: PlayerTrack;

      // 4. Optimization: ONLY skip resolution if it's a known direct stream URL
      // We check for 'googlevideo.com' or 'manifest' which are typical for resolved streams
      // OR if it's a local track
      const isAlreadyResolved = track.isLocal || (track.url && (track.url.includes("googlevideo.com") || track.url.includes("manifest")));

      if (isAlreadyResolved) {
        console.log(`[Player] Using already resolved URL for ${track.id}`);
        resolvedTrack = track;
      } else {
        // 5. Check Preload Cache
        const preloaded = get().preloadedTrack;
        if (preloaded && preloaded.id === track.id && preloaded.url) {
          console.log(`[Player] Using cached preload for ${track.id}`);
          resolvedTrack = preloaded;
        } else {
          // 6. Resolve Stream
          const { streamUrl } = await musicService.resolveStream(track.id);
          
          // Stale check
          if (get().lastResolutionId !== resolutionId) {
            console.log(`[Player] Resolution ${resolutionId} is stale, aborting.`);
            return;
          }

          resolvedTrack = { ...track, url: streamUrl };
        }
      }

      // 7. Load into Engine
      await PlaybackService.loadTrack(resolvedTrack, get().queue, get().currentIndex);
      
      // 8. Finalize State
      set({ 
        currentTrack: resolvedTrack,
        status: "playing",
        isPlaying: true,
        isBuffering: false,
        isTransitioning: false,
        preloadedTrack: null // Clear used cache
      });

      // 9. Post-load tasks
      get().preloadNext();
      get().fetchLyrics(resolvedTrack);

    } catch (error) {
      if (get().lastResolutionId === resolutionId) {
        console.error(`[Player] setTrack failed (${resolutionId}):`, error);
        set({ 
          status: "error", 
          error: (error as Error).message || "Playback failed",
          isPlaying: false,
          isBuffering: false,
          isTransitioning: false
        });
      }
    }
  },

  preloadTrack: async (track: PlayerTrack) => {
    if (get().preloadedTrack?.id === track.id) return;
    
    set({ isPreloading: true });
    try {
      let resolvedUrl: string;
      if (track.isLocal) {
        resolvedUrl = track.url;
      } else {
        const { streamUrl } = await musicService.resolveStream(track.id);
        resolvedUrl = streamUrl;
      }
      
      set({ 
        preloadedTrack: { ...track, url: resolvedUrl },
        isPreloading: false 
      });
      return resolvedUrl;
    } catch (e) {
      set({ isPreloading: false });
      return null;
    }
  },

  fetchLyrics: async (track: PlayerTrack) => {
    if (!track || track.isLocal) return;
    set({ isLyricsLoading: true, lyrics: null });
    try {
      const response = await musicService.resolveLyrics(track);
      if (get().currentTrack?.id === track.id) {
        set({ lyrics: response, isLyricsLoading: false });
      }
    } catch (error) {
      if (get().currentTrack?.id === track.id) {
        set({ isLyricsLoading: false, lyrics: null });
      }
    }
  },

  preloadNext: async () => {
    const { queue, currentIndex, preloadedTrack, isPreloading } = get();
    if (queue.length === 0 || isPreloading) return;

    const nextIndex = (currentIndex + 1) % queue.length;
    const nextTrack = queue[nextIndex];

    if (!nextTrack || (preloadedTrack && preloadedTrack.id === nextTrack.id)) {
      return;
    }

    set({ isPreloading: true });
    console.log(`[Player] Preloading: ${nextTrack.title}`);
    
    try {
      let preloadData: PlayerTrack;
      
      if (nextTrack.isLocal) {
        preloadData = { ...nextTrack };
      } else {
        const { streamUrl } = await musicService.resolveStream(nextTrack.id);
        preloadData = { ...nextTrack, url: streamUrl };
      }
      
      // Check if we are still on the same context
      if (get().currentIndex === currentIndex) {
        set({ 
          preloadedTrack: preloadData,
          isPreloading: false
        });
        console.log(`[Player] Preload ready: ${nextTrack.title}`);
      } else {
        set({ isPreloading: false });
      }
    } catch (e) {
      set({ isPreloading: false });
    }
  },

  setQueue: async (tracks: PlayerTrack[], startIndex: number = 0) => {
    console.log(`[Player] setQueue (${tracks.length} items)`);
    
    const isShuffle = get().isShuffle;
    let activeQueue = [...tracks];
    let newStartIndex = startIndex;

    if (isShuffle) {
      const selectedTrack = tracks[startIndex];
      const otherTracks = tracks.filter((_, i) => i !== startIndex);
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
      }
      activeQueue = [selectedTrack, ...otherTracks];
      newStartIndex = 0;
    }

    set({ 
      originalQueue: tracks, 
      queue: activeQueue, 
      currentIndex: newStartIndex 
    });

    if (activeQueue[newStartIndex]) {
      await get().setTrack(activeQueue[newStartIndex]);
    }
  },

  play: async () => {
    try {
      await PlaybackService.play();
      set({ isPlaying: true, status: "playing" });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  pause: async () => {
    try {
      await PlaybackService.pause();
      set({ isPlaying: false, status: "paused" });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  togglePlayback: async () => {
    const { isPlaying, status, queue } = get();
    if (isPlaying) {
      await get().pause();
    } else {
      if (status === "idle" && queue.length > 0) {
        await get().setTrack(queue[0]);
      } else {
        await get().play();
      }
    }
  },

  stop: async () => {
    await PlaybackService.stop();
    set({ isPlaying: false, status: "idle", position: 0 });
  },

  next: async () => {
    const { queue, currentIndex, repeatMode, isTransitioning, currentTrack } = get();
    if (queue.length === 0 || isTransitioning) return;

    // 1. If Repeat is ON (track mode), restart the current track IMMEDIATELY
    if (repeatMode === "track" && currentTrack) {
      console.log("[Player] Repeat One: High-speed loop restart.");
      await get().seek(0);
      await get().play();
      return;
    }

    // 2. If it's a local track, we use native queue skipping for smoother transitions
    if (currentTrack?.isLocal) {
      console.log("[Player] Next (Local Mode)");
      await PlaybackService.skipToNext();
      return;
    }

    // 3. Otherwise (Online Mode or fallback), advance to next in queue
    let nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      // Queue mode: loop back to start, otherwise stop
      if (repeatMode === "queue") {
        nextIndex = 0;
      } else {
        console.log("[Player] End of queue reached.");
        return;
      }
    }

    set({ currentIndex: nextIndex });
    await get().setTrack(queue[nextIndex]);
  },

  previous: async () => {
    const { queue, currentIndex, position, isTransitioning, repeatMode, currentTrack } = get();
    if (queue.length === 0 || isTransitioning) return;

    // If Repeat is ON or we are past 5s, just restart current track
    if (position > 5000 || repeatMode === "track") {
      await get().seek(0);
      return;
    }

    // If it's a local track, use native queue skipping
    if (currentTrack?.isLocal) {
      console.log("[Player] Previous (Local Mode)");
      await PlaybackService.skipToPrevious();
      return;
    }

    // Otherwise, move to previous track in queue
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      // Queue mode: loop to last track
      if (repeatMode === "queue" && queue.length > 0) {
        prevIndex = queue.length - 1;
      } else {
        await get().seek(0);
        return;
      }
    }

    set({ currentIndex: prevIndex });
    await get().setTrack(queue[prevIndex]);
  },



  seek: async (position: number) => {
    try {
      await PlaybackService.seek(position);
      set({ position });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setVolume: async (volume: number) => {
    const currentVol = get().volume;
    if (Math.abs(currentVol - volume) < 0.01) return;
    
    // 1. Store Update (Instant UI feedback)
    set({ volume });

    // 2. Native Update (Throttled to 100ms)
    const now = Date.now();
    const lastSync = (get() as any)._lastVolumeSync || 0;
    if (now - lastSync < 100) return; 

    set({ _lastVolumeSync: now } as any);
    await PlaybackService.setVolume(volume);
  },

  setRepeatMode: (mode: RepeatMode) => {
    PlaybackService.setRepeatMode(mode);
    set({ repeatMode: mode });
  },

  toggleShuffle: () => {
    const { isShuffle, originalQueue, currentTrack } = get();
    const newShuffle = !isShuffle;
    
    let newQueue = [...originalQueue];
    let newIndex = originalQueue.findIndex((t: PlayerTrack) => t.id === currentTrack?.id);

    if (newShuffle) {
      const otherTracks = originalQueue.filter((t: PlayerTrack) => t.id !== currentTrack?.id);
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
      }
      newQueue = currentTrack ? [currentTrack, ...otherTracks] : otherTracks;
      newIndex = 0;
    }

    set({ isShuffle: newShuffle, queue: newQueue, currentIndex: newIndex });
  },

  updateProgress: (position: number, duration: number, buffered: number) => {
    const s = get();
    // More granular updates for smoother progress bar (100ms position delta)
    if (Math.abs(s.position - position) > 100 || Math.abs(s.duration - duration) > 100) {
      set({ position, duration, bufferedPosition: buffered });
    }
  },


  setStatus: (status: PlaybackStatus) => {
    const currentStatus = get().status;
    if (currentStatus === status) return;
    
    set({
      status,
      isPlaying: status === "playing",
      isBuffering: status === "buffering",
    });
  },
}));

