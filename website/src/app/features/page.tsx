import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Music,
  Download,
  BookOpen,
  Headphones,
  Shield,
  ChevronRight,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import SiteFooter from "@/components/SiteFooter";
import BackToTop from "@/components/BackToTop";
import FaqAccordion from "@/components/FaqAccordion";
import { getLatestAuraRelease, GITHUB_REPO_URL, GITHUB_RELEASES_URL } from "@/lib/release";
import { getBaseUrl } from "@/lib/siteUrl";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const release = await getLatestAuraRelease();
  const version = release.displayVersion || "v2.0.0";

  return {
    title: "AuraMusic Features — Native AndroidX Media3 Audio Architecture",
    description: `Explore AuraMusic ${version}'s architecture: native AndroidX Media3 playback, on-device stream resolution, live synchronized lyrics, offline caching, and Liquid Glass design.`,
    alternates: {
      canonical: `${baseUrl}/features`,
    },
    openGraph: {
      title: `AuraMusic ${version} Features — Native AndroidX Media3 Architecture`,
      description:
        "Comprehensive technical guide to AuraMusic's audio engine, background playback, synchronized lyrics, and offline capabilities on Android.",
      url: `${baseUrl}/features`,
      siteName: "AuraMusic",
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `AuraMusic ${version} Features — Native AndroidX Media3 Architecture`,
      description:
        "Comprehensive technical guide to AuraMusic's audio engine, background playback, synchronized lyrics, and offline capabilities on Android.",
    },
  };
}

const featureFaqs = [
  {
    q: "How does AuraMusic's AndroidX Media3 engine improve audio playback?",
    a: "AuraMusic integrates AndroidX Media3 (ExoPlayer 1.9.2) directly in native Kotlin. This provides hardware-accelerated audio decoding, intelligent chunk buffer sizing to prevent buffering pauses, and low-latency audio session lifecycle management.",
  },
  {
    q: "Where do synchronized lyrics come from, and do they work offline?",
    a: "Synchronized lyrics are fetched in real-time from open lyric APIs including LRCLIB and KuGou. Once fetched, time-coded LRC lyrics are automatically cached locally in an on-device Room SQLite database so they remain viewable offline.",
  },
  {
    q: "Does background playback stop when I turn off my phone screen?",
    a: "No. AuraMusic runs a dedicated Android Foreground MediaService with MediaSessionCompat integration. Playback continues uninterrupted with the screen locked, accompanied by lock screen playback controls, notification timeline scrubbers, and Bluetooth AVRCP support.",
  },
  {
    q: "Can I use my phone's built-in equalizer with AuraMusic?",
    a: "Yes. AuraMusic delegates equalizer controls directly to your device's native hardware audio effects engine by broadcasting the active Android Audio Session ID. This lets you utilize Dolby Atmos, Samsung SoundAlive, or Xiaomi Sound enhancements without audio distortion.",
  },
  {
    q: "What Android versions are supported by AuraMusic?",
    a: "AuraMusic requires Android 7.0 (API Level 24) or newer. It is compiled to target the latest Android SDK specifications with full support for 64-bit and 32-bit ARM/x86 architectures via its Universal APK.",
  },
];

export default async function FeaturesPage() {
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
        name: "Features",
        item: `${baseUrl}/features`,
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
    codeRepository: GITHUB_REPO_URL,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Person",
      name: "Abhishek",
      url: "https://github.com/helloabhishek2004",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: featureFaqs.map((faq) => ({
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
        currentPath="/features"
        downloadUrl={primaryApkUrl}
        versionLabel={release.displayVersion}
        sizeFormatted={primaryApkSize}
      />

      <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none">
        {/* Breadcrumb nav */}
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
                Features
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <section className="py-12 sm:py-16 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 mb-4">
              Architecture & Capabilities
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">
              Engineering the Next-Generation{" "}
              <span className="gradient-text">Android Music Player</span>
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              AuraMusic is an independent, ad-free Android music player engineered for audiophiles
              and daily listeners. By combining native AndroidX Media3 audio pipelines with
              on-device stream resolution and local SQLite caching, AuraMusic delivers fast,
              private, and reliable music playback on Android 7.0 and above.
            </p>
          </div>

          {/* Quick Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">Native Media3 Core</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Powered by ExoPlayer 1.9.2 directly in Kotlin. Hardware decoding, native audio session management, and adaptive buffering.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center mb-4">
                <Download className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">Offline-First Caching</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Save audio streams, artwork, and synchronized lyrics directly to your device storage for seamless airplane-mode listening.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">100% Private & Ad-Free</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Zero advertisement SDKs, zero telemetry tracking, no analytics pings, and no user accounts required.
              </p>
            </div>
          </div>

          {/* Deep Dives Section */}
          <div className="space-y-12 mb-16">
            {/* Deep Dive 1: Media3 */}
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500">
                  <Activity className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">AndroidX Media3 Audio Architecture</h2>
              </div>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                Unlike web wrappers that suffer from high audio latency and stutter during background multitasking,
                AuraMusic is built upon the official Google AndroidX Media3 framework. The native playback module
                directly interfaces with ExoPlayer, configuring low-latency audio sinks and dynamic buffer watermarks.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Hardware-accelerated Opus and AAC decoding
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Adaptive pre-buffering to prevent playback stalls
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Seamless audio track gapless transitions
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Dynamic audio focus and ducking management
                </li>
              </ul>
            </div>

            {/* Deep Dive 2: On-Device Resolution */}
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-500">
                  <Music className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Direct On-Device Stream Resolution</h2>
              </div>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                Many third-party music apps route user requests through remote proxy servers, introducing latency,
                single points of failure, and serious privacy risks. AuraMusic performs stream resolution directly
                on the client device. Using Kotlin-native InnerTube clients and PoToken attestation, the app negotiates
                direct content delivery networks without intermediary interception.
              </p>
              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <strong>Privacy Guarantee:</strong> Your search terms, song requests, and IP address are never logged by a central AuraMusic server because no such backend proxy exists.
              </div>
            </div>

            {/* Deep Dive 3: Synced Lyrics */}
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Live Synchronized Lyrics Engine</h2>
              </div>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                Sing along with precision. AuraMusic fetches time-stamped LRC lyrics from community databases
                such as LRCLIB and KuGou. The playback position synchronizes at millisecond intervals, highlighting
                the active vocal line with smooth scrolling typography.
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Downloaded tracks retain their synchronized lyrics in the local SQLite database, allowing you to
                view synchronized lyrics even when completely disconnected from the internet.
              </p>
            </div>

            {/* Deep Dive 4: Background & System Controls */}
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                  <Headphones className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Background Audio & Lock Screen Controls</h2>
              </div>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                AuraMusic integrates deeply with Android&apos;s system media infrastructure. By registering a foreground
                MediaService with active notification lifecycles:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <strong>Lock Screen Scrubber:</strong> Seamlessly seek through audio from your lock screen on Android 13+ devices.
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <strong>Bluetooth Headset Commands:</strong> Full playback control via wireless earbuds, smartwatches, and car head units.
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <strong>Hardware Equalizer Delegation:</strong> Send audio output directly to system DSPs (Dolby Atmos, Samsung SoundAlive).
                </li>
              </ul>
            </div>
          </div>

          {/* Technical Specifications Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-center">Technical Specifications</h2>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                    <th className="p-4 font-semibold text-zinc-900 dark:text-zinc-100">Specification</th>
                    <th className="p-4 font-semibold text-zinc-900 dark:text-zinc-100">AuraMusic Implementation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <tr>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">Audio Engine</td>
                    <td className="p-4">AndroidX Media3 (ExoPlayer 1.9.2 core in native Kotlin)</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">Minimum Android Version</td>
                    <td className="p-4">Android 7.0 (API Level 24 - Nougat) or higher</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">Architecture Support</td>
                    <td className="p-4">Universal APK (arm64-v8a, armeabi-v7a, x86, x86_64)</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">Offline Storage</td>
                    <td className="p-4">Local app-sandboxed storage with on-device Room SQLite database</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">Lyrics Protocol</td>
                    <td className="p-4">Time-coded LRC format fetched via LRCLIB and KuGou APIs</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">Advertising & Telemetry</td>
                    <td className="p-4">Zero third-party advertising SDKs, zero user tracking</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium text-zinc-900 dark:text-zinc-200">License & Source</td>
                    <td className="p-4">
                      Public source code inspectable on{" "}
                      <a
                        href={GITHUB_REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-orange-500"
                      >
                        GitHub
                      </a>{" "}
                      (formal open-source license selection pending by author)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Deep Navigation / Intent Linking */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            <Link
              href="/offline-music-player"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Offline Music Player</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Learn how offline caching and downloads function without internet.
              </p>
            </Link>

            <Link
              href="/ad-free-music-player"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Ad-Free Architecture</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Discover why AuraMusic contains zero audio ads or trackers.
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
                Compare AuraMusic against mainstream subscription music services.
              </p>
            </Link>
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
              Frequently Asked Questions About AuraMusic
            </h2>
            <FaqAccordion faqs={featureFaqs} />
          </div>

          {/* Download CTA Banner */}
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Experience AuraMusic {release.displayVersion} on Android
            </h2>
            <p className="text-sm text-white/90 max-w-xl mx-auto mb-6">
              Download the official Universal APK directly from GitHub. Android 7.0+ compatible, ad-free, and ready for your library.
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
                href="/changelog"
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-full border border-white/40 text-white hover:bg-white/10 transition-all"
              >
                View Changelog
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
