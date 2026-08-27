/**
 * AuraMusic Native Core Bridge — React Native TypeScript API
 * 
 * This module provides typed access to the native Kotlin AuraPlayerModule,
 * AuraYouTubeModule, and AuraHistoryModule via React Native's NativeModules.
 * 
 * IMPORTANT: This replaces the FastAPI path for playback and search.
 * React Native only provides videoIds — all stream resolution happens natively.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────

export interface NativeTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number;
  artworkUrl: string | null;
}

export interface NativePlaybackState {
  isPlaying: boolean;
  currentTrackId: string | null;
  positionMs: number;
  durationMs: number;
  isBuffering: boolean;
  error: string | null;
}

export interface NativeHistoryEntry {
  id: string;
  trackId: string;
  timestamp: number;
  listenDuration: number;
  completed: boolean;
  skipped: boolean;
}

// ─── Native Module Interfaces ─────────────────────────────────────

interface AuraPlayerModuleInterface {
  playTrack(videoId: string, localUrl?: string | null): void;
  pause(): void;
  skipNext(): void;
  skipPrevious(): void;
  resume(): void;
  seekTo(positionMs: number): void;
  saveTrackMetadata(id: string, title: string, artist: string, album: string | null, duration: number, artworkUrl: string | null): void;
  skipNext(): void;
  skipPrevious(): void;
  setQueue(trackIds: string[]): void;
  stop(): void;
  getState(): Promise<NativePlaybackState>;
}

interface AuraYouTubeModuleInterface {
  search(query: string): Promise<NativeTrack[]>;
  getTrack(videoId: string): Promise<NativeTrack>;
  getArtistDetails(browseId: string): Promise<any>;
  getAlbumDetails(browseId: string): Promise<any>;
  searchArtists(query: string): Promise<any[]>;
  searchAlbums(query: string): Promise<any[]>;
}

interface AuraHistoryModuleInterface {
  getHistory(): Promise<NativeHistoryEntry[]>;
  clearHistory(): Promise<void>;
}

// ─── Module Access ────────────────────────────────────────────────

const isAndroid = Platform.OS === 'android';

export const AuraPlayer: AuraPlayerModuleInterface | null = isAndroid
  ? NativeModules.AuraPlayerModule
  : null;

export const AuraYouTube: AuraYouTubeModuleInterface | null = isAndroid
  ? NativeModules.AuraYouTubeModule
  : null;

export const AuraHistory: AuraHistoryModuleInterface | null = isAndroid
  ? NativeModules.AuraHistoryModule
  : null;

// ─── Event Emitter ────────────────────────────────────────────────

let _emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter | null {
  if (!isAndroid || !NativeModules.AuraPlayerModule) return null;
  if (!_emitter) {
    _emitter = new NativeEventEmitter(NativeModules.AuraPlayerModule);
  }
  return _emitter;
}

export function onPlaybackStateChanged(
  callback: (state: NativePlaybackState) => void
) {
  const emitter = getEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener('onPlaybackStateChanged', callback);
}

export function onTrackChanged(
  callback: (data: { event: string; trackId: string }) => void
) {
  const emitter = getEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener('onTrackChanged', callback);
}

// ─── Convenience ──────────────────────────────────────────────────

export function isNativeCoreAvailable(): boolean {
  return isAndroid && !!NativeModules.AuraPlayerModule;
}


