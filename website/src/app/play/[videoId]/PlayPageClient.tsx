"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Download,
  Play,
  ChevronLeft,
} from "lucide-react";

const AURAMUSIC_SCHEME = "auramusic://";
const GITHUB_REPO = "https://github.com/helloabhishek2004/AuraMusic";

export default function PlayPageClient({ videoId }: { videoId: string }) {
  const handleOpenApp = () => {
    window.location.href = `${AURAMUSIC_SCHEME}play/${videoId}`;
  };

  const handleDownload = () => {
    window.location.href = `${GITHUB_REPO}/releases/latest`;
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 flex flex-col">
      {/* Skip Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/50 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="AuraMusic Home" className="flex items-center gap-2">
            <Image
              src="/app-icon.png"
              alt=""
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-xl font-bold tracking-tight gradient-text">
              AuraMusic
            </span>
          </Link>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="AuraMusic GitHub repository (opens in new tab)"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors py-2"
          >
            GitHub
          </a>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center px-4 py-12 focus:outline-none">
        <div className="max-w-md w-full">
          {/* Status Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            {/* App Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-pink-500/10 flex items-center justify-center" aria-hidden="true">
              <Image src="/app-icon.png" alt="" width={48} height={48} className="rounded-xl" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Play in AuraMusic</h1>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Someone shared a song with you! Open it in AuraMusic or download the app to listen.
            </p>

            {/* Song Thumbnail */}
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src={`https://i.ytimg.com/vi/${videoId}/default.jpg`}
                  alt="Song thumbnail"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Shared Song</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Tap below to play in AuraMusic
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleOpenApp}
                aria-label="Open track in AuraMusic application"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
              >
                <Play aria-hidden="true" className="w-4 h-4" />
                Open in AuraMusic
              </button>

              <button
                type="button"
                onClick={handleDownload}
                aria-label="Download latest AuraMusic APK"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              >
                <Download aria-hidden="true" className="w-4 h-4" />
                Download AuraMusic
              </button>

              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Android 7.0+ (API 24+) • Native Media3 Core
              </p>

              <Link
                href="/"
                aria-label="Back to AuraMusic home page"
                className="inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors py-2"
              >
                <ChevronLeft aria-hidden="true" className="w-4 h-4" />
                Back to Home
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="mt-8 text-center">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
              With AuraMusic you can:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Stream Music", "Download for offline", "Live lyrics", "Equalizer"].map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-zinc-200/50 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/app-icon.png"
              alt=""
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-bold gradient-text text-sm">AuraMusic</span>
          </div>
          <div className="flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="AuraMusic repository on GitHub (opens in new tab)"
              className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors py-1"
            >
              GitHub
            </a>
            <a
              href={`${GITHUB_REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="AuraMusic releases on GitHub (opens in new tab)"
              className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors py-1"
            >
              Releases
            </a>
            <Link
              href="/changelog"
              className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors py-1"
            >
              Changelog
            </Link>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            &copy; {new Date().getFullYear()} AuraMusic Project. Created by Abhishek.
          </p>
        </div>
      </footer>
    </div>
  );
}
