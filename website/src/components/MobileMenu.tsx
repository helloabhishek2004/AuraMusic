"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Download, Layers } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

export interface MobileNavLink {
  href: string;
  label: string;
}

const defaultNavLinks: MobileNavLink[] = [
  { href: "/features", label: "Features" },
  { href: "/offline-music-player", label: "Offline Player" },
  { href: "/ad-free-music-player", label: "Ad-Free & Privacy" },
  { href: "/youtube-music-alternative", label: "Streaming Alternative" },
  { href: "/changelog", label: "Changelog" },
  { href: "/#faq", label: "FAQ" },
];

interface MobileMenuProps {
  onDownloadClick?: () => void;
  downloadUrl?: string;
  versionLabel?: string;
  onOpenVariants?: () => void;
  links?: MobileNavLink[];
}

export default function MobileMenu({
  onDownloadClick,
  downloadUrl,
  versionLabel = "APK",
  onOpenVariants,
  links,
}: MobileMenuProps) {
  const activeLinks = links || defaultNavLinks;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = () => setOpen(false);

  const containerRef = useFocusTrap({
    isOpen: open,
    onClose: closeMenu,
    initialFocusRef: closeButtonRef,
  });

  const menuContent = open ? (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        ref={containerRef}
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className="fixed top-0 right-0 z-[9999] h-full w-72 max-w-[85vw] shadow-2xl overflow-y-auto border-l border-zinc-200 dark:border-zinc-800"
        style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-zinc-200/50 dark:border-zinc-800/50">
          <span className="text-lg font-bold gradient-text">AuraMusic</span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className="min-w-[44px] min-h-[44px] p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors flex items-center justify-center"
          >
            <X aria-hidden="true" className="w-6 h-6" />
          </button>
        </div>

        <nav aria-label="Mobile Navigation" className="flex flex-col p-4 space-y-1">
          {activeLinks.map((link) => {
            const isInternal = link.href.startsWith("/");
            const className = "px-4 py-3 min-h-[44px] flex items-center rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors";
            
            if (isInternal) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={className}
                >
                  {link.label}
                </Link>
              );
            }

            return (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={className}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="p-4 space-y-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download
              onClick={closeMenu}
              aria-label={`Download AuraMusic ${versionLabel}`}
              className="flex items-center justify-center gap-2 w-full min-h-[44px] px-5 py-3 text-sm font-semibold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Download aria-hidden="true" className="w-4 h-4" />
              Download {versionLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                closeMenu();
                if (onDownloadClick) onDownloadClick();
              }}
              className="flex items-center justify-center gap-2 w-full min-h-[44px] px-5 py-3 text-sm font-semibold rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Download aria-hidden="true" className="w-4 h-4" />
              Download APK
            </button>
          )}

          {onOpenVariants && (
            <button
              type="button"
              onClick={() => {
                closeMenu();
                onOpenVariants();
              }}
              className="flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 text-xs font-medium rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Layers aria-hidden="true" className="w-3.5 h-3.5" />
              View Build Variants
            </button>
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="min-w-[44px] min-h-[44px] p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors flex items-center justify-center"
      >
        <Menu aria-hidden="true" className="w-6 h-6" />
      </button>

      {mounted && menuContent && createPortal(menuContent, document.body)}
    </div>
  );
}
