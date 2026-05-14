import TrackPlayer, { PlayerCommand } from "@rntp/player";
import { Platform } from "react-native";
import { PlayerTrack } from "../types/player";

/**
 * PlaybackService - Decoupled wrapper for @rntp/player v5.
 * @rntp/player v5 exports named functions (not a default class).
 * All playback methods are synchronous (fire-and-forget to native layer).
 */
export class PlaybackService {
  private static isSetup = false;

  static setupPlayer() {
    if (this.isSetup) return;
    if (Platform.OS === "web") return;

    console.log("[Player] Initializing TrackPlayer...");

    try {
      // setupPlayer is synchronous in @rntp/player v5
      TrackPlayer.setupPlayer({
        contentType: "music",
        handleAudioBecomingNoisy: true,
        progressSync: {
          intervalSeconds: 0.5, // Sync progress every 500ms
        },
      });

      // Configure remote control capabilities using setCommands
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

      this.isSetup = true;
      console.log("[Player] TrackPlayer initialized successfully.");
    } catch (error) {

      if (
        error instanceof Error &&
        error.message.includes("already")
      ) {
        this.isSetup = true;
        console.log("[Player] TrackPlayer already initialized.");
        return;
      }
      console.error("[Player] Failed to setup TrackPlayer:", error);
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

    if (!track.url) {
      console.error("[LocalPlayer] Track URL is missing.");
      return;
    }

    const isLocal = !!track.isLocal;

    try {
      if (isLocal) {
        console.log(`[LocalPlayer] Loading local track: ${track.title}`);
        console.log("[LocalPlayer] FINAL URI:", track.url);

        // Hard validation against file:// URIs
        if (track.url.startsWith("file://")) {
          console.error("[LocalPlayer] INVALID FILE URI DETECTED");
          throw new Error("Invalid local file URI: Scoped storage content URI required.");
        }
        
        // Optimization: Check if this track is already at the correct index in native queue
        const activeItem = await TrackPlayer.getActiveMediaItem();
        if (activeItem && activeItem.mediaId === track.id) {
          console.log("[LocalPlayer] Track already active, just playing.");
          await TrackPlayer.play();
          return;
        }

        // Diagnostic simplification for local tracks ONLY
        const mediaItems = queue.length > 0 ? queue.map(t => {
          const item = {
            mediaId: t.id,
            url: t.url,
            title: t.title,
            artist: t.artist || "Local",
            type: "default" as const
          };
          if (t.id === track.id) {
            console.log("[LocalPlayer] MediaItem Payload:", JSON.stringify(item, null, 2));
          }
          return item;
        }) : [{
          mediaId: track.id,
          url: track.url,
          title: track.title,
          artist: track.artist || "Local",
          type: "default" as const
        }];

        if (queue.length === 0) {
          console.log("[LocalPlayer] Single MediaItem Payload:", JSON.stringify(mediaItems[0], null, 2));
        }

        const targetIndex = startIndex !== -1 ? startIndex : 0;
        
        // Directly call setMediaItems without stop/clear for local
        await TrackPlayer.setMediaItems(mediaItems, targetIndex);

        // Extended compatibility delay for local URIs
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await TrackPlayer.play();
        console.log("[LocalPlayer] Play command issued");
      } else {
        // Preserved online flow
        TrackPlayer.clear();
        
        const mediaItem: any = {
          mediaId: track.id,
          url: track.url,
          title: track.title,
          artist: track.artist,
        };

        if (track.art && track.art.trim().length > 0) {
          mediaItem.artworkUrl = track.art;
        }

        TrackPlayer.setMediaItem(mediaItem);
        TrackPlayer.play();
      }
    } catch (error) {
      console.error("[LocalPlayer] Failed:", error);
      throw error;
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
    console.log("[Player] PlaybackService.seek(", positionMillis, ")");
    // seekTo takes seconds in v5
    TrackPlayer.seekTo(positionMillis / 1000);
  }

  static setVolume(volume: number): void {
    if (Platform.OS === "web") return;
    console.log("[Player] PlaybackService.setVolume(", volume, ")");
    TrackPlayer.setVolume(volume);
  }

  static setRepeatMode(mode: string): void {
    if (Platform.OS === "web") return;
    console.log("[Player] PlaybackService.setRepeatMode(", mode, ")");
    // v5 setRepeatMode takes 'off', 'track', or 'queue'
    TrackPlayer.setRepeatMode(mode as any);
  }
}
