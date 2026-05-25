import { PlayerTrack } from "../types/player";
import { musicService } from "../../../services/api/music";
import { transitionManager } from "../services/transition-manager";
import { useMediaCacheStore } from "../../cache/store/media-cache.store";

export type PlaybackSourceType = "stream" | "download" | "cache" | "local" | "unknown";

export function getUriScheme(uri?: string): string {
  const match = uri?.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return match?.[1]?.toLowerCase() || "";
}

export function isResolvedUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('file://') || url.startsWith('content://')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('youtube.com') || url.includes('youtu.be')) return false; // Not resolved yet
      return true; 
  }
  return false;
}

export function normalizePlaybackUri(uri?: string): string {
  if (!uri) return "";
  const trimmed = uri.trim();

  if (/^file:\/\/(?!\/)/i.test(trimmed)) {
    return `file:///${trimmed.slice("file://".length).replace(/^\/+/, "")}`;
  }

  return trimmed;
}

export function getPlaybackSourceType(track: PlayerTrack): PlaybackSourceType {
  const uri = normalizePlaybackUri(track.url);
  const scheme = getUriScheme(uri);

  if (track.isLocal && scheme === "content") return "local";
  if (track.isLocal && scheme === "file") {
    if (uri.includes("/aura/audio/")) return "download";
    if (uri.includes("/aura_tracks/")) return "cache";
    return "local";
  }
  if (scheme === "http" || scheme === "https") return "stream";
  return "unknown";
}

export async function resolveTrack(t: PlayerTrack, preloadedTrack?: PlayerTrack | null): Promise<PlayerTrack> {
  const directUrl = normalizePlaybackUri(t.url);
  const directScheme = getUriScheme(directUrl);
  const hasDownloadPath = !!(t as PlayerTrack & { localAudioPath?: string }).localAudioPath;

  if (t.isLocal && !hasDownloadPath && (directScheme === "file" || directScheme === "content")) {
    return { ...t, url: directUrl };
  }

  // 0. Check Cache First
  const cached = useMediaCacheStore.getState().getCachedTrack(t.id);
  if (cached && cached.track.url && isResolvedUrl(cached.track.url)) {
      // Basic validity check for local files
      if (cached.track.isLocal) {
          const { StorageService } = await import("../../download/services/storage.service");
          if (await StorageService.fileExists(cached.track.url)) {
              return { ...t, ...cached.track } as PlayerTrack;
          }
      } else {
          return { ...t, ...cached.track } as PlayerTrack;
      }
  }

  // 1. Check Downloads
  try {
    const { useDownloadStore } = await import("../../download/store/download.store");
    const { downloadedTracks } = useDownloadStore.getState();
    const downloaded = downloadedTracks[t.id];

    if (downloaded && downloaded.localAudioPath) {
      const localPath = normalizePlaybackUri(
        downloaded.localAudioPath.startsWith('file://') 
          ? downloaded.localAudioPath 
          : 'file://' + downloaded.localAudioPath
      );
      
      const { StorageService } = await import("../../download/services/storage.service");
      const exists = await StorageService.fileExists(localPath);
      const size = await StorageService.getFileSize(localPath);

      if (exists && size > 1024) {
        return { 
          ...t, 
          url: localPath,
          art: downloaded.localArtPath?.startsWith('file://') 
            ? downloaded.localArtPath 
            : (downloaded.localArtPath ? 'file://' + downloaded.localArtPath : t.art),
          isLocal: true 
        };
      } else {
        console.warn(`[TrackResolver] Download corrupted/missing for ${t.id}, falling back`);
        useDownloadStore.getState().removeDownload(t.id);
      }
    }
  } catch (e) {
    console.warn("[TrackResolver] Download check failed:", e);
  }

  // 2. Check Filesystem Cache
  try {
    const { CacheManager } = await import("../../download/services/cache.manager");
    if (await CacheManager.isCached(t.id)) {
      const cachePath = CacheManager.getCachePath(t.id);
      return {
        ...t,
        url: normalizePlaybackUri(cachePath.startsWith('file://') ? cachePath : 'file://' + cachePath),
        isLocal: true
      };
    }
  } catch (e) {
    console.warn("[TrackResolver] Cache check failed:", e);
  }

  // 3. Already resolved or Preloaded
  if (directUrl && (directUrl.includes("googlevideo.com") || directUrl.includes("manifest") || directUrl.startsWith('http'))) {
    return { ...t, url: directUrl };
  }

  if (preloadedTrack && preloadedTrack.id === t.id && preloadedTrack.url && transitionManager.validatePreload(preloadedTrack)) {
    return preloadedTrack;
  }

  return t;
}

const resolutionPromises = new Map<string, Promise<PlayerTrack>>();

export async function resolveAudioOnly(t: PlayerTrack, preloadedTrack?: PlayerTrack | null): Promise<PlayerTrack> {
    // Deduplicate concurrent resolutions for the same track
    const existing = resolutionPromises.get(t.id);
    if (existing) return existing;

    const promise = (async () => {
        try {
            let resolved = await resolveTrack(t, preloadedTrack);

            // Resolve Stream URL if missing
            if (!resolved.url || (!resolved.isLocal && !isResolvedUrl(resolved.url))) {
                try {
                    const { getPreferredStreamingQuality } = await import("./audio-quality");
                    const quality = await getPreferredStreamingQuality();
                    
                    const { streamUrl } = await musicService.resolveStream(resolved.id, quality);
                    if (streamUrl) {
                        resolved = { ...resolved, url: streamUrl };
                        const { CacheManager } = await import("../../download/services/cache.manager");
                        CacheManager.addToCache(resolved.id, streamUrl);
                    }
                } catch (e) {
                    console.error("[TrackResolver] Stream resolution failed:", e);
                }
            }

            return resolved;
        } finally {
            resolutionPromises.delete(t.id);
        }
    })();

    resolutionPromises.set(t.id, promise);
    return promise;
}
