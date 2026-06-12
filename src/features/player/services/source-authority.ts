import { PlayerTrack } from "../types/player";
import { validateTrackSource } from "./source-validator";
import { isSourceStale } from "./source-freshness-policy";
import { PlaybackSourceError, PlaybackSourceErrorCategory } from "./playback-source-error";
import { useSourceHealthStore } from "../store/source-health.store";
import { useTelemetryStore } from "../store/telemetry.store";
import { useMediaCacheStore } from "../../cache/store/media-cache.store";
import { Platform } from "react-native";

/**
 * Resolves local track artwork using the 8-step fallback chain.
 * Caches successful results in useMediaCacheStore.
 */
async function resolveLocalArtwork(track: PlayerTrack): Promise<string> {
  const cacheStore = useMediaCacheStore.getState();
  
  // 1. Check Cached artwork first (Step 7)
  const cached = cacheStore.getCachedTrack(track.id);
  if (cached?.track?.art) {
    return cached.track.art;
  }

  // 2. Check if track already has valid art URI
  if (track.art && (track.art.startsWith("file://") || track.art.startsWith("content://"))) {
    cacheStore.cacheTrack(track, { art: track.art } as any);
    return track.art;
  }

  // 3. MediaStore album art (on Android, Step 2)
  if (Platform.OS === 'android') {
    try {
      const { LocalMusicService } = require("../../../services/local-music.service");
      const hasPerm = await LocalMusicService.hasPermission();
      if (hasPerm) {
        const MediaLibrary = require('expo-media-library');
        const assets = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
        });
        const foundAsset = assets.assets.find((a: any) => a.uri === track.id || a.uri === track.url);
        if (foundAsset && foundAsset.albumId) {
          const albumArtUri = `content://media/external/audio/albumart/${foundAsset.albumId}`;
          const FileSystem = require("expo-file-system/legacy");
          const info = await FileSystem.getInfoAsync(albumArtUri);
          if (info.exists) {
            cacheStore.cacheTrack(track, { art: albumArtUri } as any);
            return albumArtUri;
          }
        }
      }
    } catch (e) {
      console.warn("[ArtworkFallback] MediaStore check failed:", e);
    }
  }

  // 4. Check folder-level files (cover.jpg, folder.jpg, AlbumArt.jpg, Front.jpg)
  if (track.url && track.url.startsWith("file://")) {
    try {
      const FileSystem = require("expo-file-system/legacy");
      const parentDir = track.url.substring(0, track.url.lastIndexOf("/") + 1);
      const possibleNames = [
        "cover.jpg", "cover.jpeg", "cover.png",
        "folder.jpg", "folder.jpeg", "folder.png",
        "AlbumArt.jpg", "AlbumArt.png", "AlbumArt.jpeg",
        "Front.jpg", "Front.png", "Front.jpeg",
        "cover.JPG", "folder.JPG", "AlbumArt.JPG", "Front.JPG"
      ];
      for (const name of possibleNames) {
        const path = parentDir + name;
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          cacheStore.cacheTrack(track, { art: path } as any);
          return path;
        }
      }
    } catch (e) {
      console.warn("[ArtworkFallback] Folder-level lookup failed:", e);
    }
  }

  return "";
}

/**
 * Single authority responsible for guaranteeing a playable track source.
 * Performs checks on disk existence, local download availability, MediaStore indexing,
 * and fetches fresh streaming URLs when they are stale/expired.
 */
export async function ensurePlayableTrack(track: PlayerTrack): Promise<PlayerTrack> {
  if (!track) {
    throw new PlaybackSourceError("SOURCE_MISSING", "", "Track is null or undefined");
  }

  // 0. Cooldown check
  if (useSourceHealthStore.getState().isCooldownActive(track.id)) {
    useTelemetryStore.getState().incrementMetric("resolverCooldownHits");
    throw new PlaybackSourceError(
      "RESOLVE_FAILED", 
      track.id, 
      "Source resolution skipped: track is in cooldown due to consecutive failures"
    );
  }

  const isLocal = track.isLocal || track.url?.startsWith("file://") || track.url?.startsWith("content://");

  // 1. Local Track Path
  if (isLocal) {
    let art = track.art;
    try {
      art = await resolveLocalArtwork(track);
    } catch (e) {
      console.warn("[SourceAuthority] Failed to resolve artwork for local track:", e);
    }

    const validation = await validateTrackSource(track);
    if (validation.valid) {
      useSourceHealthStore.getState().registerSuccess(track.id);
      return { ...track, art, isLocal: true };
    }

    console.info(`[SourceAuthority] Local file check failed for "${track.title}" (${track.id}). Attempting local recovery path...`);

    // --- Local Recovery Path: downloads -> MediaStore ---
    
    // a. Check Downloads
    try {
      const { useDownloadStore } = require("../../download/store/download.store");
      const downloaded = useDownloadStore.getState().downloadedTracks[track.id];
      if (downloaded && downloaded.localAudioPath) {
        const localPath = downloaded.localAudioPath.startsWith('file://') 
          ? downloaded.localAudioPath 
          : 'file://' + downloaded.localAudioPath;
        
        const testTrack = { 
          ...track, 
          url: localPath, 
          isLocal: true,
          art: downloaded.localArtPath || art || downloaded.artworkUrl || downloaded.art
        };
        const exists = await validateTrackSource(testTrack);
        if (exists.valid) {
          console.info(`[SourceAuthority] Local recovery: restored "${track.title}" from downloads path.`);
          useTelemetryStore.getState().incrementMetric("localRecoveryCount");
          useSourceHealthStore.getState().registerSuccess(track.id);
          return testTrack;
        }
      }
    } catch (e) {
      console.warn("[SourceAuthority] Download recovery lookup failed:", e);
    }

    // b. Check MediaStore (local device scan search)
    try {
      const { LocalMusicService } = require("../../../services/local-music.service");
      const localTracks = await LocalMusicService.getLocalTracks();
      const found = localTracks.find((t: any) => 
        t.id === track.id || 
        (t.title && track.title && t.title.toLowerCase() === track.title.toLowerCase() && 
         t.artist && track.artist && t.artist.toLowerCase() === track.artist.toLowerCase())
      );
      if (found && found.localUri) {
        const testTrack = { 
          ...track, 
          url: found.localUri, 
          isLocal: true,
          art: found.art || art
        };
        const exists = await validateTrackSource(testTrack);
        if (exists.valid) {
          console.info(`[SourceAuthority] Local recovery: restored "${track.title}" from MediaStore.`);
          useTelemetryStore.getState().incrementMetric("localRecoveryCount");
          useSourceHealthStore.getState().registerSuccess(track.id);
          return testTrack;
        }
      }
    } catch (e) {
      console.warn("[SourceAuthority] MediaStore recovery lookup failed:", e);
    }

    // If both local recovery paths fail, throw LOCAL_FILE_MISSING immediately. Never proceed to streaming fallback or online resolver.
    useTelemetryStore.getState().incrementMetric("sourceErrorCount");
    useSourceHealthStore.getState().registerFailure(track.id);
    throw new PlaybackSourceError(
      "LOCAL_FILE_MISSING", 
      track.id, 
      `Local file not found on disk: "${track.title}"`
    );
  } else {
    // 2. Streaming Track URL check
    const validation = await validateTrackSource(track);
    if (validation.valid && !isSourceStale(track)) {
      useSourceHealthStore.getState().registerSuccess(track.id);
      return track;
    }
  }

  // 3. Resolve Fresh URL
  // Rule 2: Check connectivity. Resolver must never run offline.
  const { useDeviceStateStore } = require("../../device/store/device-state.store");
  const isOffline = useDeviceStateStore.getState().connectionType === "none";
  if (isOffline) {
    useTelemetryStore.getState().incrementMetric("sourceErrorCount");
    useSourceHealthStore.getState().registerFailure(track.id);
    throw new PlaybackSourceError("NETWORK_UNAVAILABLE", track.id, "Device is offline. Source resolution skipped.");
  }

  try {
    const { resolveAudioOnly } = require("../utils/track-resolver");
    const { musicService } = require("../../../services/api/music");
    
    // Invalidate stream caches to guarantee fresh URL signing
    musicService.invalidateStreamCache(track.id);
    const { useMediaCacheStore } = require("../../cache/store/media-cache.store");
    const cachedRecord = useMediaCacheStore.getState().getCachedTrack(track.id);
    if (cachedRecord && cachedRecord.track) {
      useMediaCacheStore.getState().cacheTrack({ ...cachedRecord.track, url: "" });
    }

    const resolved = await resolveAudioOnly({ ...track, url: "" }, null, true);
    
    // Validate resolved result
    const finalValidation = await validateTrackSource(resolved);
    if (!finalValidation.valid) {
      let category: PlaybackSourceErrorCategory = "RESOLVE_FAILED";
      if (finalValidation.reason === "missing") category = "SOURCE_MISSING";
      else if (finalValidation.reason === "expired") category = "SOURCE_EXPIRED";
      else if (finalValidation.reason === "invalid") category = "SOURCE_INVALID";
      else if (finalValidation.reason === "local_missing") category = "LOCAL_FILE_MISSING";
      
      throw new PlaybackSourceError(category, track.id, `Resolved URL failed validation: ${finalValidation.reason}`);
    }

    console.info(`[SourceAuthority] Successfully resolved fresh source for "${track.title}" (${track.id}).`);
    useTelemetryStore.getState().incrementMetric("streamRecoveryCount");
    useSourceHealthStore.getState().registerSuccess(track.id);

    return resolved;
  } catch (err: any) {
    useTelemetryStore.getState().incrementMetric("sourceErrorCount");
    useSourceHealthStore.getState().registerFailure(track.id);
    
    if (err instanceof PlaybackSourceError) {
      throw err;
    }
    throw new PlaybackSourceError("RESOLVE_FAILED", track.id, err.message || "Resolution failed");
  }
}
