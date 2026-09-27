"use client";

import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";
import DarkModeToggle from "@/components/DarkModeToggle";
import MobileMenu from "@/components/MobileMenu";
import { GITHUB_REPO_URL } from "@/lib/release";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

interface SubPageHeaderProps {
  currentPath?: string;
  downloadUrl?: string;
  versionLabel?: string;
  sizeFormatted?: string;
}

export default function SubPageHeader({
  currentPath = "",
  downloadUrl = "https://github.com/helloabhishek2004/AuraMusic/releases/download/v2.0.0/AuraMusic-v2.0.0-universal.apk",
  versionLabel = "v2.0.0",
  sizeFormatted = "110.2 MB",
}: SubPageHeaderProps) {
  const navItems = [
    { href: "/features", label: "Features" },
    { href: "/offline-music-player", label: "Offline Player" },
    { href: "/ad-free-music-player", label: "Ad-Free" },
    { href: "/youtube-music-alternative", label: "Alternative" },
    { href: "/changelog", label: "Changelog" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/50 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 dark:border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="AuraMusic Home">
          <Image
            src="/app-icon.png"
            alt=""
            width={34}
            height={34}
            className="rounded-lg"
            priority
          />
          <span className="text-xl font-bold tracking-tight gradient-text">
            AuraMusic
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav
          aria-label="Main Navigation"
          className="hidden lg:flex items-center space-x-7 text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors py-1 ${
                  isActive
                    ? "text-orange-600 dark:text-orange-400 font-semibold"
                    : "hover:text-zinc-900 dark:hover:text-zinc-50"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="AuraMusic GitHub repository (opens in new tab)"
            className="hidden sm:inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
          <a
            href={downloadUrl}
            download
            aria-label={`Download AuraMusic ${versionLabel} APK (${sizeFormatted})`}
            className="hidden sm:inline-flex items-center gap-2 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
          >
            <Download aria-hidden="true" className="w-3.5 h-3.5" />
            <span>Download {versionLabel}</span>
          </a>

          <MobileMenu
            downloadUrl={downloadUrl}
            versionLabel={versionLabel}
            links={[
              { href: "/", label: "Home" },
              { href: "/features", label: "Features & Architecture" },
              { href: "/offline-music-player", label: "Offline Music Player" },
              { href: "/ad-free-music-player", label: "Ad-Free & Privacy" },
              { href: "/youtube-music-alternative", label: "Streaming Alternative" },
              { href: "/changelog", label: "Changelog" },
              { href: "/#faq", label: "Technical FAQ" },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
