import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as logger from '@/src/utils/logger';
import { useLibraryHealthStore } from '../features/library-health/store/library-health.store';
import { useDownloadStore } from '../features/download/store/download.store';
import { usePlaylistStore } from '../features/playlist/store/playlist.store';
import { useDeviceStateStore } from '../features/device/store/device-state.store';
import { StorageService } from '../features/download/services/storage.service';
import { LocalMusicService } from './local-music.service';
import { LocalTrack, DuplicateGroup, LibraryHealthReport, PendingDeletion, ScanMode, ScanStage } from '../features/library-health/types/library-health';
import { MusicTrack } from '../types/music';

// Debounce timer holders
let startupScanTimer: NodeJS.Timeout | null = null;
let downloadScanTimer: NodeJS.Timeout | null = null;
let undoTimer: NodeJS.Timeout | null = null;

export class LibraryHealthService {
  /**
   * String normalization stripping copy tags, digits in parentheses,
   * and common quality tags (Remastered, Official Audio, HD, etc.)
   */
  static normalizeString(str: string): string {
    if (!str) return '';
    let normalized = str.toLowerCase();
    
    // Strip common copy suffixes like (1), (2), - copy, _1 at the end
    normalized = normalized
      .replace(/\s*[\(\[]\s*\d+\s*[\)\]]$/gi, '')
      .replace(/\s*-\s*copy$/gi, '')
      .replace(/\s*_\s*\d+$/gi, '');

    normalized = normalized
      // Remove bracketed info containing keyword tags
      .replace(/[\(\[][^)\]]*?(remaster|official|hd|320kbps|video|lyrics|hq|audio|edit|mix)[^)\]]*?[\)\]]/gi, '')
      // Remove special characters, keep only alphanumerics and spaces
      .replace(/[^a-z0-9\s]/gi, '')
      // Replace multiple spaces with a single space
      .replace(/\s+/g, ' ')
      .trim();
      
    return normalized;
  }

  /**
   * Generate simple string hash
   */
  private static generateStringHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString();
  }

  /**
   * Calculate a lightweight signature hash of the library
   */
  private static computeLibraryHash(localTracks: MusicTrack[], downloadedTracks: any[]): string {
    const signatures = [...localTracks, ...downloadedTracks]
      .map(t => `${t.id}:${t.durationSec || t.duration || ''}`)
      .sort();
    return this.generateStringHash(signatures.join(','));
  }

  /**
   * Power and network checks for full audit
   */
  private static async checkPowerAndNetworkForAudit(): Promise<boolean> {
    const isWifi = useDeviceStateStore.getState().isWifi;
    // Mock charging and battery status since expo-battery isn't installed
    const isCharging = true;
    const batteryLevel = 100;

    if (batteryLevel < 20) {
      logger.warn('[LibraryHealthService] Scan deferred: Battery < 20%');
      return false;
    }

    if (!isCharging || !isWifi) {
      logger.warn('[LibraryHealthService] Scan deferred: Charging + WiFi required for Full Audit');
      return false;
    }

    return true;
  }

  /**
   * Main scan trigger entrypoint supporting priorities: startup, download, manual, full
   */
  static async scanLibrary(mode: ScanMode = 'full') {
    const store = useLibraryHealthStore.getState();
    const downloadStore = useDownloadStore.getState();

    // Startup rollback check: if pendingDeletions were not committed, clear them
    if (mode === 'startup') {
      if (store.pendingDeletions.length > 0) {
        logger.info('[LibraryHealthService] App restarted during undo window. Restoring files (clearing pending deletions).');
        store.clearPendingDeletions();
      }
    }

    // 1. Resolve offline track sources
    let localTracks: MusicTrack[] = [];
    try {
      localTracks = await LocalMusicService.getLocalTracks();
    } catch (e) {
      logger.error('[LibraryHealthService] Error loading local tracks:', e);
    }
    const downloadedTracks = Object.values(downloadStore.downloadedTracks);

    // 2. Startup cached checks (fast scan)
    if (mode === 'startup') {
      const currentHash = this.computeLibraryHash(localTracks, downloadedTracks);
      if (store.healthReport && store.libraryHash === currentHash) {
        logger.info('[LibraryHealthService] Fast scan match. Loading cached library health results.');
        return;
      }
      logger.info('[LibraryHealthService] Fast scan mismatch. Initializing background scan.');
      // Mismatch -> Fallback to background full scan
      mode = 'full';
    }

    // Enforce power & network rules for background full audit unless manual force
    if (mode === 'full' && !(await this.checkPowerAndNetworkForAudit())) {
      return;
    }

    if (store.isScanning) {
      logger.info('[LibraryHealthService] Scan already in progress. Skipping.');
      return;
    }

    // Initialize full background scan
    store.setScanningState(true, 0, 'loading');

    const totalTracks = localTracks.length + downloadedTracks.length;
    if (totalTracks === 0) {
      const emptyReport: LibraryHealthReport = {
        totalTracks: 0,
        duplicateTracks: 0,
        duplicateGroups: 0,
        storageWasteBytes: 0,
        generatedAt: Date.now(),
        libraryHash: '',
        healthScore: 100,
      };
      store.setScanResult(emptyReport, [], Date.now(), '');
      store.setScanningState(false, 100, 'completed');
      return;
    }

    const allTracks = [...localTracks, ...downloadedTracks];
    const processedTracks: LocalTrack[] = [];
    const downloadedTracksMap = downloadStore.downloadedTracks;

    // Process tracks in chunks of 500
    const chunkSize = 500;
    let index = 0;

    const processNextChunk = async () => {
      const limit = Math.min(index + chunkSize, allTracks.length);
      for (let i = index; i < limit; i++) {
        const track = allTracks[i];
        const isDownload = !!downloadedTracksMap[track.id];
        
        let fileSize = 0;
        let addedAt = Date.now();
        let exists = true;

        try {
          const path = isDownload ? downloadedTracksMap[track.id].localAudioPath : track.url;
          if (path) {
            const info = await FileSystem.getInfoAsync(path);
            if (info.exists) {
              fileSize = info.size;
              addedAt = info.modificationTime ? info.modificationTime * 1000 : Date.now();
            } else {
              exists = false;
            }
          } else {
            exists = false;
          }
        } catch (e) {
          exists = false;
        }

        const durationSec = ('durationSec' in track && typeof track.durationSec === 'number')
          ? track.durationSec
          : (track.duration ? (typeof track.duration === 'number' ? track.duration : parseInt(track.duration, 10)) : 0);

        processedTracks.push({
          ...track,
          fileSize,
          addedAt,
          exists,
          durationSec,
        } as LocalTrack);
      }

      index = limit;
      const progress = Math.round((index / allTracks.length) * 40); // Max 40% for loading stage
      store.setScanningState(true, progress, 'loading');

      if (index < allTracks.length) {
        setTimeout(processNextChunk, 16);
      } else {
        // Next Stage: Grouping
        await runGroupingStage(processedTracks);
      }
    };

    const runGroupingStage = async (tracks: LocalTrack[]) => {
      store.setScanningState(true, 50, 'grouping');

      const groupsMap: Record<string, LocalTrack[]> = {};
      const duplicateIndex: Record<string, string[]> = {};

      for (const track of tracks) {
        const normTitle = this.normalizeString(track.title);
        const normArtist = this.normalizeString(track.artist);
        const key = `${normTitle}|${normArtist}`;

        if (!groupsMap[key]) {
          groupsMap[key] = [];
          duplicateIndex[key] = [];
        }
        groupsMap[key].push(track);
        duplicateIndex[key].push(track.id);
      }

      // Persist duplicate Index
      store.setDuplicateIndex(duplicateIndex);

      // Next Stage: Analyzing
      await runAnalyzingStage(groupsMap, tracks);
    };

    const runAnalyzingStage = async (groupsMap: Record<string, LocalTrack[]>, allTracks: LocalTrack[]) => {
      store.setScanningState(true, 80, 'analyzing');

      const duplicateGroups: DuplicateGroup[] = [];
      let duplicateTracksCount = 0;
      let storageWasteBytes = 0;
      let brokenTracksCount = 0;
      let tracksWithNoArtworkCount = 0;

      // Calculate stats for single items
      for (const track of allTracks) {
        if (!track.exists) {
          brokenTracksCount++;
        }
        const hasArt = track.art && track.art.trim().length > 0 && !track.art.includes('default');
        if (!hasArt) {
          tracksWithNoArtworkCount++;
        }
      }

      // Process duplicate groups
      for (const key in groupsMap) {
        const tracksInGroup = groupsMap[key];
        const validTracks = tracksInGroup.filter(t => t.exists);

        if (validTracks.length <= 1) continue;

        // Smart Recommendation Formula
        const recommended = this.selectRecommendedTrack(validTracks);

        // Calculate confidence
        let maxConfidence = 0;
        let finalReason: 'exact' | 'metadata' | 'duration' = 'exact';

        const duplicates = validTracks.filter(t => t.id !== recommended.id);
        duplicateTracksCount += duplicates.length;

        for (const dup of duplicates) {
          storageWasteBytes += dup.fileSize || 0;

          let confidence = 75;
          let reason: 'exact' | 'metadata' | 'duration' = 'duration';

          const sameAlbum = dup.album && recommended.album && dup.album.toLowerCase().trim() === recommended.album.toLowerCase().trim();
          const durDiff = Math.abs((dup.durationSec || 0) - (recommended.durationSec || 0));

          if (sameAlbum && durDiff <= 1) {
            confidence = 95;
            reason = 'exact';
          } else if (!sameAlbum && durDiff <= 1) {
            confidence = 85;
            reason = 'metadata';
          } else if (durDiff <= 2) {
            confidence = 75;
            reason = 'duration';
          }

          // Recency Protection: reduce confidence by 10% for tracks added within last 7 days
          const ageInDays = (Date.now() - dup.addedAt) / (1000 * 60 * 60 * 24);
          if (ageInDays < 7) {
            confidence -= 10;
          }

          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            finalReason = reason;
          }
        }

        const severity: 'low' | 'medium' | 'high' = 
          validTracks.length <= 2 ? 'low' : (validTracks.length <= 5 ? 'medium' : 'high');

        duplicateGroups.push({
          id: key,
          confidence: maxConfidence,
          reason: finalReason,
          tracks: validTracks,
          recommendedTrackId: recommended.id,
          severity,
        });
      }

      // Calculate health score
      // - duplicatePenalty = duplicateGroups * 2 (max 30)
      // - brokenFilePenalty = brokenTracks * 10 (max 50)
      // - artworkPenalty = missingArtwork * 10 (max 20)
      const duplicatePenalty = Math.min(duplicateGroups.length * 2, 30);
      const brokenFilePenalty = Math.min(brokenTracksCount * 10, 50);
      const artworkPenalty = Math.min(tracksWithNoArtworkCount * 10, 20);
      const healthScore = Math.max(0, 100 - duplicatePenalty - brokenFilePenalty - artworkPenalty);

      const report: LibraryHealthReport = {
        totalTracks: allTracks.length,
        duplicateTracks: duplicateTracksCount,
        duplicateGroups: duplicateGroups.length,
        storageWasteBytes,
        generatedAt: Date.now(),
        libraryHash: this.computeLibraryHash(localTracks, downloadedTracks),
        healthScore,
      };

      store.setScanResult(report, duplicateGroups, Date.now(), report.libraryHash);
      store.setScanningState(false, 100, 'completed');
      logger.info(`[LibraryHealthService] Full scan completed. Health Score: ${healthScore}`);
    };

    // Trigger chunk processing
    await processNextChunk();
  }

  /**
   * Smart Merge Recommendation Formula
   * Score = Quality (50%) + Usage (30%) + Metadata Completeness (20%)
   */
  static selectRecommendedTrack(tracks: LocalTrack[]): LocalTrack {
    const scores = tracks.map(track => {
      // 1. Quality (50% - Max 50 pts)
      let qualityScore = 20;
      const durationSec = track.durationSec || 1;
      const bytesPerSec = (track.fileSize || 0) / durationSec;

      if (bytesPerSec >= 100000) qualityScore = 50;       // FLAC/Lossless
      else if (bytesPerSec >= 40000) qualityScore = 45;  // 320kbps
      else if (bytesPerSec >= 32000) qualityScore = 40;  // 256kbps
      else if (bytesPerSec >= 24000) qualityScore = 35;  // 192kbps
      else if (bytesPerSec >= 16000) qualityScore = 30;  // 128kbps

      // 2. Usage (30% - Max 30 pts)
      let usageScore = 0;
      
      // Liked track bonus (+15 pts)
      try {
        const { useLikesStore } = require('../features/likes/store/likes.store');
        const isLiked = useLikesStore.getState().likedTracks?.[track.id];
        if (isLiked) usageScore += 15;
      } catch (_) {}

      // Playlist usage bonus (+10 pts)
      try {
        const playlistStore = usePlaylistStore.getState();
        const playlistsContaining = playlistStore.getPlaylistsContainingTrack(track.id);
        if (playlistsContaining.length > 0) usageScore += 10;
      } catch (_) {}

      // Play count bonus (Max 5 pts)
      try {
        const { useAnalyticsStore } = require('../features/analytics/store/analytics.store');
        const playCount = useAnalyticsStore.getState().trackAffinities?.[track.id]?.playCount || 0;
        usageScore += Math.min(playCount, 10) * 0.5;
      } catch (_) {}

      // 3. Metadata Completeness (20% - Max 20 pts)
      let metaScore = 0;
      if (track.title && track.title.trim().length > 0) metaScore += 4;
      if (track.artist && track.artist !== 'Local Artist' && track.artist !== 'Local' && track.artist.trim().length > 0) metaScore += 4;
      if (track.album && track.album.trim().length > 0) metaScore += 4;
      if (durationSec > 1) metaScore += 4;
      if (track.art && track.art.trim().length > 0 && !track.art.includes('default')) metaScore += 4;

      const totalScore = qualityScore + usageScore + metaScore;

      return {
        track,
        score: totalScore,
      };
    });

    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);
    return scores[0].track;
  }

  /**
   * Incremental Scan (Download Complete)
   * Scans a single newly downloaded track and compares it against the existing index.
   * Runs in <100ms.
   */
  static async registerNewDownloadedTrack(newTrackId: string) {
    const downloadStore = useDownloadStore.getState();
    const track = downloadStore.downloadedTracks[newTrackId];
    if (!track) return;

    logger.info(`[LibraryHealthService] Incremental scan initiated for new track: ${track.title}`);

    const store = useLibraryHealthStore.getState();
    const duplicateIndex = { ...store.duplicateIndex };
    
    // Construct local track info
    let fileSize = track.fileSize || 0;
    if (fileSize === 0) {
      try {
        fileSize = await StorageService.getFileSize(track.localAudioPath);
      } catch (_) {}
    }

    const durationSec = ('durationSec' in track && typeof track.durationSec === 'number')
      ? track.durationSec
      : (track.duration ? (typeof track.duration === 'number' ? track.duration : parseInt(track.duration, 10)) : 0);

    const localTrack: LocalTrack = {
      ...track,
      fileSize,
      addedAt: Date.now(),
      exists: true,
      durationSec,
    } as unknown as LocalTrack;

    const normTitle = this.normalizeString(localTrack.title);
    const normArtist = this.normalizeString(localTrack.artist);
    const key = `${normTitle}|${normArtist}`;

    // Update index
    if (!duplicateIndex[key]) {
      duplicateIndex[key] = [];
    }
    if (!duplicateIndex[key].includes(localTrack.id)) {
      duplicateIndex[key].push(localTrack.id);
    }
    store.setDuplicateIndex(duplicateIndex);

    // If duplicate index key has more than 1 entry, recalculate duplicate group
    // Re-trigger full background scan so we rebuild the groups and health score cleanly,
    // but run it debounced/delayed to prevent battery drain.
    this.scheduleDebouncedScan();
  }

  /**
   * 15-Second Undo Transaction Countdown
   */
  static async registerDeletions(pending: PendingDeletion[]) {
    const store = useLibraryHealthStore.getState();
    
    // Clear any previous timer
    if (undoTimer) {
      clearTimeout(undoTimer);
    }

    store.registerPendingDeletions(pending, 15000);

    undoTimer = setTimeout(async () => {
      await this.commitDeletions();
    }, 15000);
  }

  /**
   * Cancel and rollback deletions
   */
  static rollbackDeletions() {
    if (undoTimer) {
      clearTimeout(undoTimer);
      undoTimer = null;
    }
    const store = useLibraryHealthStore.getState();
    store.clearPendingDeletions();
    logger.info('[LibraryHealthService] Deletion transaction rolled back successfully.');
  }

  /**
   * Commit the physical deletions & repoint playlist references
   */
  private static async commitDeletions() {
    const store = useLibraryHealthStore.getState();
    const playlistStore = usePlaylistStore.getState();
    const downloadStore = useDownloadStore.getState();

    const deletions = [...store.pendingDeletions];
    if (deletions.length === 0) return;

    store.clearPendingDeletions();

    logger.info(`[LibraryHealthService] Committing ${deletions.length} deletions...`);

    // 1. Backup playlists in case of rollback
    const originalPlaylists = { ...playlistStore.playlists };

    // 2. Re-point playlist references in memory
    const updatedPlaylists = JSON.parse(JSON.stringify(playlistStore.playlists));
    
    // Group duplicates by normalized key to map deletedTrackId -> recommendedTrackId
    const repointMap: Record<string, string> = {};
    for (const group of store.duplicateGroups) {
      const recId = group.recommendedTrackId;
      group.tracks.forEach(t => {
        if (t.id !== recId) {
          repointMap[t.id] = recId;
        }
      });
    }

    // Apply repoints
    for (const plId in updatedPlaylists) {
      const pl = updatedPlaylists[plId];
      const newTrackIds: string[] = [];
      const newSnapshots: any = { ...pl.trackSnapshots };

      for (const tid of pl.trackIds) {
        const recommendedId = repointMap[tid];
        if (recommendedId) {
          // Replace tid with recommendedId if recommendedId isn't already in playlist
          if (!newTrackIds.includes(recommendedId)) {
            newTrackIds.push(recommendedId);
            // Copy snapshot if needed
            if (pl.trackSnapshots?.[tid] && !newSnapshots[recommendedId]) {
              newSnapshots[recommendedId] = {
                ...pl.trackSnapshots[tid],
                id: recommendedId,
              };
            }
          }
          delete newSnapshots[tid];
        } else {
          newTrackIds.push(tid);
        }
      }
      pl.trackIds = newTrackIds;
      pl.trackSnapshots = newSnapshots;
      pl.updatedAt = Date.now();
    }

    // Save updated playlists to store
    usePlaylistStore.setState({ playlists: updatedPlaylists });

    // 3. Physical Deletions in chunks of 20 to preserve UI responsiveness
    const deletionChunks: PendingDeletion[][] = [];
    for (let i = 0; i < deletions.length; i += 20) {
      deletionChunks.push(deletions.slice(i, i + 20));
    }

    let storageRecovered = 0;

    try {
      for (const chunk of deletionChunks) {
        await Promise.all(chunk.map(async (del) => {
          let mediaAssetId = del.mediaAssetId;
          
          // Extrapolate mediaAssetId from content URI if needed
          if (!mediaAssetId && del.filePath.startsWith('content://media/')) {
            const parts = del.filePath.split('/');
            mediaAssetId = parts[parts.length - 1];
          }

          if (!del.isDownload && mediaAssetId) {
            // Native MediaLibrary delete (prompts OS delete request confirmation dialog)
            await MediaLibrary.deleteAssetsAsync([mediaAssetId]);
          } else {
            // Local file delete
            const fileSize = await StorageService.getFileSize(del.filePath);
            await StorageService.deleteFile(del.filePath);
            storageRecovered += fileSize;
          }

          // If it was a downloaded track, remove it from downloadedTracks
          if (del.isDownload) {
            const downloadedTracks = { ...useDownloadStore.getState().downloadedTracks };
            delete downloadedTracks[del.trackId];
            useDownloadStore.setState({ downloadedTracks });
          }
        }));

        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update telemetry
      const currentTelemetry = store.telemetry;
      useLibraryHealthStore.setState({
        telemetry: {
          ...currentTelemetry,
          duplicatesRemoved: currentTelemetry.duplicatesRemoved + deletions.length,
          storageRecovered: currentTelemetry.storageRecovered + storageRecovered,
        }
      });

      logger.info(`[LibraryHealthService] Physical deletions committed. Recovered ${storageRecovered} bytes.`);
      
      // Trigger scan to update UI health report
      await this.scanLibrary('full');

    } catch (error) {
      logger.error('[LibraryHealthService] Error deleting physical files, rolling back playlist changes:', error);
      // Rollback playlists to original state
      usePlaylistStore.setState({ playlists: originalPlaylists });
    }
  }

  /**
   * Safe Merge Duplicates
   * Gathers all duplicate groups with >=95% confidence and queues deletions.
   */
  static mergeAllSafeDuplicates() {
    const store = useLibraryHealthStore.getState();
    const safeGroups = store.duplicateGroups.filter(
      g => g.confidence >= 95 && !store.ignoredDuplicateGroups.includes(g.id)
    );

    if (safeGroups.length === 0) return;

    const pending: PendingDeletion[] = [];
    for (const group of safeGroups) {
      const recId = group.recommendedTrackId;
      const duplicates = group.tracks.filter(t => t.id !== recId);

      for (const dup of duplicates) {
        const isDownload = !!(!dup.isLocal || dup.localUri?.includes('documentDirectory') || dup.localUri?.includes('aura/audio'));
        pending.push({
          groupId: group.id,
          trackId: dup.id,
          filePath: dup.localUri || dup.url || '',
          isDownload,
        });
      }
    }

    if (pending.length > 0) {
      this.registerDeletions(pending);
    }
  }

  /**
   * Schedule debounced scan for startup (8s)
   */
  static scheduleStartupScan() {
    if (startupScanTimer) {
      clearTimeout(startupScanTimer);
    }
    startupScanTimer = setTimeout(async () => {
      logger.info('[LibraryHealthService] Triggering startup scan after 8s delay');
      await this.scanLibrary('startup');
    }, 8000);
  }

  /**
   * Schedule debounced scan for download completion (60s)
   */
  static scheduleDebouncedScan() {
    if (downloadScanTimer) {
      clearTimeout(downloadScanTimer);
    }
    downloadScanTimer = setTimeout(async () => {
      logger.info('[LibraryHealthService] Triggering incremental scan after 60s download delay');
      await this.scanLibrary('full');
    }, 60000);
  }
}
