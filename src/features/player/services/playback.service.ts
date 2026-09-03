import { Platform } from "react-native";
import { PlayerTrack } from "../types/player";
import { AuraPlayer, isNativeCoreAvailable } from "../../../services/native-core";
import { extractRawArtworkUrl } from "../utils/track-identity";

/**
 * PlaybackService - Decoupled wrapper for the Native AuraPlayer.
 * Replaces react-native-track-player and FastAPI resolution.
 */
export class PlaybackService {
  private static isReordering = false;

  static isReorderingQueue(): boolean {
    return this.isReordering;
  }

  static setReordering(val: boolean) {
    this.isReordering = val;
  }

  static setupPlayer() {
    // Native player is initialized automatically on the Kotlin side
  }

  /**
   * Loads a track and starts playback.
   * Hands off videoId to the native AuraPlayer for internal resolution and playback.
   */
  static async loadTrack(track: PlayerTrack, queue: PlayerTrack[] = [], startIndex: number = -1): Promise<void> {
    if (Platform.OS === "web") return;

    if (!isNativeCoreAvailable() || !AuraPlayer) {
      console.warn("AuraPlayer native core is not available. Ensure Expo modules are compiled.");
      return;
    }

    try {
      // Pass the entire queue IDs and complete metadata to the native layer
      if (queue.length > 0) {
        AuraPlayer.setQueue(queue.map(t => t.id));
        if (typeof AuraPlayer.saveTracksMetadata === 'function') {
          AuraPlayer.saveTracksMetadata(
            queue.map(t => ({
              id: t.id,
              title: t.title,
              artist: t.artist || 'Unknown Artist',
              album: t.album || null,
              duration: t.duration ? Number(t.duration) : 240,
              art: extractRawArtworkUrl(t) || null,
            }))
          );
        }
      }

      // Instruct native player to resolve and play the track ID
      const rawArt = extractRawArtworkUrl(track);
      AuraPlayer.saveTrackMetadata(
        track.id,
        track.title,
        track.artist || 'Unknown Artist',
        track.album || null,
        track.duration ? Number(track.duration) : 0,
        rawArt || null
      );
      
      const localUrl = (track.isLocal && track.url) ? track.url : null;
      AuraPlayer.playTrack(track.id, localUrl);
    } catch (error) {
      console.error("[PlaybackService] Failed to load track natively:", error);
    }
  }

  static async play(): Promise<void> {
    if (AuraPlayer) AuraPlayer.resume();
  }

  static async skipToNext(): Promise<void> {
    if (AuraPlayer) AuraPlayer.skipNext();
  }

  static async skipToPrevious(): Promise<void> {
    if (AuraPlayer) AuraPlayer.skipPrevious();
  }

  static async pause(): Promise<void> {
    if (AuraPlayer) AuraPlayer.pause();
  }

  static async seek(positionMs: number): Promise<void> {
    if (AuraPlayer) AuraPlayer.seekTo(positionMs);
  }

  static async getPosition(): Promise<number> {
    if (!AuraPlayer) return 0;
    try {
      const state = await AuraPlayer.getState();
      return state.positionMs / 1000;
    } catch (e) {
      return 0;
    }
  }

  static async getDuration(): Promise<number> {
    if (!AuraPlayer) return 0;
    try {
      const state = await AuraPlayer.getState();
      return state.durationMs / 1000;
    } catch (e) {
      return 0;
    }
  }

  static async reset(): Promise<void> {
    if (AuraPlayer) AuraPlayer.stop();
  }

  static async setRepeatMode(mode: string): Promise<void> {
    if (AuraPlayer) AuraPlayer.setRepeatMode(mode);
  }

  static async setVolume(volume: number): Promise<void> {
    if (AuraPlayer) AuraPlayer.setVolume(volume);
  }

  static async syncQueue(queue: PlayerTrack[], activeIndex: number = -1) {
    if (AuraPlayer && queue.length > 0) {
      AuraPlayer.setQueue(queue.map(t => t.id));
      if (typeof AuraPlayer.saveTracksMetadata === 'function') {
        AuraPlayer.saveTracksMetadata(
          queue.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist || 'Unknown Artist',
            album: t.album || null,
            duration: t.duration ? Number(t.duration) : 240,
            art: extractRawArtworkUrl(t) || null,
          }))
        );
      }
    }
  }

  static async reorderQueue(fromIdx: number, toIdx: number, currentQueue: PlayerTrack[], activeIndex: number) {
    this.syncQueue(currentQueue, activeIndex);
  }

  static async updateMetadata(trackId: string, metadata: Partial<PlayerTrack>) {
    // Native player fetches metadata internally
  }

  static async updateMediaItem(index: number, track: PlayerTrack) {
    // No-op: AuraPlayer resolves natively
  }
}
