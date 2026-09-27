import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Download } from "lucide-react";
import { getAllAuraReleases, GITHUB_RELEASES_URL } from "@/lib/release";
import { HISTORICAL_RELEASES } from "@/lib/changelog-archive";
import SiteFooter from "@/components/SiteFooter";

export const revalidate = 300; // 5 minutes ISR cache

import { getBaseUrl } from "@/lib/siteUrl";

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: "Changelog & Version History",
  description:
    "Explore the full version history, release notes, and APK download links for every release of AuraMusic.",
  alternates: {
    canonical: `${baseUrl}/changelog`,
  },
  openGraph: {
    title: "AuraMusic Changelog & Release Notes",
    description:
      "Explore the full version history, release notes, and APK download links for every release of AuraMusic.",
    url: `${baseUrl}/changelog`,
    siteName: "AuraMusic",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraMusic Changelog & Release Notes",
    description:
      "Explore the full version history, release notes, and APK download links for every release of AuraMusic.",
  },
};

interface MergedRelease {
  version: string;
  build?: string;
  date: string;
  changes: string[];
  htmlUrl: string;
  downloadUrl?: string;
  apkSize?: string;
  isLatest?: boolean;
}

export default async function ChangelogPage() {
  const ghReleases = await getAllAuraReleases();

  // Map of historical curated releases
  const historicalMap = new Map(
    HISTORICAL_RELEASES.map((h) => [
      h.version.toLowerCase().replace(/^v/, ""),
      h,
    ])
  );

  const mergedReleases: MergedRelease[] = [];
  const seenVersions = new Set<string>();

  // 1. Process GitHub releases first (newest on top)
  for (let i = 0; i < ghReleases.length; i++) {
    const gh = ghReleases[i];
    const cleanVer = gh.version.toLowerCase();
    seenVersions.add(cleanVer);

    const history = historicalMap.get(cleanVer);

    // Merge changes: prefer curated if GitHub body is empty or minimal, otherwise use GitHub changes
    let changes = gh.changes;
    if (history && (changes.length === 0 || history.changes.length > changes.length)) {
      changes = history.changes;
    }

    mergedReleases.push({
      version: gh.displayVersion,
      build: history?.build,
      date: gh.publishedDateFormatted || history?.date || "",
      changes: changes.length > 0 ? changes : ["General stability improvements and performance optimizations."],
      htmlUrl: gh.htmlUrl,
      downloadUrl: gh.primaryApk?.downloadUrl,
      apkSize: gh.primaryApk?.sizeFormatted,
      isLatest: i === 0,
    });
  }

  // 2. Append any older historical releases not returned in GitHub's latest list
  for (const hist of HISTORICAL_RELEASES) {
    const cleanVer = hist.version.toLowerCase().replace(/^v/, "");
    if (!seenVersions.has(cleanVer)) {
      mergedReleases.push({
        version: hist.version.startsWith("v") ? hist.version : `v${hist.version}`,
        build: hist.build,
        date: hist.date,
        changes: hist.changes,
        htmlUrl: hist.compareUrl || `${GITHUB_RELEASES_URL}/tag/${hist.version}`,
        isLatest: false,
      });
    }
  }

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
        name: "Changelog",
        item: `${baseUrl}/changelog`,
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Skip Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 border-b border-zinc-200/50 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              aria-label="Back to AuraMusic home page"
              className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors py-2"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <Image
                src="/app-icon.png"
                alt=""
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="text-lg font-bold gradient-text">AuraMusic</span>
            </div>
          </div>

          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View official releases on GitHub (opens in new tab)"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-orange-500 transition-colors flex items-center gap-1 py-2"
          >
            GitHub Releases <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-grow py-16 sm:py-24 focus:outline-none">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Changelog
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-12">
            What&apos;s new in each release of AuraMusic — driven dynamically by GitHub Releases.
          </p>

          <div className="relative">
            {/* Timeline line */}
            <div aria-hidden="true" className="absolute left-[15px] top-2 bottom-2 w-px bg-zinc-200 dark:bg-zinc-800" />

            <div className="space-y-10">
              {mergedReleases.map((release, i) => (
                <div key={release.version} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    aria-hidden="true"
                    className={`absolute left-0 top-1 w-[31px] h-[31px] rounded-full border-4 ${
                      i === 0
                        ? "bg-gradient-to-br from-orange-500 to-pink-500 border-zinc-50 dark:border-zinc-950 ring-4 ring-orange-500/20"
                        : "bg-zinc-300 dark:bg-zinc-700 border-zinc-50 dark:border-zinc-950"
                    }`}
                  />

                  <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="px-3 py-1 text-sm font-bold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                          {release.version}
                        </span>
                        {release.isLatest && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            Latest Release
                          </span>
                        )}
                        {release.build && (
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {release.build}
                          </span>
                        )}
                        {release.date && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400">
                            {release.date}
                          </span>
                        )}
                      </div>

                      {release.downloadUrl && (
                        <a
                          href={release.downloadUrl}
                          download
                          aria-label={`Download ${release.version} APK${release.apkSize ? ` (${release.apkSize})` : ""}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 transition-colors min-h-[36px]"
                        >
                          <Download aria-hidden="true" className="w-3.5 h-3.5" />
                          <span>APK{release.apkSize ? ` (${release.apkSize})` : ""}</span>
                        </a>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {release.changes.map((change, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed"
                        >
                          <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                      <a
                        href={release.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${release.version} release notes on GitHub (opens in new tab)`}
                        className="inline-flex items-center gap-1 font-medium text-orange-700 dark:text-orange-400 hover:underline py-1"
                      >
                        GitHub release page <ExternalLink aria-hidden="true" className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View all AuraMusic releases on GitHub (opens in new tab)"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all min-h-[44px]"
            >
              View All Releases on GitHub
              <ExternalLink aria-hidden="true" className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
