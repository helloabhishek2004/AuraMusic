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
          PlayerCommand.Repeat,
          PlayerCommand.Like,
          PlayerCommand.Dislike,
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
   * videoId is resolved to a real stream URL in the store before calling this.
   */
  static loadTrack(track: PlayerTrack): void {
    this.setupPlayer();
    if (Platform.OS === "web") return;

    if (!track.url) {
      console.error("[Player] Track URL is missing during loadTrack.");
      return;
    }

    console.log("[Player] Loading real stream:", {
      id: track.id,
      title: track.title,
      artist: track.artist,
      isResolved: track.url.includes("googlevideo.com") || track.url.includes("manifest"),
    });

    try {
      // clear() replaces reset() in v5 — clears queue
      TrackPlayer.clear();

      // MediaItem in v5 uses mediaId (optional) and artworkUrl (not artwork)
      TrackPlayer.setMediaItem({
        mediaId: track.id,
        url: track.url,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.art,
      });

      TrackPlayer.play();
    } catch (error) {
      console.error("[Player] Failed to load track:", error);
      throw error;
    }
  }

  static play(): void {
    if (Platform.OS === "web") return;
    console.log("[Player] PlaybackService.play()");
    TrackPlayer.play();
  }

  static pause(): void {
    if (Platform.OS === "web") return;
    console.log("[Player] PlaybackService.pause()");
    TrackPlayer.pause();
  }

  static stop(): void {
    if (Platform.OS === "web") return;
    console.log("[Player] PlaybackService.stop()");
    TrackPlayer.stop();
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
