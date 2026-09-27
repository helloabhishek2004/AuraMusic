export interface AuraApkAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
  sizeFormatted: string;
  variant:
    | "standard"
    | "arm64"
    | "cast"
    | "tv"
    | "armeabi"
    | "x86"
    | "x86_64"
    | "other";
  label: string;
  badge?: string;
  description: string;
}

export interface AuraRelease {
  tag: string;
  version: string;
  displayVersion: string;
  name: string;
  summary: string;
  publishedAt: string;
  publishedDateFormatted: string;
  htmlUrl: string;
  body: string;
  isPrerelease: boolean;
  isDraft: boolean;
  primaryApk: AuraApkAsset | null;
  variants: AuraApkAsset[];
  hasDownloads: boolean;
  allAssets: AuraApkAsset[];
  changes: string[];
}

export const GITHUB_OWNER =
  process.env.NEXT_PUBLIC_GITHUB_OWNER ||
  process.env.GITHUB_OWNER ||
  "helloabhishek2004";

export const GITHUB_REPO =
  process.env.NEXT_PUBLIC_GITHUB_REPO ||
  process.env.GITHUB_REPO ||
  "AuraMusic";

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;

/**
 * Format bytes into human-readable string (e.g. 61.4 MB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}

/**
 * Format ISO date string into readable date (e.g. August 31, 2026)
 */
export function formatReleaseDate(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

/**
 * Classify APK asset into human-friendly variant
 */
export function classifyApkAsset(asset: {
  name: string;
  size: number;
  browser_download_url: string;
}): AuraApkAsset {
  const name = asset.name;
  const lower = name.toLowerCase();
  const sizeBytes = asset.size || 0;
  const sizeFormatted = formatBytes(sizeBytes);
  const downloadUrl = asset.browser_download_url;

  if (lower.includes("google-cast") || lower.includes("-cast")) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeFormatted,
      variant: "cast",
      label: "With Google Cast",
      badge: "GMS",
      description: "Includes Chromecast streaming support. Requires Google Mobile Services.",
    };
  }

  if (lower.includes("-tv") || lower.includes("tv.apk")) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeFormatted,
      variant: "tv",
      label: "Android TV",
      badge: "TV & D-Pad",
      description: "Optimized for Android TV and Google TV with 10-foot UI & remote navigation.",
    };
  }

  if (lower.includes("arm64") || lower.includes("v8a")) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeFormatted,
      variant: "arm64",
      label: "ARM64 Only",
      badge: "Smaller APK",
      description: "Tailored for 64-bit phones (most modern Android devices). ~45% smaller download.",
    };
  }

  if (lower.includes("armeabi") || lower.includes("v7a")) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeFormatted,
      variant: "armeabi",
      label: "ARMv7 (32-bit)",
      badge: "Legacy",
      description: "For older 32-bit Android phones and legacy hardware.",
    };
  }

  if (lower.includes("x86_64")) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeFormatted,
      variant: "x86_64",
      label: "x86_64",
      badge: "Emulators",
      description: "For 64-bit Android emulators, ChromeOS, and Intel/AMD tablets.",
    };
  }

  if (lower.includes("x86")) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeFormatted,
      variant: "x86",
      label: "x86 (32-bit)",
      badge: "Emulators",
      description: "For 32-bit Android emulators and specialized devices.",
    };
  }

  // Exact AuraMusic.apk or Universal build
  return {
    name,
    downloadUrl,
    sizeBytes,
    sizeFormatted,
    variant: "standard",
    label: "Universal APK",
    badge: "Recommended",
    description: "All-in-one universal build. Works on all Android 7.0+ (API 24+) phones and tablets.",
  };
}

/**
 * Select the optimal primary APK according to priority:
 * 1. Exact "AuraMusic.apk" or containing "universal"
 * 2. Standard APK (not TV, Cast, or single-architecture)
 * 3. ARM64 APK
 * 4. First available APK
 */
export function pickPrimaryApk(assets: AuraApkAsset[]): AuraApkAsset | null {
  if (!assets || assets.length === 0) return null;

  // 1. Exact AuraMusic.apk or universal
  const exactUniversal = assets.find(
    (a) =>
      a.name.toLowerCase() === "auramusic.apk" ||
      a.name.toLowerCase().includes("universal")
  );
  if (exactUniversal) return exactUniversal;

  // 2. Standard variant
  const standard = assets.find((a) => a.variant === "standard");
  if (standard) return standard;

  // 3. ARM64 variant
  const arm64 = assets.find((a) => a.variant === "arm64");
  if (arm64) return arm64;

  // 4. Any variant that isn't TV
  const nonTv = assets.find((a) => a.variant !== "tv");
  if (nonTv) return nonTv;

  return assets[0];
}

/**
 * Extract bullet change items from markdown release body
 */
export function extractChangesFromBody(body: string): string[] {
  if (!body) return [];
  const lines = body.split("\n");
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const cleaned = trimmed.replace(/^[-*]\s+/, "").trim();
      if (cleaned.length > 0 && !cleaned.toLowerCase().includes("full changelog")) {
        items.push(cleaned);
      }
    }
  }

  return items;
}

/**
 * Extract a concise summary from markdown release body
 */
export function extractSummaryFromBody(body: string, defaultName: string): string {
  if (!body) return defaultName;

  // Check for blockquote or note: > [!NOTE] or > AuraMusic...
  const quoteMatch = body.match(/>\s*(?:\[!NOTE\]\s*)?([\s\S]*?)(?:\n\n|\n[#>*-]|$)/);
  if (quoteMatch && quoteMatch[1]) {
    const text = quoteMatch[1].replace(/\n>\s*/g, " ").trim();
    if (text.length > 10) {
      return text.length > 220 ? text.slice(0, 217) + "..." : text;
    }
  }

  // Check first non-heading, non-empty paragraph
  const paragraphs = body.split(/\n\s*\n/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith(">") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*")
    ) {
      const singleLine = trimmed.replace(/\n/g, " ");
      return singleLine.length > 220 ? singleLine.slice(0, 217) + "..." : singleLine;
    }
  }

  return defaultName;
}

/**
 * Fallback release snapshot in case GitHub API rate limits or network is unavailable
 */
export function getFallbackRelease(): AuraRelease {
  const primaryApk: AuraApkAsset = {
    name: "AuraMusic-v2.0.0-universal.apk",
    downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v2.0.0/AuraMusic-v2.0.0-universal.apk`,
    sizeBytes: 115529948,
    sizeFormatted: "110.2 MB",
    variant: "standard",
    label: "Universal APK",
    badge: "Recommended",
    description: "All-in-one universal build. Works on all Android 7.0+ (API 24+) devices.",
  };

  const variants: AuraApkAsset[] = [primaryApk];

  return {
    tag: "v2.0.0",
    version: "2.0.0",
    displayVersion: "v2.0.0",
    name: "AuraMusic v2.0.0 — V2 Release",
    summary:
      "Native Media3 Playback, Liquid Glass UI, Reliable Offline Caching & Enhanced Metadata",
    publishedAt: "2026-09-20T19:07:22Z",
    publishedDateFormatted: "September 20, 2026",
    htmlUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v2.0.0`,
    body: "",
    isPrerelease: false,
    isDraft: false,
    primaryApk,
    variants,
    hasDownloads: true,
    allAssets: variants,
    changes: [
      "Faster startup and smoother navigation across all views",
      "Native Media3 playback with improved caching and reliable offline playback",
      "Like/unlike directly from Android notification and lock screen controls",
      "More reliable song downloads with complete song and album metadata",
      "Refined Liquid Glass navigation and atmospheric player experience",
      "Improved Library and downloaded-music offline management",
      "Improved lyrics synchronization and word-by-word timing when changing tracks",
      "Proper multi-artist metadata preservation and clean artist credits",
      "Improved music discovery, search intent ranking, and local Room DB caching",
      "Android 7.0+ (API 24+) compatibility and target SDK 36 readiness",
    ],
  };
}

interface RawGitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface RawGitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  assets?: RawGitHubAsset[];
}

/**
 * Transform GitHub API release object into normalized AuraRelease
 */
export function transformGitHubRelease(raw: RawGitHubRelease): AuraRelease {
  const tag = raw.tag_name || "v0.0.0";
  const displayVersion = tag.startsWith("v") ? tag : `v${tag}`;
  const version = tag.replace(/^v/, "");
  const name = raw.name || `AuraMusic ${displayVersion}`;
  const body = raw.body || "";

  // Parse APK assets
  const apkAssets = (raw.assets || [])
    .filter((a) => a.name.toLowerCase().endsWith(".apk"))
    .map(classifyApkAsset);

  const primaryApk = pickPrimaryApk(apkAssets);
  const changes = extractChangesFromBody(body);
  const summary = extractSummaryFromBody(body, name);

  return {
    tag,
    version,
    displayVersion,
    name,
    summary,
    publishedAt: raw.published_at || new Date().toISOString(),
    publishedDateFormatted: formatReleaseDate(raw.published_at),
    htmlUrl: raw.html_url || `${GITHUB_RELEASES_URL}/tag/${tag}`,
    body,
    isPrerelease: !!raw.prerelease,
    isDraft: !!raw.draft,
    primaryApk,
    variants: apkAssets,
    hasDownloads: apkAssets.length > 0,
    allAssets: apkAssets,
    changes,
  };
}

/**
 * Fetch the latest release with Next.js ISR (5-minute cache)
 */
export async function getLatestAuraRelease(): Promise<AuraRelease> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AuraMusicWebsite",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!res.ok) {
      console.warn(
        `[release] GitHub API returned status ${res.status} for latest release. Using fallback.`
      );
      return getFallbackRelease();
    }

    const data = (await res.json()) as RawGitHubRelease;
    const release = transformGitHubRelease(data);

    // If for some reason GitHub release has no APKs attached yet, supply fallback links to release
    if (!release.primaryApk) {
      const fallback = getFallbackRelease();
      release.primaryApk = {
        name: "AuraMusic.apk",
        downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${release.tag}/AuraMusic-${release.tag}-universal.apk`,
        sizeBytes: fallback.primaryApk?.sizeBytes || 115529948,
        sizeFormatted: fallback.primaryApk?.sizeFormatted || "110.2 MB",
        variant: "standard",
        label: "Universal APK",
        badge: "Recommended",
        description: "All-in-one universal build. Works on all Android 7.0+ (API 24+) devices.",
      };
      release.variants = [release.primaryApk];
    }

    return release;
  } catch (err) {
    console.warn("[release] Failed to fetch latest release:", err);
    return getFallbackRelease();
  }
}

/**
 * Fetch all releases (up to 30) with Next.js ISR
 */
export async function getAllAuraReleases(): Promise<AuraRelease[]> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=30`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AuraMusicWebsite",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!res.ok) {
      console.warn(
        `[release] GitHub API returned status ${res.status} for all releases. Using fallback.`
      );
      return [getFallbackRelease()];
    }

    const data = (await res.json()) as RawGitHubRelease[];
    if (!Array.isArray(data) || data.length === 0) {
      return [getFallbackRelease()];
    }

    return data
      .filter((r) => !r.draft)
      .map(transformGitHubRelease);
  } catch (err) {
    console.warn("[release] Failed to fetch releases:", err);
    return [getFallbackRelease()];
  }
}
