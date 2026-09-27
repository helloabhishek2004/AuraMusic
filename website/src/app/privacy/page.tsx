import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import {
  ArrowLeft,
  Shield,
  Database,
  Wifi,
  EyeOff,
  Lock,
  Key,
  FolderLock,
  CloudOff,
  Trash2,
  Users,
  Scale,
  FileText,
  Mail,
  CheckCircle2,
} from "lucide-react";

import { getBaseUrl } from "@/lib/siteUrl";

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy information for AuraMusic: local-first architecture, zero telemetry, on-device data storage, and user privacy rights.",
  alternates: {
    canonical: `${baseUrl}/privacy`,
  },
  openGraph: {
    title: "AuraMusic — Privacy Policy",
    description:
      "Privacy information for AuraMusic: local-first architecture, zero telemetry, on-device data storage, and user privacy rights.",
    url: `${baseUrl}/privacy`,
    siteName: "AuraMusic",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraMusic — Privacy Policy",
    description:
      "Privacy information for AuraMusic: local-first architecture, zero telemetry, on-device data storage, and user privacy rights.",
  },
};

const sections = [
  {
    icon: Shield,
    title: "1. Overview & Data Philosophy",
    content:
      "AuraMusic is an independent personal audio client application and technical research project. The application operates on a 100% local-first, on-device architecture. AuraMusic does not operate any centralized user database, intermediary streaming proxy, or remote analytics collection servers. You do not need to register, provide an email address, or create a profile to use any feature of AuraMusic.",
  },
  {
    icon: Database,
    title: "2. Information Processed On-Device (Local-Only)",
    content:
      "All custom playlists, liked tracks, listening history, play counts, and user preferences are stored strictly inside your Android device's private app sandbox. This includes SQLite database files (aura_music.db), user interface preferences (aura_player_prefs.xml), and AsyncStorage key-value stores. Despite internal state module naming (e.g. useAnalyticsStore), listening metrics are used exclusively on-device to compute local features such as 'Quick Picks', 'Top Tracks', and 'Keep Listening'. This data is never uploaded off your device.",
  },
  {
    icon: Wifi,
    title: "3. Direct Outbound Network Requests",
    content:
      "To discover and play audio, AuraMusic initiates direct HTTPS connections from your device to third-party providers. When connecting, standard TCP/IP transport metadata (such as your IP address and HTTP User-Agent) is transmitted as required by Internet protocols: (a) YouTube & Googlevideo CDN (Google LLC) for catalog search, metadata, and audio stream playback; (b) LRCLIB Community API for synchronized and unsynced lyrics matching; (c) KuGou Lyrics for international lyrics fallback; (d) GitHub API for in-app software release checks; and (e) Google generate_204 for network connectivity diagnostics. AuraMusic does not intercept, log, or proxy these requests through any intermediary server.",
  },
  {
    icon: EyeOff,
    title: "4. Zero Analytics & Tracking Telemetry",
    content:
      "AuraMusic contains NO commercial telemetry or tracking SDKs: no Google Analytics, no Firebase Analytics or Crashlytics, no Meta (Facebook) SDK, no Sentry, no Mixpanel, and no advertising identifiers (AAID/IDFA). The application and website are completely free of third-party advertisements and behavioral tracking cookies.",
  },
  {
    icon: Lock,
    title: "5. Android Permissions & Justifications",
    content:
      "Permissions requested by AuraMusic are strictly tied to local media functionality: FOREGROUND_SERVICE & MEDIA_PLAYBACK for uninterrupted playback with notification controls; FOREGROUND_SERVICE_DATA_SYNC for background track caching; READ_MEDIA_AUDIO / READ_EXTERNAL_STORAGE solely when you choose to scan and play audio stored locally on your device; and RECORD_AUDIO historically required by Android's Visualizer API for FFT waveform spectrum visualization (AuraMusic never records or saves microphone audio).",
  },
  {
    icon: Key,
    title: "6. Optional Connected Services",
    content:
      "AuraMusic includes optional integrations to import playlists: Google Sign-In (for YouTube playlists via https://www.googleapis.com/auth/youtube.readonly) and Spotify PKCE OAuth (via accounts.spotify.com). In both cases, authorization tokens are encrypted locally in expo-secure-store. AuraMusic never sees, handles, or transmits your passwords, and you can disconnect these accounts at any time from Settings.",
  },
  {
    icon: FolderLock,
    title: "7. Storage Isolation & Offline Downloads",
    content:
      "Downloaded audio files (/files/aura/audio/) and cached album artwork (/files/aura/artwork/) are isolated within the private Android application sandbox. The operating system blocks other non-root apps from inspecting these files. Wiping the app or uninstalling AuraMusic permanently erases all sandbox data.",
  },
  {
    icon: CloudOff,
    title: "8. Android Auto Backup Rules",
    content:
      "AuraMusic configures Android Auto Backup to preserve only essential preferences and playlist databases (under 1 MB). Downloaded audio chunks, media caches, and artwork are strictly excluded from cloud backups.",
  },
  {
    icon: Trash2,
    title: "9. Data Retention & User Controls",
    content:
      "You have direct control over all stored data: (a) Clear Song Cache via Settings → Storage & Cache; (b) Delete Offline Downloads individually or via Settings → Clear Downloads; (c) Clear Listening History in Library Settings; or (d) Clear App Data or Uninstall in Android Settings to wipe 100% of stored data immediately.",
  },
  {
    icon: Users,
    title: "10. Children's Privacy",
    content:
      "AuraMusic is a general-purpose audio player utility and does not collect personal information from any user, including children under 13 years of age (or under 16/18 under applicable regional laws).",
  },
  {
    icon: Scale,
    title: "11. Rights Under Applicable Laws",
    content:
      "AuraMusic adheres to international privacy standards including India's Digital Personal Data Protection Act, 2023, the EU General Data Protection Regulation (GDPR), and the California Consumer Privacy Act (CCPA). Because all data is held locally on your device, rights to access, rectification, and erasure are exercisable directly through the app without requiring interaction with a central data fiduciary.",
  },
  {
    icon: FileText,
    title: "12. Google Play Data Safety Alignment",
    content:
      "This policy aligns completely with Google Play Data Safety declarations: zero user data types are collected or shared off-device by the developer. All processing is on-device, with outbound media requests routed directly to the user-selected content provider.",
  },
  {
    icon: Mail,
    title: "13. Contact & Grievance Redressal",
    content:
      "For privacy questions, technical inquiries, or architectural reviews, please consult our official GitHub repository at github.com/helloabhishek2004/AuraMusic or open an issue on GitHub.",
  },
];

export default function PrivacyPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Privacy Policy",
        item: `${baseUrl}/privacy`,
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-500/30 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Skip Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 border-b border-zinc-800/80 backdrop-blur-md bg-zinc-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              aria-label="Back to AuraMusic home page"
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors py-2"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Back to Home
            </Link>
            <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <Image
                src="/app-icon.png"
                alt=""
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-white">AuraMusic</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/terms"
              className="text-purple-400 hover:text-purple-300 transition-colors py-2"
            >
              Terms of Service →
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-grow py-12 sm:py-16 focus:outline-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Shield aria-hidden="true" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Privacy Policy & Transparency Notice
              </h1>
              <p className="text-xs font-mono text-zinc-400 mt-1">
                Effective: September 26, 2026 • Last Updated: September 26, 2026 • v2.0.0
              </p>
            </div>
          </div>

          <div className="my-8 p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-1">Local-First Architecture:</strong>
              AuraMusic stores user data strictly on your Android device. We operate no intermediary collection servers, collect zero personal telemetry, and employ zero tracking SDKs.
            </div>
          </div>

          <div className="space-y-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.title}
                  className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80"
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <Icon aria-hidden="true" className="w-4 h-4 text-purple-400" />
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <Link
              href="/"
              aria-label="Back to AuraMusic home page"
              className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-medium py-2"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Back to Home
            </Link>
            <Link
              href="/terms"
              className="hover:text-zinc-300 transition-colors py-2"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
