import { PlayerTrack } from "../types/player";
import { musicService } from "../../../services/api/music";
import { transitionManager } from "../services/transition-manager";

export type PlaybackSourceType = "stream" | "download" | "cache" | "local" | "unknown";

export function getUriScheme(uri?: string): string {
  const match = uri?.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return match?.[1]?.toLowerCase() || "";
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

  // 2. Check Cache
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

  // 4. Resolve Stream URL (Online) - Only if online
  // Note: We don't always want to resolve stream URL for the whole queue at once to avoid API spam.
  // But for the current track, it's necessary.
  return t;
}

export async function resolveFullTrack(t: PlayerTrack, preloadedTrack?: PlayerTrack | null): Promise<PlayerTrack> {
    const resolved = await resolveTrack(t, preloadedTrack);
    if (resolved.url && (resolved.url.startsWith('file://') || resolved.url.startsWith('content://') || resolved.url.startsWith('http'))) {
        return resolved;
    }

    try {
        const { streamUrl } = await musicService.resolveStream(t.id);
        if (streamUrl) {
            const finalResolved = { ...t, url: streamUrl };
            const { CacheManager } = await import("../../download/services/cache.manager");
            CacheManager.addToCache(t.id, streamUrl);
            return finalResolved;
        }
    } catch (e) {
        console.error("[TrackResolver] Stream resolution failed:", e);
    }

    return t;
}
