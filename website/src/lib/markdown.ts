/**
 * Safe markdown parser and release notes formatter for AuraMusic
 * Extracts structured sections, bullet items, and note callouts
 * without dangerous raw HTML injection.
 */

export interface FormattedReleaseSection {
  title?: string;
  items: string[];
}

export interface ParsedReleaseNotes {
  callout?: string;
  sections: FormattedReleaseSection[];
  rawBulletItems: string[];
}

/**
 * Strips HTML tags and markdown symbols from a single line
 */
export function sanitizeLine(line: string): string {
  if (!line) return "";
  return line
    .replace(/<[^>]*>/g, "") // remove HTML tags
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // replace markdown links with text
    .replace(/[*_~`]/g, "") // remove formatting tokens
    .trim();
}

/**
 * Parses GitHub release body into safe structured data
 */
export function parseReleaseNotes(body: string): ParsedReleaseNotes {
  if (!body) {
    return { sections: [], rawBulletItems: [] };
  }

  const lines = body.split("\n");
  let callout: string | undefined;
  const sections: FormattedReleaseSection[] = [];
  const rawBulletItems: string[] = [];

  let currentSection: FormattedReleaseSection = {
    title: undefined,
    items: [],
  };

  let inCallout = false;
  let calloutBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // GitHub blockquote / callout: > [!NOTE] or > AuraMusic...
    if (line.startsWith(">")) {
      inCallout = true;
      const stripped = line.replace(/^>\s*/, "").replace(/^\[!NOTE\]\s*/i, "").trim();
      if (stripped) {
        calloutBuffer.push(stripped);
      }
      continue;
    } else if (inCallout) {
      inCallout = false;
      if (calloutBuffer.length > 0) {
        callout = calloutBuffer.join(" ");
        calloutBuffer = [];
      }
    }

    // Heading: ## or ###
    if (line.startsWith("#")) {
      const headingText = line.replace(/^#+\s*/, "").trim();
      if (
        headingText &&
        !headingText.toLowerCase().includes("release notes") &&
        !headingText.toLowerCase().includes("what's new")
      ) {
        // Save current section if it has items
        if (currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          title: headingText,
          items: [],
        };
      }
      continue;
    }

    // Bullet items
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const itemText = line.replace(/^[-*]\s+/, "").trim();
      // Skip generic compare link lines
      if (
        itemText &&
        !itemText.toLowerCase().includes("full changelog:") &&
        !itemText.toLowerCase().includes("compare/")
      ) {
        const cleaned = sanitizeLine(itemText);
        if (cleaned) {
          currentSection.items.push(cleaned);
          rawBulletItems.push(cleaned);
        }
      }
      continue;
    }
  }

  if (calloutBuffer.length > 0 && !callout) {
    callout = calloutBuffer.join(" ");
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return {
    callout,
    sections,
    rawBulletItems,
  };
}
