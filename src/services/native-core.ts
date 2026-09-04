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
  currentMediaIndex?: number;
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
  saveTracksMetadata(tracks: Array<{ id: string; title: string; artist: string; album?: string | null; duration?: number; artworkUrl?: string | null; art?: string | null }>): void;
  setQueue(trackIds: string[]): void;
  appendQueue(trackIds: string[]): void;
  setRepeatMode(mode: string): void;
  setVolume(volume: number): void;
  stop(): void;
  getState(): Promise<NativePlaybackState>;
  clearNativeCache(): Promise<{ success: boolean; deletedBytes: number }>;
  setStreamingQuality(quality: string): Promise<boolean>;
  setCacheLimit(bytes: number): Promise<boolean>;
  getAudioSessionId(): Promise<number>;
  setNormalizeVolume(enabled: boolean): Promise<boolean>;
  openSystemEqualizer(): Promise<boolean>;
}

interface AuraYouTubeModuleInterface {
  search(query: string): Promise<NativeTrack[]>;
  searchUnified(query: string): Promise<any>;
  searchPlaylists(query: string): Promise<any[]>;
  getTrack(videoId: string): Promise<NativeTrack>;
  getArtistDetails(browseId: string): Promise<any>;
  getAlbumDetails(browseId: string): Promise<any>;
  searchArtists(query: string): Promise<any[]>;
  searchAlbums(query: string): Promise<any[]>;
  getRadioAutomix(videoId: string): Promise<any[]>;
}

interface AuraHistoryModuleInterface {
  getHistory(): Promise<NativeHistoryEntry[]>;
  clearHistory(): Promise<void>;
}

export interface NativeRoomPlaylist {
  id: string;
  name: string;
  title: string;
  description: string;
  mood: string;
  coverArt: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  liked: boolean;
  gradientColors: [string, string];
  trackIds: string[];
  trackSnapshots: Record<string, {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    art: string;
    artworkUrl: string;
    isDownloaded: boolean;
    isLocal: boolean;
  }>;
}

interface AuraPlaylistModuleInterface {
  getPlaylists(): Promise<NativeRoomPlaylist[]>;
  getPlaylist(id: string): Promise<NativeRoomPlaylist | null>;
  createPlaylist(
    id: string,
    title: string,
    description?: string | null,
    mood?: string | null,
    coverArt?: string | null,
    gradientPrimary?: string | null,
    gradientSecondary?: string | null
  ): Promise<boolean>;
  renamePlaylist(id: string, newName: string): Promise<boolean>;
  deletePlaylist(id: string): Promise<boolean>;
  addTrack(playlistId: string, track: any): Promise<boolean>;
  addTracks(playlistId: string, tracks: any[]): Promise<number>;
  removeTrack(playlistId: string, trackId: string): Promise<boolean>;
  reorderTracks(playlistId: string, trackIds: string[]): Promise<boolean>;
  clearPlaylist(playlistId: string): Promise<boolean>;
  syncPlaylistsFromJs(playlistsJson: string): Promise<number>;
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

export const AuraPlaylist: AuraPlaylistModuleInterface | null = isAndroid
  ? NativeModules.AuraPlaylistModule
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

// ─── Download Module Types & Access ────────────────────────────────

export interface NativeDownloadProgress {
  trackId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
}

export interface NativeDownloadState {
  trackId: string;
  state: number;
  stateName: string;
  isDownloaded: boolean;
  bytesDownloaded?: number;
  contentLength?: number;
  percentage?: number;
  error?: string;
}

export interface NativeDownloadedTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  duration: number;
  artworkUrl: string | null;
  isDownloaded: boolean;
  downloadedAt: number;
  contentLength: number;
}

export interface NativeStorageStats {
  downloadsBytes: number;
  songCacheBytes: number;
  databaseBytes: number;
  artworkCacheBytes: number;
  asyncStorageBytes: number;
  totalBytes: number;
}

interface AuraDownloadModuleInterface {
  startDownload(track: {
    id: string;
    title: string;
    artist: string;
    album?: string | null;
    duration?: number;
    artworkUrl?: string | null;
    artwork?: string | null;
    art?: string | null;
  }): Promise<boolean>;
  removeDownload(trackId: string): Promise<boolean>;
  pauseDownload(trackId: string): Promise<boolean>;
  resumeDownload(trackId: string): Promise<boolean>;
  getDownloadState(trackId: string): Promise<NativeDownloadState>;
  isTrackDownloaded(trackId: string): Promise<boolean>;
  getDownloadedTracks(): Promise<NativeDownloadedTrack[]>;
  getNativeStorageStats(): Promise<NativeStorageStats>;
  clearAllDownloads(): Promise<{ success: boolean; deletedBytes: number }>;
  setWifiOnly(wifiOnly: boolean): Promise<boolean>;
  setDownloadQuality(quality: string): Promise<boolean>;
  reconcileDownloads(): Promise<{
    checkedCount: number;
    repairedCount: number;
    orphanedDownloadCount: number;
    missingTrackIds: string[];
  }>;
  hydrateDownloads(): Promise<{
    totalChecked: number;
    artworkHydrated: number;
    metadataHydrated: number;
    repairedTracks: number;
  }>;
}

export const AuraDownload: AuraDownloadModuleInterface | null = isAndroid
  ? NativeModules.AuraDownloadModule
  : null;

// ─── Restore Module Types & Access ──────────────────────────────────

export interface AuraRestoreModuleInterface {
  isRestoredInstall(): Promise<{
    isRestored: boolean;
    isFreshInstall: boolean;
    markerExists: boolean;
    hasDurableData: boolean;
  }>;
  markInstallInitialized(): Promise<boolean>;
  checkpointWal(): Promise<{
    success: boolean;
    busy?: number;
    logPages?: number;
    checkpointedPages?: number;
    error?: string;
  }>;
  getRestoreDiagnostics(): Promise<{
    dbExists: boolean;
    dbBytes: number;
    rkStorageExists: boolean;
    rkStorageBytes: number;
    markerExists: boolean;
  }>;
  setGoogleSyncEnabled(enabled: boolean): Promise<boolean>;
  isGoogleSyncEnabled(): Promise<boolean>;
  triggerCloudSync(): Promise<{
    success: boolean;
    timestamp: number;
  }>;
}

export const AuraRestore: AuraRestoreModuleInterface | null = isAndroid
  ? NativeModules.AuraRestoreModule
  : null;

let _downloadEmitter: NativeEventEmitter | null = null;
function getDownloadEmitter(): NativeEventEmitter | null {
  if (!isAndroid || !NativeModules.AuraDownloadModule) return null;
  if (!_downloadEmitter) {
    _downloadEmitter = new NativeEventEmitter(NativeModules.AuraDownloadModule);
  }
  return _downloadEmitter;
}

export function onDownloadProgress(callback: (progress: NativeDownloadProgress) => void) {
  const emitter = getDownloadEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener('onDownloadProgress', callback);
}

export function onDownloadStateChanged(callback: (state: NativeDownloadState) => void) {
  const emitter = getDownloadEmitter();
  if (!emitter) return { remove: () => {} };
  return emitter.addListener('onDownloadStateChanged', callback);
}

// ─── Convenience ──────────────────────────────────────────────────

export function isNativeCoreAvailable(): boolean {
  return isAndroid && !!NativeModules.AuraPlayerModule;
}



