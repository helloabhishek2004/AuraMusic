import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { getInstalledAppVersion } from '../utils/app-version';
import { isNewerVersion } from '../utils/semver';
import {
  formatBytes,
  formatReleaseDate,
  parseReleaseNotes,
  ParsedReleaseInfo,
} from '../utils/release-notes-parser';

export const GITHUB_OWNER = 'helloabhishek2004';
export const GITHUB_REPO = 'AuraMusic';
export const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

export interface GitHubAsset {
  name: string;
  size: number;
  content_type: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  body: string;
  assets: GitHubAsset[];
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  installedVersion: string;
  releaseInfo: ParsedReleaseInfo | null;
  error?: string;
}

class UpdateServiceClass {
  private activeDownload: FileSystem.DownloadResumable | null = null;

  /**
   * Checks GitHub Releases API for the latest stable, published release.
   */
  async checkForLatestRelease(): Promise<CheckUpdateResult> {
    const installedVersion = getInstalledAppVersion();

    try {
      const response = await fetch(RELEASES_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `AuraMusic/${installedVersion}`,
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: HTTP ${response.status}`);
      }

      const releases: GitHubRelease[] = await response.json();
      if (!Array.isArray(releases) || releases.length === 0) {
        return {
          hasUpdate: false,
          installedVersion,
          releaseInfo: null,
        };
      }

      // Filter: ONLY published, non-draft, non-prerelease, containing a valid .apk asset
      const eligibleReleases = releases.filter((rel) => {
        if (rel.draft || rel.prerelease) return false;
        const hasApk = Array.isArray(rel.assets) && rel.assets.some((a) => a.name.toLowerCase().endsWith('.apk'));
        return hasApk;
      });

      if (eligibleReleases.length === 0) {
        return {
          hasUpdate: false,
          installedVersion,
          releaseInfo: null,
        };
      }

      // Find the highest semver release among eligible releases
      let bestRelease: GitHubRelease = eligibleReleases[0];
      for (let i = 1; i < eligibleReleases.length; i++) {
        if (isNewerVersion(bestRelease.tag_name, eligibleReleases[i].tag_name)) {
          bestRelease = eligibleReleases[i];
        }
      }

      const cleanTag = bestRelease.tag_name;
      const cleanVersion = cleanTag.replace(/^v/i, '');
      const apkAsset = bestRelease.assets.find((a) => a.name.toLowerCase().endsWith('.apk'));

      const { summary, sections } = parseReleaseNotes(bestRelease.body, cleanVersion, bestRelease.published_at);

      const releaseInfo: ParsedReleaseInfo = {
        tag: cleanTag,
        version: cleanVersion,
        title: bestRelease.name || `AuraMusic ${cleanVersion}`,
        publishedAt: bestRelease.published_at,
        formattedDate: formatReleaseDate(bestRelease.published_at),
        summary,
        sections,
        apkAsset: apkAsset
          ? {
              name: apkAsset.name,
              sizeBytes: apkAsset.size,
              formattedSize: formatBytes(apkAsset.size),
              downloadUrl: apkAsset.browser_download_url,
            }
          : null,
      };

      const hasUpdate = isNewerVersion(installedVersion, cleanVersion) && !!apkAsset;

      return {
        hasUpdate,
        installedVersion,
        releaseInfo,
      };
    } catch (err: any) {
      console.warn('[UpdateService] Check failed:', err?.message || err);
      return {
        hasUpdate: false,
        installedVersion,
        releaseInfo: null,
        error: err?.message || 'Network request failed',
      };
    }
  }

  /**
   * Real APK download with progress tracking
   */
  async startApkDownload(
    downloadUrl: string,
    fileName: string,
    onProgress: (data: { bytesDownloaded: number; totalBytes: number; percentage: number }) => void
  ): Promise<string> {
    const targetPath = `${FileSystem.cacheDirectory}updates/${fileName}`;

    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}updates/`);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}updates/`, { intermediates: true });
    }

    // Cancel existing download if any
    if (this.activeDownload) {
      try {
        await this.activeDownload.cancelAsync();
      } catch {
        // ignore
      }
      this.activeDownload = null;
    }

    this.activeDownload = FileSystem.createDownloadResumable(
      downloadUrl,
      targetPath,
      {},
      (progress) => {
        const total = progress.totalBytesExpectedToWrite;
        const current = progress.totalBytesWritten;
        const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        onProgress({
          bytesDownloaded: current,
          totalBytes: total,
          percentage,
        });
      }
    );

    const result = await this.activeDownload.downloadAsync();
    this.activeDownload = null;

    if (!result || !result.uri) {
      throw new Error('Download failed or was cancelled');
    }

    return result.uri;
  }

  /**
   * Cancels active download
   */
  async cancelDownload(): Promise<void> {
    if (this.activeDownload) {
      try {
        await this.activeDownload.cancelAsync();
      } catch {
        // ignore
      }
      this.activeDownload = null;
    }
  }

  /**
   * Initiates native Android APK package installation flow
   */
  async installApk(fileUri: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('APK installation is only supported on Android devices.');
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('The downloaded update file was not found.');
      }

      // Convert local file:// URI to content:// URI using FileSystemFileProvider
      const contentUri = await FileSystem.getContentUriAsync(fileUri);

      // Trigger Android's package installer intent
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
      });

      return true;
    } catch (err: any) {
      console.error('[UpdateService] Installation trigger failed:', err);
      throw err;
    }
  }
}

export const UpdateService = new UpdateServiceClass();
