import { create } from "zustand";
import { PlaybackService } from "../services/playback.service";
import { transitionManager } from "../services/transition-manager";
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
  isReordering: boolean;
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
  previousTrack: null,
  isTransitioning: false,
  isPreloading: false,
  isReordering: false,
  _lastVolumeSync: 0,

  // Actions
  setTrack: async (track: PlayerTrack) => {
    const resolutionId = ++get().lastResolutionId;
    const currentTrack = get().currentTrack;
    
    if (currentTrack?.id === track.id && get().status === "playing") {
      transitionManager.setTransitioning(false);
      return;
    }

    set({ 
      isTransitioning: true,
      previousTrack: currentTrack,
      currentTrack: track,
      status: "buffering",
      isBuffering: true,
      isPlaying: false,
      position: 0,
      lyrics: null,
      error: null
    });

    try {
      await PlaybackService.stop();

      const { resolveFullTrack } = await import("../utils/track-resolver");
      const resolvedTrack = await resolveFullTrack(track, get().preloadedTrack);
      
      if (get().lastResolutionId !== resolutionId) {
        transitionManager.setTransitioning(false);
        set({ isTransitioning: false });
        return;
      }

      await PlaybackService.loadTrack(resolvedTrack, get().queue, get().currentIndex);
      
      set({ 
        currentTrack: resolvedTrack,
        status: "playing",
        isPlaying: true,
        isBuffering: false,
        isTransitioning: false,
        preloadedTrack: null
      });

      transitionManager.setTransitioning(false);
      transitionManager.clearCache([resolvedTrack.id]);
      
      get().preloadNext();
      get().fetchLyrics(resolvedTrack);

    } catch (error) {
      if (get().lastResolutionId === resolutionId) {
        transitionManager.setTransitioning(false);
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
    if (get().preloadedTrack?.id === track.id) return get().preloadedTrack?.url || null;
    
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
    const { queue, currentIndex, preloadedTrack, isPreloading, currentTrack } = get();
    if (queue.length === 0 || isPreloading || !currentTrack) return;

    const nextIndex = (currentIndex + 1) % queue.length;
    const nextTrack = queue[nextIndex];

    if (!nextTrack) return;
    if (preloadedTrack && preloadedTrack.id === nextTrack.id) return;
    if (transitionManager.getCachedTrack(nextTrack.id)) return;

    set({ isPreloading: true });
    
    const cached = await transitionManager.preloadNextTrack(nextTrack, currentTrack.id);
    
    if (cached && get().currentIndex === nextIndex) {
      set({ preloadedTrack: cached, isPreloading: false });
      
      const secondIndex = (nextIndex + 1) % queue.length;
      if (secondIndex !== nextIndex && queue[secondIndex]) {
        transitionManager.preloadSecondaryTrack(queue[secondIndex], currentTrack.id);
      }
    } else {
      set({ isPreloading: false });
    }
  },

  setQueue: async (tracks: PlayerTrack[], startIndex: number = 0) => {
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

  playNext: (track: PlayerTrack) => {
    const { queue, originalQueue, currentIndex, currentTrack } = get();
    
    const newQueue = [...queue];
    newQueue.splice(currentIndex + 1, 0, track);
    
    const newOriginal = [...originalQueue];
    if (!newOriginal.find(t => t.id === track.id)) {
      newOriginal.push(track);
    }
    
    set({ queue: newQueue, originalQueue: newOriginal });
    
    if (currentTrack?.isLocal) {
      PlaybackService.updateQueue(newQueue, currentIndex);
    }
  },

  addToQueue: (track: PlayerTrack) => {
    const { queue, originalQueue, currentIndex, currentTrack } = get();
    
    const newQueue = [...queue, track];
    const newOriginal = [...originalQueue];
    if (!newOriginal.find(t => t.id === track.id)) {
      newOriginal.push(track);
    }
    
    set({ queue: newQueue, originalQueue: newOriginal });
    
    if (currentTrack?.isLocal) {
      PlaybackService.updateQueue(newQueue, currentIndex);
    }
  },

  removeFromQueue: (index: number) => {
    const { queue, currentIndex, currentTrack } = get();
    if (index < 0 || index >= queue.length) return;
    
    // Prevent removing currently playing track
    if (index === currentIndex) {
      return;
    }
    
    const newQueue = [...queue];
    newQueue.splice(index, 1);
    
    let newIndex = currentIndex;
    if (index < currentIndex) {
      newIndex--;
    }
    
    set({ queue: newQueue, currentIndex: newIndex });
    
    // Only sync with native for local tracks
    if (currentTrack?.isLocal) {
      PlaybackService.updateQueue(newQueue, newIndex);
    }
  },

  reorderQueue: (from: number, to: number) => {
    const { queue, currentIndex, isReordering, currentTrack } = get();
    
    if (isReordering) {
      return;
    }

    const newQueue = [...queue];
    const [movedItem] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, movedItem);
    
    let newIndex = currentIndex;
    if (currentIndex === from) {
      newIndex = to;
    } else if (currentIndex > from && currentIndex <= to) {
      newIndex--;
    } else if (currentIndex < from && currentIndex >= to) {
      newIndex++;
    }
    
    set({ 
      queue: newQueue, 
      currentIndex: newIndex,
      isReordering: true 
    });
    
    const finishReorder = () => {
      setTimeout(() => {
        set({ isReordering: false });
      }, 50);
    };
    
    if (currentTrack?.isLocal) {
      PlaybackService.updateQueue(newQueue, newIndex);
      finishReorder();
    } else {
      finishReorder();
    }
  },

  jumpToQueueIndex: async (index: number) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    
    set({ currentIndex: index });
    await get().setTrack(queue[index]);
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
    
    if (transitionManager.getTransitionState()) return;

    transitionManager.setTransitioning(true);
    set({ isTransitioning: true });

    if (repeatMode === "track" && currentTrack) {
      transitionManager.setTransitioning(false);
      set({ isTransitioning: false });
      await get().seek(0);
      await get().play();
      return;
    }

    if (currentTrack?.isLocal) {
      transitionManager.setTransitioning(false);
      set({ isTransitioning: false });
      await PlaybackService.skipToNext();
      return;
    }

    let nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      if (repeatMode === "queue") {
        nextIndex = 0;
      } else {
        transitionManager.setTransitioning(false);
        set({ isTransitioning: false });
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (!nextTrack) {
      transitionManager.setTransitioning(false);
      set({ isTransitioning: false });
      return;
    }

    const cachedPreload = transitionManager.getCachedTrack(nextTrack.id);
    
    if (cachedPreload && transitionManager.validatePreload(cachedPreload)) {
      set({ currentIndex: nextIndex, preloadedTrack: cachedPreload });
    } else {
      set({ currentIndex: nextIndex });
    }
    
    await get().setTrack(cachedPreload || nextTrack);
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

    // Sync with native if it's a local queue session
    if (currentTrack?.isLocal) {
      PlaybackService.updateQueue(newQueue, newIndex);
    }
  },

  updateProgress: (position: number, duration: number, buffered: number) => {
    const s = get();
    if (Math.abs(s.position - position) > 100 || Math.abs(s.duration - duration) > 100) {
      set({ position, duration, bufferedPosition: buffered });
    }
    
    if (s.isPlaying && !s.isTransitioning && !s.isPreloading && transitionManager.shouldPreload(position, duration)) {
      const nextIndex = (s.currentIndex + 1) % s.queue.length;
      const nextTrack = s.queue[nextIndex];
      
      if (nextTrack && nextTrack.id !== s.currentTrack?.id) {
        transitionManager.preloadNextTrack(nextTrack, s.currentTrack?.id || '');
      }
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

  clearPreviousTrack: () => {
    set({ previousTrack: null });
  },
}));

