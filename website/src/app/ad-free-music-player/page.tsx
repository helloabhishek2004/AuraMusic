import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  UserX,
  Ban,
  Download,
  ChevronRight,
  Lock,
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
    title: "Ad-Free Android Music Player — No Audio Ads, Zero Tracking | AuraMusic",
    description: `Listen to music without interruptions. AuraMusic ${version} features zero audio commercials, no banner ads, no tracking SDKs, and no subscriptions or account requirements on Android.`,
    alternates: {
      canonical: `${baseUrl}/ad-free-music-player`,
    },
    openGraph: {
      title: `Ad-Free Android Music Player — AuraMusic ${version}`,
      description:
        "Experience pure music playback on Android with zero commercials, no tracking telemetry, and no account requirements.",
      url: `${baseUrl}/ad-free-music-player`,
      siteName: "AuraMusic",
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `Ad-Free Android Music Player — AuraMusic ${version}`,
      description:
        "Experience pure music playback on Android with zero commercials, no tracking telemetry, and no account requirements.",
    },
  };
}

const adFreeFaqs = [
  {
    q: "How is AuraMusic completely free without showing ads?",
    a: "AuraMusic is developed as an independent personal engineering project by Abhishek. Because there are no corporate overheads, venture capital expectations, or cloud-server hosting bills for user accounts, there is no need to monetize users with ads or subscriptions.",
  },
  {
    q: "Does AuraMusic play audio commercials between songs?",
    a: "No. AuraMusic streams and plays music directly via AndroidX Media3 without inserting audio advertisements, sponsors, or promotional breaks between tracks.",
  },
  {
    q: "Does AuraMusic track or sell my listening history?",
    a: "Never. AuraMusic bundles zero telemetry or analytics SDKs (no Firebase Analytics, Google Analytics, or third-party trackers). Your favorite tracks, playlists, and listening history are stored exclusively on your device in a local Room SQLite database.",
  },
  {
    q: "Do I have to create an account or provide an email address?",
    a: "No. AuraMusic requires no account registration, no login, and no email or phone number. You install the APK and can immediately start listening.",
  },
  {
    q: "Will AuraMusic add a paid premium tier or ads in the future?",
    a: "No. The project architecture is fundamentally client-side and non-commercial. AuraMusic will remain free and ad-free.",
  },
];

export default async function AdFreeMusicPlayerPage() {
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
        name: "Ad-Free Music Player",
        item: `${baseUrl}/ad-free-music-player`,
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
    mainEntity: adFreeFaqs.map((faq) => ({
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
        currentPath="/ad-free-music-player"
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
                Ad-Free Music Player
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero Section */}
        <section className="py-12 sm:py-16 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-4">
              Pure Listening · Zero Interruptions
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">
              True <span className="gradient-text">Ad-Free Music Player</span> for Android
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Most free music applications interrupt your favorite albums with 30-second commercial
              breaks, flashing banners, and invasive tracking SDKs. AuraMusic is built on a different
              principle: completely ad-free audio playback with zero user tracking, no subscriptions,
              and no accounts required.
            </p>
          </div>

          {/* Core Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                <Ban className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">Zero Audio Ads</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                No loud commercial breaks between songs, no video popups, and no banner overlays covering album art.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                <EyeOff className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">Zero Telemetry</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Contains zero analytics SDKs. No profiling, no behavioral logging, and no ad network trackers.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <UserX className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold mb-2">No Account Needed</h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                No email, passwords, phone numbers, or social sign-ins. Install the APK and enjoy your music immediately.
              </p>
            </div>
          </div>

          {/* Deep Sections */}
          <div className="space-y-12 mb-16">
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                What Makes AuraMusic Genuinely Ad-Free?
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                Many apps label themselves &quot;free&quot; while secretly bombarding users with interstitial video ads
                or harvesting private data to sell to ad brokers. Here is how AuraMusic compares:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                  <h3 className="text-sm font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Standard Ad-Supported Music Apps
                  </h3>
                  <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <li>• Insert 15–30 second unskippable audio commercials every 3–4 songs</li>
                    <li>• Lock background & lock-screen playback behind recurring paid subscription paywalls</li>
                    <li>• Bundle Google AdMob, Facebook Audience Network, and tracking SDKs</li>
                    <li>• Harvest search history and location data for targeted advertisements</li>
                    <li>• Require mandatory account sign-up and email verification</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10">
                  <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    AuraMusic Implementation
                  </h3>
                  <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <li>• 100% uninterrupted audio playback without commercial breaks</li>
                    <li>• Background and lock-screen playback included for free by default</li>
                    <li>• Zero commercial ad networks or monetization libraries in the codebase</li>
                    <li>• Zero remote analytics pings; listening history stays in on-device SQLite</li>
                    <li>• Zero login requirements; works out-of-the-box upon APK install</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Architecture of Privacy */}
            <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Lock className="w-6 h-6 text-purple-500" />
                The Client-Side Privacy Architecture
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                AuraMusic avoids ads because it does not rely on costly server infrastructure to manage user accounts.
                Every feature is designed to run locally on your Android hardware:
              </p>
              <ul className="space-y-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  <span><strong>Local SQLite Persistence:</strong> Your playlists, starred tracks, and play counts live entirely in your phone&apos;s Room database.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  <span><strong>Direct Client Negotiation:</strong> Streaming endpoints are queried directly from Android using native Kotlin InnerTube client routines, avoiding proxy logging.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-bold">•</span>
                  <span><strong>Zero Third-Party SDK Bloat:</strong> By omitting ad SDKs, the APK remains fast, lightweight, and free from background battery drain.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Intent Cross-Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            <Link
              href="/offline-music-player"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Offline Playback</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Save songs and listen anywhere without internet.
              </p>
            </Link>

            <Link
              href="/features"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Audio Architecture</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                AndroidX Media3 core, synced lyrics, and Liquid Glass.
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
                Side-by-side comparison with commercial streaming apps.
              </p>
            </Link>
          </div>

          {/* FAQs */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
              Frequently Asked Questions About Ad-Free Playback
            </h2>
            <FaqAccordion faqs={adFreeFaqs} />
          </div>

          {/* Download CTA */}
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Download AuraMusic for Android
            </h2>
            <p className="text-sm text-white/90 max-w-xl mx-auto mb-6">
              Official Universal APK ({release.displayVersion}) · 100% Ad-Free · Zero Accounts · Android 7.0+
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
                href="/privacy"
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-full border border-white/40 text-white hover:bg-white/10 transition-all"
              >
                Read Privacy Policy
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
