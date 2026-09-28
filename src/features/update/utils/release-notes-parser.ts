/**
 * Release Notes Parser
 * Converts Markdown GitHub release body into categorized notes
 * (New Features, Improvements, Bug Fixes, Highlights)
 */

export interface ReleaseNotesSection {
  title: string;
  type: 'new' | 'improved' | 'fixed' | 'general';
  items: string[];
}

export interface ParsedReleaseInfo {
  tag: string;
  version: string;
  title: string;
  publishedAt: string;
  formattedDate: string;
  summary: string;
  sections: ReleaseNotesSection[];
  apkAsset: {
    name: string;
    sizeBytes: number;
    formattedSize: string;
    downloadUrl: string;
  } | null;
}

export function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function formatReleaseDate(isoDateString?: string): string {
  if (!isoDateString) return 'Recent Release';
  try {
    const d = new Date(isoDateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return 'Recent Release';
  }
}

/**
 * Parses markdown text from GitHub Release body into categorized sections
 */
export function parseReleaseNotes(body: string, version: string, publishedAt?: string): { summary: string; sections: ReleaseNotesSection[] } {
  if (!body || body.trim() === '') {
    return {
      summary: `AuraMusic ${version} release brings refined Liquid Glass surfaces, improved playback, and enhanced stability.`,
      sections: [
        {
          title: 'New Features & Refinements',
          type: 'new',
          items: ['Refined Liquid Glass interfaces with dynamic depth', 'Enhanced playback stability and caching'],
        },
      ],
    };
  }

  const lines = body.split(/\r?\n/);
  const sections: ReleaseNotesSection[] = [];
  let currentSection: ReleaseNotesSection | null = null;
  let summaryParagraphs: string[] = [];
  let foundFirstHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for Markdown headers (## Highlights, ## What's New, ## Bug Fixes, etc.)
    if (line.startsWith('#')) {
      foundFirstHeader = true;
      const rawTitle = line.replace(/^#+\s*/, '').trim();
      const lower = rawTitle.toLowerCase();

      let type: 'new' | 'improved' | 'fixed' | 'general' = 'general';
      if (lower.includes('feature') || lower.includes('highlight') || lower.includes('new')) {
        type = 'new';
      } else if (lower.includes('improv') || lower.includes('enhanc') || lower.includes('cleanup') || lower.includes('playback')) {
        type = 'improved';
      } else if (lower.includes('fix') || lower.includes('bug') || lower.includes('patch')) {
        type = 'fixed';
      }

      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }

      currentSection = {
        title: rawTitle.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '').trim() || rawTitle,
        type,
        items: [],
      };
      continue;
    }

    // Bullet points (- or *)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const itemText = line.substring(2).trim();
      if (itemText) {
        if (!currentSection) {
          currentSection = {
            title: 'Highlights',
            type: 'new',
            items: [],
          };
        }
        currentSection.items.push(itemText);
      }
      continue;
    }

    // Paragraph text before first header = summary
    if (!foundFirstHeader && line.length > 0 && !line.startsWith('>')) {
      summaryParagraphs.push(line);
    }
  }

  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  // Fallback default sections if none parsed
  if (sections.length === 0) {
    sections.push({
      title: 'Highlights',
      type: 'new',
      items: [
        'Liquid Glass UI updates and performance speedups',
        'Offline audio playback and sync refinements',
      ],
    });
  }

  const summary = summaryParagraphs.join(' ').replace(/#+/g, '').trim() ||
    `AuraMusic ${version} is a major refinement featuring polished Liquid Glass surfaces, improved playback cache, and enhanced library speed.`;

  return { summary, sections };
}
