/**
 * Google Analytics 4 (GA4) Integration & Event Tracking Service
 *
 * Provides typed helpers for tracking:
 * - Pageviews (SPA routes & sections)
 * - APK Downloads
 * - Navigation & Redirects
 * - GitHub Repository visits
 * - Creator Portfolio visits
 * - Socials / Sponsorship visits
 * - Track Skip events (Next / Previous)
 * - Share Link actions
 * - Audio Play / Pause
 * - Sound Mood / Profile changes
 * - FAQ interactions
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    GA_MEASUREMENT_ID?: string;
  }
}

// Default Measurement ID can be supplied via Vite environment variables or window global
export const GA_MEASUREMENT_ID: string =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_GA_MEASUREMENT_ID) ||
  (typeof window !== "undefined" && window.GA_MEASUREMENT_ID) ||
  "G-TX8EQV2624";

let isInitialized = false;

/**
 * Initializes Google Analytics (gtag.js) script dynamically if not already present.
 */
export function initGA(customId?: string): void {
  if (typeof window === "undefined") return;

  const id = customId || GA_MEASUREMENT_ID;
  if (!id) {
    if (import.meta.env?.DEV) {
      console.info(
        "[GA4] No VITE_GA_MEASUREMENT_ID configured. Analytics events will be logged in console.",
      );
    }
    return;
  }

  if (isInitialized) return;

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  // Check if script is already in document
  const existingScript = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${id}"]`,
  );
  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", id, {
    send_page_view: false, // Dispatched manually for accurate SPA virtual pageviews
  });

  isInitialized = true;
  if (import.meta.env?.DEV) {
    console.log(`[GA4] Initialized with Measurement ID: ${id}`);
  }
}

/**
 * Helper to dispatch gtag commands safely
 */
export function gtagSafe(...args: any[]): void {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    try {
      window.gtag(...args);
    } catch (err) {
      console.warn("[GA4] Error executing gtag:", err);
    }
  }

  if (import.meta.env?.DEV) {
    console.debug("[GA4 Event]", ...args);
  }
}

/**
 * Track SPA Virtual Page View
 */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  gtagSafe("event", "page_view", {
    page_path: pagePath,
    page_title:
      pageTitle || (typeof document !== "undefined" ? document.title : ""),
    page_location: typeof window !== "undefined" ? window.location.href : "",
  });
}

/**
 * Track APK Downloads
 */
export function trackDownload(
  version: string,
  apkName: string,
  source: string = "website",
): void {
  // Custom semantic event
  gtagSafe("event", "download_apk", {
    version,
    apk_name: apkName,
    source,
  });

  // Standard GA4 recommended file_download event
  gtagSafe("event", "file_download", {
    file_name: apkName,
    file_extension: "apk",
    link_text: `Download APK (${version})`,
    source,
  });
}

/**
 * Track Page Redirect / Section Navigation
 */
export function trackPageRedirect(
  destination: string,
  type: "internal_nav" | "route_change" = "internal_nav",
): void {
  gtagSafe("event", "page_redirect", {
    destination,
    redirect_type: type,
  });
}

/**
 * Track GitHub Repository visits
 */
export function trackGithubVisit(
  source: string,
  url: string = "https://github.com/helloabhishek2004/AuraMusic",
): void {
  gtagSafe("event", "github_visit", {
    source,
    url,
  });

  gtagSafe("event", "outbound_click", {
    destination: "github",
    source,
    url,
  });
}

/**
 * Track Portfolio visits
 */
export function trackPortfolioVisit(
  source: string,
  url: string = "https://aboutabhishek.runs-on.dev",
): void {
  gtagSafe("event", "portfolio_visit", {
    source,
    url,
  });

  gtagSafe("event", "outbound_click", {
    destination: "portfolio",
    source,
    url,
  });
}

/**
 * Track Socials / Sponsorship visits (e.g. Buy Me a Coffee)
 */
export function trackSocialVisit(
  platform: string,
  url: string,
  source: string,
): void {
  gtagSafe("event", "social_visit", {
    platform,
    source,
    url,
  });

  gtagSafe("event", "outbound_click", {
    destination: platform,
    source,
    url,
  });
}

/**
 * Track Track Skip actions (Skip Forward / Skip Backward in player)
 */
export function trackTrackSkipped(
  direction: "next" | "prev",
  trackTitle: string = "Aura Track",
  source: string = "showcase",
): void {
  gtagSafe("event", "track_skipped", {
    direction,
    track_title: trackTitle,
    component_source: source,
  });
}

/**
 * Track Link Sharing (Native Share or Clipboard copy)
 */
export function trackShareLink(
  method: "native_share" | "clipboard_copy",
  url: string = typeof window !== "undefined" ? window.location.href : "",
): void {
  gtagSafe("event", "share", {
    method,
    content_type: "website_link",
    item_id: url,
  });

  gtagSafe("event", "share_link", {
    method,
    shared_url: url,
  });
}

/**
 * Track Audio Play / Pause actions
 */
export function trackAudioPlayback(
  action: "play" | "pause",
  trackTitle: string = "Sonic Nebula",
  source: string = "hero",
): void {
  gtagSafe("event", action === "play" ? "audio_play" : "audio_pause", {
    track_title: trackTitle,
    source,
  });
}

/**
 * Track Sound Mood / Profile change in Option Wheel
 */
export function trackSoundProfileChange(mood: string): void {
  gtagSafe("event", "sound_profile_change", {
    mood,
  });
}

/**
 * Track FAQ item expand/collapse
 */
export function trackFaqToggle(question: string, isOpen: boolean): void {
  gtagSafe("event", "faq_toggle", {
    question,
    state: isOpen ? "opened" : "closed",
  });
}

/**
 * Track Lyrics view action
 */
export function trackLyricsView(trackTitle?: string): void {
  gtagSafe("event", "lyrics_view", {
    track_title: trackTitle || "Current Track",
  });
}

/**
 * Share website helper that triggers native sharing or copies to clipboard
 */
export async function shareAuraWebsite(): Promise<
  "shared" | "copied" | "failed"
> {
  const url =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://listenwith-auramusic.vercel.app";
  const title = "AuraMusic — Free, Ad-Free Offline Android Music Player";
  const text =
    "Discover AuraMusic: 100% free, ad-free Android music player with offline playback, native Media3 engine, and synced lyrics.";

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ title, text, url });
      trackShareLink("native_share", url);
      return "shared";
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // User cancelled share dialog
        return "failed";
      }
      // Fallback to clipboard if share threw unexpected error
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      trackShareLink("clipboard_copy", url);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
