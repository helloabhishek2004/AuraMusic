/**
 * Robust Semantic Versioning Parser & Comparator
 * 
 * Complies with SemVer 2.0.0 specs:
 * Handles:
 *  - v-prefixed strings ('v3.1.0' -> 3.1.0)
 *  - multi-digit components ('3.10.0' > '3.9.0')
 *  - prerelease tags ('v3.0.0-beta.1' < 'v3.0.0')
 *  - build metadata ('3.0.0+build2604')
 */

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  raw: string;
}

export function parseSemver(versionStr: string): ParsedSemver | null {
  if (!versionStr || typeof versionStr !== 'string') return null;

  // Clean leading 'v' or 'V' and whitespaces
  const clean = versionStr.trim().replace(/^v/i, '');
  
  // Split off build metadata (after '+')
  const [noBuild] = clean.split('+');
  
  // Split off prerelease tag (after '-')
  const [corePart, ...preParts] = noBuild.split('-');
  const prerelease = preParts.join('-');

  const parts = corePart.split('.').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return null;

  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  return {
    major,
    minor,
    patch,
    prerelease: prerelease || undefined,
    raw: versionStr,
  };
}

/**
 * Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if a === b
 */
export function compareSemver(aStr: string, bStr: string): number {
  const a = parseSemver(aStr);
  const b = parseSemver(bStr);

  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

  // A version with a prerelease is lower than a version without
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);
  }

  return 0;
}

/**
 * Returns true if latestStr is strictly newer than installedStr
 */
export function isNewerVersion(installedStr: string, latestStr: string): boolean {
  return compareSemver(latestStr, installedStr) > 0;
}
