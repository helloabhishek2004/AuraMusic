"use client";

import {
  Download,
  Music,
  Headphones,
  ListMusic,
  SlidersHorizontal,
  Palette,
  BookOpen,
  Shield,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  Calendar,
  ExternalLink,
  Pause,
  Play,
  Tag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import MobileMenu from "@/components/MobileMenu";
import FaqAccordion from "@/components/FaqAccordion";
import DarkModeToggle from "@/components/DarkModeToggle";
import BackToTop from "@/components/BackToTop";
import ScrollReveal from "@/components/ScrollReveal";
import GitHubStats from "@/components/GitHubStats";
import VariantsModal from "@/components/VariantsModal";
import SiteFooter from "@/components/SiteFooter";
import { useState } from "react";
import { AuraRelease, GITHUB_REPO_URL, GITHUB_RELEASES_URL } from "@/lib/release";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const screenshots = [
  { src: "/screenshots/1.jpg", alt: "Home screen with Quick Picks and Keep Listening" },
  { src: "/screenshots/2.jpg", alt: "Now Playing screen with album art" },
  { src: "/screenshots/3.jpg", alt: "Synced lyrics display" },
  { src: "/screenshots/4.jpg", alt: "Artist page with top songs" },
  { src: "/screenshots/5.jpg", alt: "Music discovery view" },
  { src: "/screenshots/6.jpg", alt: "Library management and offline tracks" },
];

const features = [
  {
    icon: Activity,
    title: "AndroidX Media3 Playback",
    description:
      "Hardware-accelerated audio decoding, adaptive chunk buffering, and native MediaSession timeline synchronization for glitch-free playback.",
  },
  {
    icon: Music,
    title: "On-Device Stream Resolution",
    description:
      "Resolves raw media streams directly in Kotlin via InnerTube and on-device PoToken attestation without external proxy bottlenecks.",
  },
  {
    icon: Download,
    title: "Offline Caching & Downloads",
    description:
      "Download songs and albums with full metadata. Seamlessly play saved music anytime with zero active internet connection.",
  },
  {
    icon: BookOpen,
    title: "Live Synced Lyrics",
    description:
      "Time-synced LRC lyrics with word-by-word highlighting, powered by LRCLIB and KuGou with on-device Room SQLite caching.",
  },
  {
    icon: Headphones,
    title: "Background & Lock Screen Controls",
    description:
      "Foreground media service keeps playback smooth with full lock screen, Quick Settings, and Bluetooth headset controls.",
  },
  {
    icon: SlidersHorizontal,
    title: "System Equalizer Delegation",
    description:
      "Directly launch your device's native hardware equalizer linked to the active Android Audio Session ID for pristine sound tuning.",
  },
  {
    icon: Palette,
    title: "Liquid Glass Design",
    description:
      "Atmospheric glass surfaces, layered blur hierarchies, and real-time album cover dynamic color palette extraction.",
  },
  {
    icon: ListMusic,
    title: "Local-First Library & Playlists",
    description:
      "Full playlist management and listening history stored privately on your device in an on-device Room SQLite database.",
  },
  {
    icon: Sparkles,
    title: "Smart Queue & Discovery",
    description:
      "Multi-signal search ranking (token overlap, Jaro-Winkler) and vibe-aware dynamic queues with greedy diversity rules.",
  },
  {
    icon: Shield,
    title: "100% Private & Ad-Free",
    description:
      "No tracking SDKs, no behavioral telemetry, no user accounts, and zero commercial advertisement interruptions.",
  },
];

const techStack = [
  { name: "Kotlin & Media3", description: "Native Android audio core & ExoPlayer 1.9.2" },
  { name: "React Native 0.83", description: "Modern UI layer with New Architecture" },
  { name: "Expo SDK 55", description: "Native modules & platform runtime" },
  { name: "Room SQLite", description: "On-device persistence for tracks & history" },
  { name: "Liquid Glass", description: "Atmospheric blur & dynamic gradients" },
  { name: "Zustand & FlashList", description: "Reactive state & 120 FPS virtualization" },
  { name: "LRCLIB & KuGou", description: "Real-time synchronized LRC lyrics" },
  { name: "InnerTube Client", description: "Direct on-device stream resolution" },
];

const faqs = [
  {
    q: "Is AuraMusic free?",
    a: "Yes! AuraMusic is completely free and developed openly on GitHub with zero ads and zero tracking.",
  },
  {
    q: "Does AuraMusic contain any advertisements?",
    a: "No. AuraMusic contains zero audio ads, zero banner ads, and no third-party ad networks (no AdMob, Unity, or AppLovin SDKs).",
  },
  {
    q: "What devices are supported?",
    a: "AuraMusic supports devices running Android 7.0 (API Level 24) and higher.",
  },
  {
    q: "Do I need a Google or YouTube account to use AuraMusic?",
    a: "No account is required. AuraMusic operates locally on-device without requiring login or user registration.",
  },
  {
    q: "Can I use AuraMusic without an internet connection?",
    a: "Yes! Download tracks to your local device storage for offline playback anytime, anywhere.",
  },
  {
    q: "What audio engine powers AuraMusic?",
    a: "AuraMusic runs a bare-metal native Kotlin core utilizing AndroidX Media3 (ExoPlayer) for hardware-decoded, low-latency playback.",
  },
  {
    q: "Is AuraMusic open source?",
    a: "AuraMusic source code is hosted publicly on GitHub for transparency and community inspection. A formal open-source license selection is currently pending by the maintainer.",
  },
  {
    q: "Is AuraMusic available on the Google Play Store?",
    a: "AuraMusic is distributed directly through official GitHub releases as standalone signed APK downloads.",
  },
];

export default function HomePageClient({ release }: { release: AuraRelease }) {
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  const openVariantsModal = () => setShowVariantsModal(true);
  const closeVariantsModal = () => setShowVariantsModal(false);

  // The primary direct download link
  const primaryDownloadUrl =
    release.primaryApk?.downloadUrl ||
    `${GITHUB_RELEASES_URL}/download/${release.tag}/AuraMusic.apk`;

  const primaryApkSize = release.primaryApk?.sizeFormatted || "61.4 MB";

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* ─── Skip Link for Keyboard Users ─── */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ─── Navigation ─── */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/50 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="AuraMusic Home">
            <Image
              src="/app-icon.png"
              alt=""
              width={36}
              height={36}
              className="rounded-lg"
              priority
            />
            <span className="text-xl font-bold tracking-tight gradient-text">
              AuraMusic
            </span>
          </Link>
          <nav aria-label="Main Navigation" className="hidden lg:flex items-center space-x-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <a href="#features" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              Features
            </a>
            <Link href="/offline-music-player" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              Offline Player
            </Link>
            <Link href="/ad-free-music-player" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              Ad-Free
            </Link>
            <Link href="/youtube-music-alternative" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              Alternative
            </Link>
            <Link href="/changelog" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              Changelog
            </Link>
            <a href="#faq" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="AuraMusic GitHub repository (opens in new tab)"
              className="hidden sm:inline-flex items-center gap-2 min-h-[40px] px-4 py-2 text-sm font-medium rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <GithubIcon className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <a
              href={primaryDownloadUrl}
              download
              aria-label={`Download AuraMusic ${release.displayVersion} APK (${primaryApkSize})`}
              className="hidden sm:inline-flex items-center gap-2 min-h-[40px] px-5 py-2 text-sm font-semibold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
            >
              <Download aria-hidden="true" className="w-4 h-4" />
              Download {release.displayVersion}
            </a>
            <MobileMenu
              downloadUrl={primaryDownloadUrl}
              versionLabel={release.displayVersion}
              onOpenVariants={release.variants && release.variants.length > 1 ? openVariantsModal : undefined}
              links={[
                { href: "#features", label: "Features" },
                { href: "/offline-music-player", label: "Offline Music Player" },
                { href: "/ad-free-music-player", label: "Ad-Free & Privacy" },
                { href: "/youtube-music-alternative", label: "Streaming Alternative" },
                { href: "/changelog", label: "Changelog" },
                { href: "#faq", label: "FAQ" },
              ]}
            />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden py-16 sm:py-24">
          {/* Background glow */}
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-gradient-to-br from-orange-500/20 to-pink-500/20 rounded-full blur-3xl" />
          </div>

          <div className="max-w-5xl mx-auto px-4 text-center">
            <ScrollReveal>
              <a
                href="#whats-new"
                aria-label={`View release highlights for version ${release.displayVersion}`}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 text-xs font-medium rounded-full bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 hover:border-orange-500/40 transition-all group"
              >
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>
                  Latest Release · <strong className="font-semibold">{release.displayVersion}</strong>
                  {release.summary ? ` — ${release.summary}` : ""}
                </span>
                <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter leading-[1.1] mb-4">
                Android-First{" "}
                <span className="gradient-text">Music Player</span>{" "}
                with Native Media3
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-6 leading-relaxed">
                AuraMusic is a modern Android music player featuring native AndroidX Media3
                playback, on-device stream resolution, live synced lyrics, offline caching, and a signature
                Liquid Glass interface.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {/* Primary DIRECT download button */}
                <a
                  href={primaryDownloadUrl}
                  download
                  aria-label={`Download AuraMusic ${release.displayVersion} APK (${primaryApkSize})`}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-bold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] min-h-[44px]"
                >
                  <Download aria-hidden="true" className="w-4 h-4" />
                  <span>Download APK ({release.displayVersion})</span>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                    {primaryApkSize}
                  </span>
                </a>

                {/* Secondary: Other Builds & Architectures */}
                {release.variants && release.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={openVariantsModal}
                    aria-label="View other builds including TV, Cast, and ARM64"
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all min-h-[44px]"
                  >
                    <Layers aria-hidden="true" className="w-4 h-4 text-orange-500" />
                    <span>Other Builds (TV, Cast, ARM64)</span>
                  </button>
                )}

                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View AuraMusic source code on GitHub (opens in new tab)"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all min-h-[44px]"
                >
                  <GithubIcon className="w-4 h-4" />
                  GitHub
                </a>
              </div>

              {/* Quick links row */}
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View releases on GitHub (opens in new tab)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:text-orange-500 transition-colors"
                >
                  <Tag className="w-3.5 h-3.5" />
                  GitHub Releases
                </a>
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">•</span>
                <Link
                  href="/changelog"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full hover:text-orange-500 transition-colors"
                >
                  Full Changelog
                </Link>
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">•</span>
                <a
                  href={`${GITHUB_REPO_URL}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Report issue or feedback on GitHub (opens in new tab)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:text-orange-500 transition-colors"
                >
                  Issue Tracker
                </a>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={400}>
              <div className="mt-8">
                <GitHubStats />
              </div>
            </ScrollReveal>

            <p className="mt-6 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              Android 7.0+ (API 24+) • Native Media3 Core • Liquid Glass UI • Official Release {release.displayVersion}
            </p>
          </div>
        </section>

        {/* ─── Screenshots Carousel ─── */}
        <section id="screenshots" aria-label="App Screenshots" className="py-10 sm:py-14 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 mb-8 text-center">
            <ScrollReveal>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                See It in Action
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
                A sleek, atmospheric interface that makes album art pop. Every screen is crafted with Liquid Glass aesthetics.
              </p>
              <div className="flex items-center justify-center mt-4">
                <button
                  type="button"
                  onClick={() => setIsCarouselPaused((p) => !p)}
                  aria-label={isCarouselPaused ? "Resume screenshot animation" : "Pause screenshot animation"}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shadow-sm"
                >
                  {isCarouselPaused ? (
                    <>
                      <Play aria-hidden="true" className="w-3.5 h-3.5 text-orange-500" />
                      <span>Resume Animation</span>
                    </>
                  ) : (
                    <>
                      <Pause aria-hidden="true" className="w-3.5 h-3.5 text-orange-500" />
                      <span>Pause Animation</span>
                    </>
                  )}
                </button>
              </div>
            </ScrollReveal>
          </div>
          <div className="relative">
            <div className={`flex animate-scroll-left w-max gap-4 px-4 ${isCarouselPaused ? "is-paused" : ""}`}>
              {/* Primary set announced to screen readers */}
              {screenshots.map((s, i) => (
                <div
                  key={`screen-primary-${i}`}
                  className="flex-shrink-0 w-[160px] sm:w-[200px] rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800"
                >
                  <Image
                    src={s.src}
                    alt={s.alt}
                    width={200}
                    height={430}
                    className="w-full h-auto"
                  />
                </div>
              ))}
              {/* Duplicated loop set hidden from screen readers to prevent repetitive announcements */}
              {screenshots.map((s, i) => (
                <div
                  key={`screen-dup-${i}`}
                  aria-hidden="true"
                  className="flex-shrink-0 w-[160px] sm:w-[200px] rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-800"
                >
                  <Image
                    src={s.src}
                    alt=""
                    width={200}
                    height={430}
                    className="w-full h-auto"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── What's New in Latest Release ─── */}
        <section id="whats-new" aria-label="Release Highlights" className="py-12 sm:py-16 bg-zinc-100/50 dark:bg-zinc-900/40 border-y border-zinc-200/50 dark:border-zinc-800/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <ScrollReveal>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 mb-2">
                    <Sparkles aria-hidden="true" className="w-3.5 h-3.5" />
                    Latest Update Highlights
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    What&apos;s New in {release.displayVersion}
                  </h2>
                </div>
                {release.publishedDateFormatted && (
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 w-fit">
                    <Calendar aria-hidden="true" className="w-3.5 h-3.5 text-orange-500" />
                    <span>Published {release.publishedDateFormatted}</span>
                  </div>
                )}
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                <ul className="space-y-3 mb-6">
                  {release.changes.slice(0, 8).map((change, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed"
                    >
                      <span aria-hidden="true" className="mt-1.5 w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 flex-shrink-0" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                    <a
                      href={release.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View this release on GitHub (opens in new tab)"
                      className="inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400 hover:underline"
                    >
                      Release on GitHub <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
                    </a>
                    <Link
                      href="/changelog"
                      className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline"
                    >
                      Browse Version History →
                    </Link>
                  </div>
                  <span className="text-zinc-500 dark:text-zinc-400 font-mono">
                    {release.primaryApk?.name} ({primaryApkSize})
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ─── Features Grid ─── */}
        <section id="features" aria-label="AuraMusic Features" className="py-12 sm:py-16 bg-white dark:bg-zinc-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  Packed with Features
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm max-w-xl mx-auto">
                  Everything you need for the best music experience on Android.
                </p>
              </div>
            </ScrollReveal>
            <div className="grid grid-cols-2 gap-3">
              {features.map((f, i) => (
                <ScrollReveal key={f.title} delay={i * 20}>
                  <div className="group p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-500/50 transition-all hover:shadow-md h-full">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/10 to-pink-500/10 flex items-center justify-center mb-2 group-hover:from-orange-500/20 group-hover:to-pink-500/20 transition-colors">
                      <f.icon aria-hidden="true" className="w-4 h-4 text-orange-500" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            {/* Capability deep-dive intent cards */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/features"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-orange-500/50 transition-all group"
              >
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 block mb-1">Architecture</span>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Full Features Guide</span>
                  <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  AndroidX Media3 core, hardware equalizer, & synced lyrics.
                </p>
              </Link>

              <Link
                href="/offline-music-player"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-orange-500/50 transition-all group"
              >
                <span className="text-xs font-semibold text-pink-600 dark:text-pink-400 block mb-1">Airplane Mode</span>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Offline Music Player</span>
                  <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Listen without cellular data, Wi-Fi, or buffering pauses.
                </p>
              </Link>

              <Link
                href="/ad-free-music-player"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-orange-500/50 transition-all group"
              >
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">Privacy First</span>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Ad-Free & Private</span>
                  <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Zero audio commercials, no telemetry, and no account.
                </p>
              </Link>

              <Link
                href="/youtube-music-alternative"
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-orange-500/50 transition-all group"
              >
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 block mb-1">Comparison</span>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Streaming Alternative</span>
                  <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Background audio & lock-screen scrubber without subscription.
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Tech Stack ─── */}
        <section id="tech" aria-label="Technology Stack" className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  Built with Modern Tech
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm max-w-xl mx-auto">
                  AuraMusic leverages the best Android development tools and libraries.
                </p>
              </div>
            </ScrollReveal>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {techStack.map((t, i) => (
                <ScrollReveal key={t.name} delay={i * 50}>
                  <div className="text-center p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:shadow-md transition-shadow">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      {t.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Open Source Banner ─── */}
        <section aria-label="Open Source Commitment" className="py-10 bg-gradient-to-r from-orange-500/5 to-pink-500/5 border-y border-zinc-200/50 dark:border-zinc-800/50">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Shield aria-hidden="true" className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                    Open & Transparent Development
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-2">
                  Community & Code Transparency
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
                  AuraMusic is developed openly on GitHub. No tracking, no ads, no paywalls.
                  Explore the full repository, release notes, and issue tracker.
                </p>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Explore source code on GitHub (opens in new tab)"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-400 hover:underline"
                >
                  Explore on GitHub <ChevronRight aria-hidden="true" className="w-3 h-3" />
                </a>
              </div>
              <div className="flex-shrink-0" aria-hidden="true">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <GithubIcon className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" aria-label="Frequently Asked Questions" className="py-12 sm:py-16">
          <div className="max-w-3xl mx-auto px-4">
            <ScrollReveal>
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  Frequently Asked Questions
                </h2>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <FaqAccordion faqs={faqs} />
            </ScrollReveal>
          </div>
        </section>

        {/* ─── Download CTA ─── */}
        <section aria-label="Download AuraMusic Call to Action" className="py-12 sm:py-16 bg-gradient-to-br from-orange-500 to-pink-500 text-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
              Ready to Transform Your Listening?
            </h2>
            <p className="text-sm text-white/90 mb-6 max-w-xl mx-auto">
              Download AuraMusic now and experience music the way it was meant
              to be — beautiful, powerful, and free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Direct download */}
              <a
                href={primaryDownloadUrl}
                download
                aria-label={`Download AuraMusic ${release.displayVersion} APK (${primaryApkSize})`}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-full bg-white text-zinc-900 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] min-h-[44px]"
              >
                <Download aria-hidden="true" className="w-4 h-4" />
                <span>Download AuraMusic {release.displayVersion}</span>
                <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-semibold">
                  {primaryApkSize}
                </span>
              </a>

              {release.variants && release.variants.length > 1 && (
                <button
                  type="button"
                  onClick={openVariantsModal}
                  aria-label="Choose build variant including Android TV and Cast"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-full border-2 border-white/40 text-white hover:bg-white/10 transition-all min-h-[44px]"
                >
                  <Layers aria-hidden="true" className="w-4 h-4" />
                  Choose Variant
                </button>
              )}

              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View all releases on GitHub (opens in new tab)"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full border-2 border-white/30 text-white hover:bg-white/10 transition-all min-h-[44px]"
              >
                GitHub Releases
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter currentVersion={release.displayVersion} />

      <BackToTop />

      <VariantsModal
        isOpen={showVariantsModal}
        onClose={closeVariantsModal}
        variants={release.variants}
        versionTag={release.displayVersion}
      />
    </div>
  );
}
