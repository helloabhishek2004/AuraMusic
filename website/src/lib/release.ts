/**
 * Official Release Configuration and Direct APK Download Service
 */

export const GITHUB_OWNER = "helloabhishek2004";
export const GITHUB_REPO = "AuraMusic";
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// Verified direct download URL for the universal signed Android APK
export const DIRECT_APK_DOWNLOAD_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v2.0.0/AuraMusic-v2.0.0-universal.apk`;

export interface ReleaseInfo {
  version: string;
  tag: string;
  apkUrl: string;
  apkName: string;
  apkSize: string;
  publishedDate: string;
  releasesPage: string;
}

export const FALLBACK_RELEASE: ReleaseInfo = {
  version: "v2.0.0",
  tag: "v2.0.0",
  apkUrl: DIRECT_APK_DOWNLOAD_URL,
  apkName: "AuraMusic-v2.0.0-universal.apk",
  apkSize: "110 MB",
  publishedDate: "April 16, 2026",
  releasesPage: GITHUB_RELEASES_PAGE,
};

/**
 * Triggers an immediate browser download of the APK file without opening
 * any GitHub web pages.
 */
export function initiateApkDownload(url: string = DIRECT_APK_DOWNLOAD_URL, filename = "AuraMusic.apk") {
  try {
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 1000);
  } catch (e) {
    // If programmatic click fails, fallback to window.location
    window.location.href = url;
  }
}

/**
 * Fetch latest release metadata from GitHub API dynamically
 */
export async function fetchLatestRelease(): Promise<ReleaseInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      return FALLBACK_RELEASE;
    }

    const data = await res.json();
    const tag = data.tag_name || "v2.0.0";
    const assets: Array<{ name: string; size: number; browser_download_url: string }> = data.assets || [];

    // Find the APK file
    const apkAsset =
      assets.find((a) => a.name.toLowerCase().endsWith(".apk") && !a.name.toLowerCase().includes("tv")) ||
      assets.find((a) => a.name.toLowerCase().endsWith(".apk")) ||
      null;

    if (!apkAsset) {
      return {
        ...FALLBACK_RELEASE,
        version: tag,
        tag,
      };
    }

    const sizeMb = (apkAsset.size / (1024 * 1024)).toFixed(1) + " MB";

    return {
      version: tag,
      tag,
      apkUrl: apkAsset.browser_download_url,
      apkName: apkAsset.name,
      apkSize: sizeMb,
      publishedDate: data.published_at ? new Date(data.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "",
      releasesPage: data.html_url || GITHUB_RELEASES_PAGE,
    };
  } catch (err) {
    return FALLBACK_RELEASE;
  }
}
