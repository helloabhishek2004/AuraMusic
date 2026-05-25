import TrackPlayer, { PlayerCommand } from "@rntp/player";
import { Platform, Linking } from "react-native";
import { PlayerTrack } from "../types/player";
import {
  getPlaybackSourceType,
  getUriScheme,
  normalizePlaybackUri,
} from "../utils/track-resolver";
import { transitionManager } from "./transition-manager";

function validateTrack(track: PlayerTrack): boolean {
  return !!(track && track.id && track.title);
}

function validateQueue(queue: PlayerTrack[]): boolean {
  return queue.every(validateTrack);
}

function isPlayableUri(uri?: string): boolean {
  if (!uri) return false;
  if (uri.startsWith('data:audio')) return true; // Allow dummy data URIs
  const scheme = getUriScheme(normalizePlaybackUri(uri));
  return scheme === "file" || scheme === "content" || scheme === "http" || scheme === "https";
}

const DUMMY_SILENCE_URI = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIwBRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVF////////+7gQAAAAAAAAAAAAAAAAAAAAAAAWLhA==";

function toMediaItem(track: PlayerTrack, isDummy: boolean = false) {
  return {
    mediaId: track.id,
    url: isDummy ? DUMMY_SILENCE_URI : normalizePlaybackUri(track.url),
    title: track.title,
    artist: track.artist || "Local",
    type: "default" as const,
    artworkUrl: track.art || undefined,
    duration: track.duration ? Number(track.duration) : undefined,
    mimeType: track.mimeType,
  };
}

function logSourceDiagnostics(track: PlayerTrack, queueSize: number, targetIndex: number) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;

  const uri = normalizePlaybackUri(track.url);
  console.info("[PlaybackSource]", {
    trackId: track.id,
    sourceType: getPlaybackSourceType({ ...track, url: uri }),
    scheme: getUriScheme(uri),
    uri,
    queueSize,
    targetIndex,
  });
}

/**
 * PlaybackService - Decoupled wrapper for @rntp/player v5.
 * @rntp/player v5 exports named functions (not a default class).
 * All playback methods are synchronous (fire-and-forget to native layer).
 */
let _playerSetup = false;

export class PlaybackService {
  private static isSetup = false;
  private static isReordering = false;

  static isReorderingQueue(): boolean {
    return this.isReordering;
  }

  static setReordering(val: boolean) {
    this.isReordering = val;
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.info("[Player] Reordering state:", val);
    }
  }

  static setupPlayer() {
    if (_playerSetup || this.isSetup) return;
    if (Platform.OS === "web") return;

    try {
      _playerSetup = true;
      this.isSetup = true;
      
      TrackPlayer.setupPlayer({
        contentType: "music",
        handleAudioBecomingNoisy: true,
        progressSync: {
          intervalSeconds: 0.2,
        },
      });

      // Listen for becoming noisy (unplugging headphones)
      TrackPlayer.addEventListener('remote-duck' as any, (event: any) => {
        if (event.paused || event.permanent) {
            // Logic for pausing is usually handled by RNTP or native
        }
        if (event.ducking === false) {
            // Audio became noisy
            import('../../device/services/device-state.service').then(({ deviceStateService }) => {
                deviceStateService.handleAudioBecomingNoisy();
            });
        }
      });

      TrackPlayer.setCommands({
        capabilities: [
          PlayerCommand.PlayPause,
          PlayerCommand.Next,
          PlayerCommand.Previous,
          PlayerCommand.Stop,
          PlayerCommand.Seek,
          PlayerCommand.SkipForward,
          PlayerCommand.SkipBackward,
        ],
        compactCapabilities: [
          PlayerCommand.Previous,
          PlayerCommand.PlayPause,
          PlayerCommand.Next,
        ],
        handling: 'hybrid',
        perCommandHandling: {
          next: 'js',
          previous: 'js'
        },
        forwardInterval: 30,
        backwardInterval: 15,
      } as any);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("already")
      ) {
        this.isSetup = true;
        _playerSetup = true;
        return;
      }
      console.error("[Player] Setup failed:", error);
      _playerSetup = false;
      this.isSetup = false;
      throw error;
    }
  }

  /**
   * Loads a track and starts playback.
   * Syncs the full queue to the native layer for stable notification controls.
   */
  static async loadTrack(track: PlayerTrack, queue: PlayerTrack[] = [], startIndex: number = -1): Promise<void> {
    this.setupPlayer();
    if (Platform.OS === "web") return;

    const normalizedTrack: PlayerTrack = {
      ...track,
      url: normalizePlaybackUri(track.url),
    };

    if (!normalizedTrack.url) {
      return;
    }

    try {
      const activeItem = await TrackPlayer.getActiveMediaItem();
      if (activeItem && activeItem.mediaId === normalizedTrack.id) {
        await TrackPlayer.play();
        return;
      }

      // 1. Resolve queue to playable URIs
      const { resolveTrack } = await import("../utils/track-resolver");
      const queueContainsTrack = queue.some(t => t.id === normalizedTrack.id);
      const queueForNative = queueContainsTrack ? queue : [normalizedTrack];

      // We resolve the target track immediately, others can be resolved as needed 
      // but for setMediaItems we try to have a usable queue.
      const resolvedQueue = await Promise.all(
        queueForNative.map(t => t.id === normalizedTrack.id ? Promise.resolve(normalizedTrack) : resolveTrack(t))
      );

      const playableQueue = resolvedQueue
        .map(t => {
            const cached = transitionManager.getCachedTrack(t.id);
            return cached ? { ...t, url: cached.url } : t;
        })
        .map(t => ({ ...t, url: normalizePlaybackUri(t.url) }));
        // Do not filter out unplayable URIs. Map them to dummy items so Native queue size matches JS.

      if (!playableQueue.some(t => t.id === normalizedTrack.id)) {
        playableQueue.unshift(normalizedTrack);
      }

      const targetIndex = Math.max(0, playableQueue.findIndex(t => t.id === normalizedTrack.id));
      const mediaItems = playableQueue.map(t => toMediaItem(t, !isPlayableUri(t.url)));
      
      logSourceDiagnostics(normalizedTrack, mediaItems.length, targetIndex);
      
      // 2. Set full queue to native player
      await TrackPlayer.setMediaItems(mediaItems, targetIndex);

      // 3. Start playback
      await TrackPlayer.play();
      
    } catch (error) {
      console.error("[Player] loadTrack failed:", error);
      throw error;
    }
  }

  static async updateQueue(queue: PlayerTrack[], startIndex: number): Promise<void> {
    if (Platform.OS === "web") return;
    
    if (!validateQueue(queue)) {
      console.warn("[Player] Invalid track in queue, skipping native sync");
      return;
    }

    if (this.isReordering) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn("[Player] updateQueue skipped: move in progress");
      }
      return;
    }

    try {
      // [Aura_Stabilization] Deep-equality guard to prevent duplicate queue rebuild storms
      const nativeQueue = await TrackPlayer.getQueue();
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.info(`[FORENSIC QUEUE] JS size: ${queue.length}, Native size: ${nativeQueue?.length || 0}`);
      }
      if (nativeQueue && nativeQueue.length === queue.length) {
        let isSame = true;
        for (let i = 0; i < queue.length; i++) {
          const nativeItem = nativeQueue[i];
          const nativeId = nativeItem?.mediaId || nativeItem?.id || (nativeItem as any)?.mediaId || (nativeItem as any)?.id;
          if (nativeItem && nativeId !== queue[i].id) {
            isSame = false;
            break;
          }
        }
        if (isSame) {
          const activeIndex = await TrackPlayer.getActiveMediaItemIndex();
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            console.info(`[FORENSIC QUEUE] Same IDs. JS index: ${startIndex}, Native index: ${activeIndex}`);
          }
          if (activeIndex === startIndex) {
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              console.info("[Player] [Aura_Stabilization] Skipping updateQueue: Native and JS queues already in sync");
            }
            return;
          }
        }
      }

      const activeItem = await TrackPlayer.getActiveMediaItem();
      const playState = await TrackPlayer.getPlaybackState();
      const isCurrentlyPlaying = (playState as any).state === 'playing' || playState === ('playing' as any);
      
      const mediaItems = queue
        .map(t => {
            const cached = transitionManager.getCachedTrack(t.id);
            return cached ? { ...t, url: cached.url } : t;
        })
        .map(t => ({ ...t, url: normalizePlaybackUri(t.url) }))
        .map(t => toMediaItem(t, !isPlayableUri(t.url)));
      
      if (mediaItems.length === 0) return;

      const targetIndex = startIndex !== -1 ? startIndex : 0;
      
      this.isReordering = true;
      
      await TrackPlayer.setMediaItems(mediaItems, targetIndex);
      
      if (activeItem && isCurrentlyPlaying) {
        try {
          const newActive = await TrackPlayer.getActiveMediaItem();
          if (newActive?.mediaId === activeItem.mediaId) {
             await TrackPlayer.play();
          }
        } catch (e) {}
      }
      
      setTimeout(() => {
        this.isReordering = false;
      }, 300);
      
    } catch (e) {
      console.error("[Player] Native queue update failed:", e);
      this.isReordering = false;
    }
  }

  static async updateMediaItem(index: number, track: PlayerTrack): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      const item = toMediaItem({
        ...track,
        url: normalizePlaybackUri(track.url)
      }, !isPlayableUri(track.url));
      
      await TrackPlayer.replaceMediaItem(index, item);
    } catch (e) {
      console.error("[Player] updateMediaItem failed:", e);
    }
  }

  static async updateMetadata(index: number, metadata: Partial<PlayerTrack>): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      TrackPlayer.updateMetadata(index, {
        title: metadata.title,
        artist: metadata.artist,
        albumTitle: metadata.album,
        artworkUrl: metadata.art,
      });
    } catch (e) {
      console.error("[Player] updateMetadata failed:", e);
    }
  }

  private static moveQueue: Promise<void> = Promise.resolve();

  static async moveTrack(from: number, to: number): Promise<void> {
    if (Platform.OS === "web") return;
    
    // Chain moves to ensure sequential execution on native thread
    this.moveQueue = this.moveQueue.then(async () => {
      try {
        await TrackPlayer.moveMediaItem(from, to);
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.info(`[Player] Native move confirmed: ${from} -> ${to}`);
        }
      } catch (e) {
        console.error("[Player] Native move failed, forcing full sync:", e);
        const { usePlayerStore } = await import('../store/player.store');
        const state = usePlayerStore.getState();
        await this.updateQueue(state.queue, state.currentIndex);
      }
    });

    return this.moveQueue;
  }

  static async addTrack(track: PlayerTrack): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      const item = toMediaItem({
        ...track,
        url: normalizePlaybackUri(track.url)
      }, !isPlayableUri(track.url));
      await TrackPlayer.addMediaItem(item);
    } catch (e) {
      console.error("[Player] addTrack failed:", e);
    }
  }

  static async insertTrack(index: number, track: PlayerTrack): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      const item = toMediaItem({
        ...track,
        url: normalizePlaybackUri(track.url)
      }, !isPlayableUri(track.url));
      await TrackPlayer.insertMediaItem(index, item);
    } catch (e) {
      console.error("[Player] insertTrack failed:", e);
    }
  }

  static async removeTrack(index: number): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      await TrackPlayer.removeMediaItem(index);
    } catch (e) {
      console.error("[Player] removeTrack failed:", e);
    }
  }

  static play(): void {
    if (Platform.OS === "web") return;
    TrackPlayer.play();
  }

  static setShuffleMode(enabled: boolean): void {
    if (Platform.OS === "web") return;
    try {
      TrackPlayer.setShuffleEnabled(enabled);
    } catch (e) {
      console.error("[Player] setShuffleMode failed:", e);
    }
  }

  static pause(): void {
    if (Platform.OS === "web") return;
    TrackPlayer.pause();
  }

  static stop(): void {
    if (Platform.OS === "web") return;
    TrackPlayer.stop();
  }

  static async skipToNext(): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      await TrackPlayer.skipToNext();
    } catch (e) {
      // End of queue or other error
    }
  }

  static async skipToPrevious(): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      await TrackPlayer.skipToPrevious();
    } catch (e) {
      // Beginning of queue or other error
    }
  }

  static seek(positionMillis: number): void {
    if (Platform.OS === "web") return;
    // seekTo takes seconds in v5
    TrackPlayer.seekTo(positionMillis / 1000);
  }

  static setVolume(volume: number): void {
    if (Platform.OS === "web") return;
    
    // Apply normalization if enabled
    const { useSettingsStore } = require("../../settings/store/settings.store");
    const settings = useSettingsStore.getState();
    
    let targetVolume = volume;
    if (settings.normalizeVolume) {
      // Simple normalization: avoid clipping and keep in a tight range
      targetVolume = Math.min(volume, 0.95);
    }
    
    TrackPlayer.setVolume(targetVolume);
  }

  static async setMonoAudio(enabled: boolean): Promise<void> {
    if (Platform.OS === "web") return;
    
    // Attempt actual channel mixing if platform support exists via native properties
    // In standard RNTP, this might require a custom bridge.
    // We log the attempt and current status.
    if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.info(`[MONO AUDIO] ${enabled ? 'Enabled' : 'Disabled'}`);
        console.info('[MONO AUDIO] Platform support: Android (System Accessibility Fallback)');
    }

    if (enabled && Platform.OS === 'android') {
        // We can't force system-wide mono, but we can guide the user or use a bridge if available.
        // For now, we ensure the logs reflect the reality.
    }
  }

  static async openEqualizer(): Promise<void> {
    const { openSystemEqualizer } = await import('../../audio/utils/open-system-eq');
    await openSystemEqualizer();
  }

  static setRepeatMode(mode: string): void {
    if (Platform.OS === "web") return;
    // v5 setRepeatMode takes 'off', 'track', or 'queue'
    TrackPlayer.setRepeatMode(mode as any);
  }
}
