import TrackPlayer, { PlayerCommand } from "@rntp/player";
import { Platform } from "react-native";
import { PlayerTrack } from "../types/player";
import {
  getPlaybackSourceType,
  getUriScheme,
  normalizePlaybackUri,
} from "../utils/track-resolver";

function validateTrack(track: PlayerTrack): boolean {
  return !!(track && track.id && track.title);
}

function validateQueue(queue: PlayerTrack[]): boolean {
  return queue.every(validateTrack);
}

function isPlayableUri(uri?: string): boolean {
  const scheme = getUriScheme(normalizePlaybackUri(uri));
  return scheme === "file" || scheme === "content" || scheme === "http" || scheme === "https";
}

function toMediaItem(track: PlayerTrack) {
  return {
    mediaId: track.id,
    url: normalizePlaybackUri(track.url),
    title: track.title,
    artist: track.artist || "Local",
    type: "default" as const,
    artworkUrl: track.art || undefined,
    duration: track.duration,
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

        forwardInterval: 30,
        backwardInterval: 15,
      });
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
   * For local tracks, we load the whole queue into the native layer for better stability.
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

    const isLocal = !!normalizedTrack.isLocal;

    try {
      if (isLocal) {
        const isSupportedLocalUri = normalizedTrack.url.startsWith("file://") || normalizedTrack.url.startsWith("content://");

        if (!isSupportedLocalUri) {
          throw new Error("Invalid local file URI: must be file:// or content://");
        }
        
        const activeItem = await TrackPlayer.getActiveMediaItem();
        if (activeItem && activeItem.mediaId === normalizedTrack.id) {
          await TrackPlayer.play();
          return;
        }

        const { resolveTrack } = await import("../utils/track-resolver");
        const queueContainsTrack = queue.some(t => t.id === normalizedTrack.id);
        const queueForNative = queueContainsTrack ? queue : [normalizedTrack];
        const resolvedQueue = await Promise.all(
          queueForNative.map(t => t.id === normalizedTrack.id ? Promise.resolve(normalizedTrack) : resolveTrack(t))
        );
        const playableQueue = resolvedQueue
          .map(t => ({ ...t, url: normalizePlaybackUri(t.url) }))
          .filter(t => validateTrack(t) && isPlayableUri(t.url));

        if (!playableQueue.some(t => t.id === normalizedTrack.id)) {
          playableQueue.unshift(normalizedTrack);
        }

        const targetIndex = Math.max(0, playableQueue.findIndex(t => t.id === normalizedTrack.id));
        const mediaItems = playableQueue.map(toMediaItem);
        logSourceDiagnostics(normalizedTrack, mediaItems.length, targetIndex);
        
        await TrackPlayer.setMediaItems(mediaItems, targetIndex);

        await new Promise(resolve => setTimeout(resolve, 300));
        
        await TrackPlayer.play();
      } else {
        TrackPlayer.clear();
        logSourceDiagnostics(normalizedTrack, 1, 0);
        
        const mediaItem: any = {
          mediaId: normalizedTrack.id,
          url: normalizedTrack.url,
          title: normalizedTrack.title,
          artist: normalizedTrack.artist,
        };

        if (normalizedTrack.art && normalizedTrack.art.trim().length > 0) {
          mediaItem.artworkUrl = normalizedTrack.art;
        }

        TrackPlayer.setMediaItem(mediaItem);
        TrackPlayer.play();
      }
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

    try {
      const activeItem = await TrackPlayer.getActiveMediaItem();
      const isCurrentlyPlaying = await TrackPlayer.isPlaying();
      
      const { resolveTrack } = await import("../utils/track-resolver");
      const resolvedQueue = await Promise.all(queue.map(t => resolveTrack(t)));

      const mediaItems = resolvedQueue
        .map(t => ({ ...t, url: normalizePlaybackUri(t.url) }))
        .filter(t => validateTrack(t) && isPlayableUri(t.url))
        .map(toMediaItem);
      
      const targetIndex = startIndex !== -1 ? startIndex : 0;
      
      if (this.isReordering) {
        return;
      }
      
      this.isReordering = true;
      
      await TrackPlayer.setMediaItems(mediaItems, targetIndex);
      
      if (activeItem && isCurrentlyPlaying) {
        try {
          await TrackPlayer.play();
        } catch (e) {}
      }
      
      setTimeout(() => {
        this.isReordering = false;
      }, 100);
      
    } catch (e) {
      console.error("[Player] Native queue update failed:", e);
      this.isReordering = false;
    }
  }

  static play(): void {
    if (Platform.OS === "web") return;
    TrackPlayer.play();
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
    TrackPlayer.setVolume(volume);
  }

  static setRepeatMode(mode: string): void {
    if (Platform.OS === "web") return;
    // v5 setRepeatMode takes 'off', 'track', or 'queue'
    TrackPlayer.setRepeatMode(mode as any);
  }
}
