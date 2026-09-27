import Link from "next/link";
import Image from "next/image";
import { Heart, ExternalLink } from "lucide-react";
import { GITHUB_REPO_URL, GITHUB_RELEASES_URL } from "@/lib/release";

interface SiteFooterProps {
  currentVersion?: string;
}

export default function SiteFooter({ currentVersion = "v2.0.0" }: SiteFooterProps) {
  return (
    <footer className="py-12 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand & Mission Column */}
          <div className="md:col-span-1 space-y-3">
            <Link href="/" className="flex items-center gap-2" aria-label="AuraMusic Home">
              <Image
                src="/app-icon.png"
                alt=""
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-bold text-lg gradient-text">AuraMusic</span>
            </Link>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              A modern Android music player featuring native AndroidX Media3 playback, offline caching, live synchronized lyrics, and a signature Liquid Glass UI.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Android 7.0+ (API 24+) • Current {currentVersion}
            </p>
          </div>

          {/* Product & Capabilities */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-3">
              Capabilities
            </h3>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                <Link
                  href="/features"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Features & Architecture
                </Link>
              </li>
              <li>
                <Link
                  href="/offline-music-player"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Offline Music Player
                </Link>
              </li>
              <li>
                <Link
                  href="/ad-free-music-player"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Ad-Free & Privacy Model
                </Link>
              </li>
              <li>
                <Link
                  href="/youtube-music-alternative"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Streaming App Alternative
                </Link>
              </li>
            </ul>
          </div>

          {/* Releases & Updates */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-3">
              Releases & History
            </h3>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                <Link
                  href="/changelog"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Version Changelog
                </Link>
              </li>
              <li>
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors inline-flex items-center gap-1"
                >
                  GitHub Releases <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Technical FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Open Code */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-3">
              Legal & Open Code
            </h3>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors inline-flex items-center gap-1"
                >
                  Source Repository <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href={`${GITHUB_REPO_URL}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors inline-flex items-center gap-1"
                >
                  Issue Tracker <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-zinc-200/50 dark:border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <p>
            &copy; {new Date().getFullYear()} AuraMusic Project. Created by{" "}
            <a
              href="https://github.com/helloabhishek2004"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Abhishek
            </a>
            . Not affiliated with YouTube or Google LLC.
          </p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="w-3 h-3 text-pink-500" /> for Android music enthusiasts.
          </p>
        </div>
      </div>
    </footer>
  );
}
