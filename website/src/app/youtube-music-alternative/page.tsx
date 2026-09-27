import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  X,
  Download,
  AlertTriangle,
  ChevronRight,
  Shield,
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
    title: "AuraMusic — Lightweight Android Streaming Alternative",
    description: `Compare AuraMusic ${version} to mainstream streaming apps. An ad-free, local-first Android music player featuring native AndroidX Media3 playback, background audio, and zero subscription fees.`,
    alternates: {
      canonical: `${baseUrl}/youtube-music-alternative`,
    },
    openGraph: {
      title: `AuraMusic ${version} — Lightweight Android Streaming Alternative`,
      description:
        "Looking for an alternative to subscription music streaming? AuraMusic provides background playback, synchronized lyrics, and offline caching on Android with zero subscription fees.",
      url: `${baseUrl}/youtube-music-alternative`,
      siteName: "AuraMusic",
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `AuraMusic ${version} — Lightweight Android Streaming Alternative`,
      description:
        "Looking for an alternative to subscription music streaming? AuraMusic provides background playback, synchronized lyrics, and offline caching on Android with zero subscription fees.",
    },
  };
}

const comparisonFaqs = [
  {
    q: "Why do Android users choose AuraMusic over mainstream streaming apps?",
    a: "Mainstream streaming services frequently restrict essential Android playback capabilities — such as background audio when the screen is locked, offline caching, and ad-free playback — behind recurring paid subscriptions (which vary by plan and region). AuraMusic provides background playback, lock-screen controls, and offline downloads without requiring a subscription.",
  },
  {
    q: "Do I need to sign in with a Google account to use AuraMusic?",
    a: "No. AuraMusic operates entirely anonymously on your Android device. It does not require a Google account, email address, password, or credit card.",
  },
  {
    q: "Does background playback stop when I turn off my phone screen?",
    a: "No. Background playback and lock screen controls are built-in native features of AuraMusic via AndroidX Media3 Foreground MediaService. Playback continues smoothly when your screen is locked or while multitasking in other apps.",
  },
  {
    q: "Why is AuraMusic distributed via GitHub APK rather than Google Play?",
    a: "AuraMusic is developed and maintained independently by Abhishek on GitHub. Direct APK distribution allows faster release cycles, complete source code transparency, and avoids third-party store billing dependencies.",
  },
  {
    q: "Is AuraMusic affiliated with YouTube or Google LLC?",
    a: "No. AuraMusic is an independent personal project created by Abhishek and is not affiliated with, sponsored by, or endorsed by Google LLC, YouTube, or any commercial streaming service.",
  },
];

export default async function AlternativePage() {
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
        name: "Streaming Alternative",
        item: `${baseUrl}/youtube-music-alternative`,
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
    mainEntity: comparisonFaqs.map((faq) => ({
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
        currentPath="/youtube-music-alternative"
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
                Streaming Alternative
              </li>
            </ol>
          </nav>
        </div>

        {/* Hero */}
        <section className="py-12 sm:py-16 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-4">
              Honest Technical Comparison
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">
              A Lightweight <span className="gradient-text">Android Alternative</span> to Paid Music Subscriptions
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
              If you want to stream music on your Android device with background audio, lock-screen
              controls, and synchronized lyrics without requiring a recurring paid subscription or
              enduring commercial interruptions, AuraMusic provides a lightweight, focused option.
            </p>
          </div>

          {/* Legal disclaimer banner */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-xs text-zinc-500 dark:text-zinc-400 mb-12 flex items-center gap-3">
            <Shield className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p>
              <strong>Disclaimer:</strong> AuraMusic is an independent personal project created by Abhishek. AuraMusic is not affiliated with, sponsored by, or endorsed by Google LLC or YouTube. All trademarks belong to their respective owners.
            </p>
          </div>

          {/* Side-by-side Feature Comparison Matrix */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6 text-center">Factual Feature Comparison</h2>
            <div className="overflow-x-auto rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                    <th className="p-4 sm:p-5 font-bold text-zinc-900 dark:text-zinc-100">Capability / Feature</th>
                    <th className="p-4 sm:p-5 font-bold text-orange-600 dark:text-orange-400 bg-orange-500/5">AuraMusic</th>
                    <th className="p-4 sm:p-5 font-semibold text-zinc-600 dark:text-zinc-400">Commercial Free Tiers</th>
                    <th className="p-4 sm:p-5 font-semibold text-zinc-600 dark:text-zinc-400">Commercial Subscription Tiers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">Subscription Requirement</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-orange-500/5">None ($0 for application)</td>
                    <td className="p-4 sm:p-5">No fee (supported by commercial advertisements)</td>
                    <td className="p-4 sm:p-5">Requires paid subscription (varies by plan and region)</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">Background Audio Playback</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Yes (Included)
                    </td>
                    <td className="p-4 sm:p-5 text-zinc-500 flex items-center gap-1.5">
                      <X className="w-4 h-4 text-zinc-400" /> Typically requires screen-on or paid tier
                    </td>
                    <td className="p-4 sm:p-5 text-emerald-500 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Yes
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">Lock-Screen Media Scrubber</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Yes (Android 13+ native)
                    </td>
                    <td className="p-4 sm:p-5 text-zinc-500 flex items-center gap-1.5">
                      <X className="w-4 h-4 text-zinc-400" /> May be restricted on free tier
                    </td>
                    <td className="p-4 sm:p-5 text-emerald-500 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Yes
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">Commercial Advertisements</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Zero audio/banner ads
                    </td>
                    <td className="p-4 sm:p-5 text-zinc-600 dark:text-zinc-400">Audio and banner ads</td>
                    <td className="p-4 sm:p-5 text-emerald-500">No ads</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">User Account Required</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> None (Anonymous)
                    </td>
                    <td className="p-4 sm:p-5">Mandatory Google / Email</td>
                    <td className="p-4 sm:p-5">Mandatory Google / Email</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">Offline Caching & Downloads</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Yes (No expiration)
                    </td>
                    <td className="p-4 sm:p-5 text-red-500 flex items-center gap-1.5">
                      <X className="w-4 h-4" /> Not supported
                    </td>
                    <td className="p-4 sm:p-5">Yes (Requires 30-day recheck)</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">Live Synchronized Lyrics</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Yes (LRCLIB & KuGou)
                    </td>
                    <td className="p-4 sm:p-5">Partial or delayed</td>
                    <td className="p-4 sm:p-5">Yes</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">System Equalizer Delegation</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Yes (Dolby/SoundAlive)
                    </td>
                    <td className="p-4 sm:p-5">Limited / In-app only</td>
                    <td className="p-4 sm:p-5">Limited / In-app only</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium text-zinc-900 dark:text-zinc-200">Privacy & Telemetry</td>
                    <td className="p-4 sm:p-5 font-semibold text-emerald-600 dark:text-emerald-400 bg-orange-500/5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-500" /> Zero tracking SDKs
                    </td>
                    <td className="p-4 sm:p-5 text-red-500">Extensive tracking & profiling</td>
                    <td className="p-4 sm:p-5 text-red-500">Extensive analytics</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Honest Trade-Offs & Limitations */}
          <div className="p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 mb-16">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <h2 className="text-2xl font-bold">Honest Trade-offs to Consider</h2>
            </div>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
              AuraMusic is designed for independence and privacy, but it may not fit every workflow. We believe in transparent disclosures:
            </p>
            <div className="space-y-4 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Android Only (No iOS or Web Browser)</h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  AuraMusic is compiled exclusively as an Android application. There is currently no official iOS version, web player, or desktop application.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">No Cloud Account Synchronization</h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Because AuraMusic maintains zero cloud user accounts, your playlists and listening history live on your physical device. If you switch phones, data does not automatically sync from a remote server.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Direct APK Sideloading</h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  AuraMusic is distributed directly from GitHub Releases rather than Google Play. Installing requires enabling &quot;Install unknown apps&quot; permission in your Android settings.
                </p>
              </div>
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
              href="/ad-free-music-player"
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-orange-500/50 transition-all group"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                <span>Ad-Free Architecture</span>
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
                <span>Audio Architecture</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                AndroidX Media3 core, synced lyrics, and Liquid Glass.
              </p>
            </Link>
          </div>

          {/* FAQ */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-8">
              Frequently Asked Questions About AuraMusic
            </h2>
            <FaqAccordion faqs={comparisonFaqs} />
          </div>

          {/* Download CTA */}
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-center shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Switch to AuraMusic on Android
            </h2>
            <p className="text-sm text-white/90 max-w-xl mx-auto mb-6">
              Download the official Universal APK ({release.displayVersion}). No subscriptions, no ads, and full background playback.
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
                Version History
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
