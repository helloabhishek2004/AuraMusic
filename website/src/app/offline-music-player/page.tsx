import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  WifiOff,
  HardDrive,
  Plane,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import SiteFooter from "@/components/SiteFooter";
import BackToTop from "@/components/BackToTop";
import FaqAccordion from "@/components/FaqAccordion";
import { getLatestAuraRelease, GITHUB_RELEASES_URL } from "@/lib/release";
import { getBaseUrl } from "@/lib/siteUrl";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const release = await getLatestAuraRelease();
  const version = release.displayVersion || "v2.0.0";

  return {
    title: "Offline Music Player for Android — Play Downloaded Songs Without Internet | AuraMusic",
    description: `Learn how AuraMusic ${version} handles offline audio on Android. Downloaded tracks can be played without an internet connection, while streaming requires connectivity.`,
    alternates: {
      canonical: `${baseUrl}/offline-music-player`,
    },
    openGraph: {
      title: `Offline Music Player for Android — AuraMusic ${version}`,
      description:
        "Downloaded tracks can be played without an internet connection. Learn how AuraMusic manages sandboxed offline downloads, persistent queues, and local lyrics on Android.",
      url: `${baseUrl}/offline-music-player`,
      siteName: "AuraMusic",
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `Offline Music Player for Android — AuraMusic ${version}`,
      description:
        "Downloaded tracks can be played without an internet connection. Learn how AuraMusic manages sandboxed offline downloads, persistent queues, and local lyrics on Android.",
    },
  };
}

const offlineFaqs = [
  {
    q: "Does AuraMusic work in Airplane Mode or without Wi-Fi?",
    a: "Yes, for tracks you have downloaded. When you download a track in AuraMusic, the audio and metadata are stored in your device's private app storage. Downloaded tracks can be played without an internet connection, whereas streaming non-downloaded tracks requires connectivity.",
  },
  {
    q: "Do downloaded songs expire after 30 days like other streaming apps?",
    a: "No. Unlike subscription streaming services that enforce periodic online license verification check-ins, AuraMusic does not attach DRM expiration timers to your downloaded tracks.",
  },
  {
    q: "Where does AuraMusic store downloaded music on my phone?",
    a: "Downloads are stored safely inside AuraMusic's private application sandbox (Android/data/com.anonymous.AuraMusic/files/download). This complies with Android scoped storage rules and does not require broad external file management permissions.",
  },
  {
    q: "Do synchronized lyrics work while offline?",
    a: "Yes. When a track is downloaded or its lyrics are viewed while online, time-coded LRC lyrics are stored in an on-device Room SQLite database. During offline playback of downloaded songs, the player retrieves the lyrics locally.",
  },
  {
    q: "Does playing offline music use mobile data?",
    a: "No cellular data is consumed when playing tracks that have been physically downloaded. However, searching for new music, streaming online tracks, or performing the initial download requires an active internet connection.",
  },
];

export default async function OfflineMusicPlayerPage() {
  const baseUrl = getBaseUrl();
  const release = await getLatestAuraRelease();
  const primaryApkUrl =
    release.primaryApk?.downloadUrl ||
    `${GITHUB_RELEASES_URL}/download/${release.tag}/AuraMusic-${release.tag}-universal.apk`;
  const primaryApkSize = release.primaryApk?.sizeFormatted || "110.2 MB";

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
        name: "Offline Music Player",
        item: `${baseUrl}/offline-music-player`,
      },
    ],
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AuraMusic",
    operatingSystem: "Android 7.0+",
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "AudioApplication",
    softwareVersion: release.version,
    fileSize: primaryApkSize,
    downloadUrl: primaryApkUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: offlineFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <SubPageHeader
        currentPath="/offline-music-player"
        downloadUrl={primaryApkUrl}
        versionLabel={release.displayVersion}
        sizeFormatted={primaryApkSize}
      />

      <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none">
        {/* Breadcrumbs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-2">
          <nav aria-label="Breadcrumb" className="text-xs text-zinc-500 dark:text-zinc-400">
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-zinc-800 dark:text-zinc-200 font-medium" aria-current="page">
                Offline Music Player
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <section className="py-12 sm:py-16 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 mb-4">
              Local Audio Storage
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">
              Play <span className="gradient-text">Downloaded Music Offline</span> on Android
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              AuraMusic enables you to download tracks to your Android device for playback when no internet
              connection is available. Downloaded songs, albums, and synchronized lyrics reside in private app storage.
              Note the key distinction: physically downloaded tracks can be played without an internet connection,
              whereas streaming cache may be unavailable when offline.
            </p>
          </div>

          {/* Offline Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                <WifiOff className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">No Connection for Downloads</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Downloaded tracks initialize directly from local storage without network handshakes or buffering pauses.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center mb-4">
                <Plane className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">Airplane Mode Ready</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Enjoy continuous music playback during long-haul flights or remote travels without Wi-Fi or cellular service.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <HardDrive className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">Private Sandboxed Storage</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Music files reside within the app&apos;s sandboxed filesystem, requiring zero invasive Android permissions.
              </p>
            </div>
          </div>

          {/* Deep Architectural Sections */}
          <div className="space-y-12 mb-16">
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <FileAudio className="w-6 h-6 text-orange-500" />
                What Gets Saved in AuraMusic&apos;s Offline Cache?
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                When you download or cache a track in AuraMusic, the application preserves all media components needed for a full listening experience:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Original High-Quality Audio</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      Raw Opus and AAC audio streams decoded hardware-natively without downsampling or lossy compression.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Full Metadata & Cover Art</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      Track titles, artist information, album names, durations, and high-resolution album artwork.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Time-Synced LRC Lyrics</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      Word-by-word synchronized lyrics are cached in an on-device SQLite database for offline display.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Dynamic Offline Queues</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      Shuffle, repeat, and custom playlist order maintain continuity even with airplane mode enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works Section */}
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <h2 className="text-2xl font-bold mb-6">How to Use Offline Playback in AuraMusic</h2>
              <ol className="space-y-6">
                <li className="flex items-start gap-4">
                  <span className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    1
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Search and Select Tracks</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      While connected to Wi-Fi or cellular data, browse or search for your favorite songs, artists, or playlists.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <span className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    2
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Tap Download or Stream to Cache</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Tap the download button on any song or playlist. AuraMusic will buffer and store the audio stream locally.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <span className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    3
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Open Library & Enjoy Offline</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Turn on Airplane Mode or disconnect from the internet. Open your Library tab in AuraMusic to play your saved music instantly.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            {/* Clear Technical Limitations */}
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-amber-500/5 dark:bg-amber-500/10">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Honest Technical Limitations of Offline Mode
                </h2>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                To maintain search integrity and transparent expectations, users should note what offline mode does and does not do:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>Online Catalog Search:</strong> Discovering new artists and searching the global catalog requires an active internet connection.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>Device Storage:</strong> Offline music requires available internal flash storage on your Android device (approximately 3–6 MB per high-bitrate song).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>No Cloud Sync:</strong> Because AuraMusic does not require or collect user accounts, downloaded caches are stored locally on each device.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Intent Cross-Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            <Link
              href="/ad-free-music-player"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Ad-Free Listening</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Zero audio commercials, popups, or tracking SDKs.
              </p>
            </Link>

            <Link
              href="/features"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Architecture & Media3</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Deep dive into the native Kotlin audio engine.
              </p>
            </Link>

            <Link
              href="/youtube-music-alternative"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Streaming Alternative</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Compare features with subscription streaming services.
              </p>
            </Link>
          </div>

          {/* FAQs */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
              Frequently Asked Questions About Offline Playback
            </h2>
            <FaqAccordion faqs={offlineFaqs} />
          </div>

          {/* Download CTA */}
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Download AuraMusic for Android
            </h2>
            <p className="text-sm text-white/90 max-w-xl mx-auto mb-6">
              Get the latest Universal APK ({release.displayVersion}). Download songs once, listen offline forever.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={primaryApkUrl}
                download
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-full bg-white text-zinc-900 shadow-md hover:bg-zinc-100 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download APK ({primaryApkSize})</span>
              </a>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-full border border-white/40 text-white hover:bg-white/10 transition-all"
              >
                Explore All Features
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter currentVersion={release.displayVersion} />
      <BackToTop />
    </div>
  );
}
