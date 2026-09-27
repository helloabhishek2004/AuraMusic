"use client";

import { X, Download, Tv, Cast, Smartphone, Cpu, Check } from "lucide-react";
import { AuraApkAsset } from "@/lib/release";
import { useState, useRef } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface VariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  variants: AuraApkAsset[];
  versionTag: string;
}

export default function VariantsModal({
  isOpen,
  onClose,
  variants,
  versionTag,
}: VariantsModalProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const containerRef = useFocusTrap({
    isOpen,
    onClose,
    initialFocusRef: closeBtnRef,
  });

  if (!isOpen) return null;

  const getVariantIcon = (variant: AuraApkAsset["variant"]) => {
    switch (variant) {
      case "tv":
        return <Tv aria-hidden="true" className="w-5 h-5 text-indigo-500" />;
      case "cast":
        return <Cast aria-hidden="true" className="w-5 h-5 text-emerald-500" />;
      case "arm64":
        return <Cpu aria-hidden="true" className="w-5 h-5 text-orange-500" />;
      case "standard":
      default:
        return <Smartphone aria-hidden="true" className="w-5 h-5 text-pink-500" />;
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="variants-modal-title"
        aria-describedby="variants-modal-description"
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 id="variants-modal-title" className="text-xl font-bold tracking-tight">
              Choose Build Variant
            </h2>
            <p id="variants-modal-description" className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Official APKs for {versionTag} directly from GitHub Releases
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center justify-center"
            aria-label="Close build variants dialog"
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>

        {/* Live region for copy feedback */}
        <div aria-live="polite" className="sr-only">
          {copiedUrl ? "Download link copied to clipboard" : ""}
        </div>

        <div className="space-y-3 my-5">
          {variants.map((v) => (
            <div
              key={v.name}
              className={`p-4 rounded-xl border transition-all ${
                v.variant === "standard"
                  ? "border-orange-500/60 bg-orange-50/50 dark:bg-orange-500/5 ring-1 ring-orange-500/20"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    {getVariantIcon(v.variant)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{v.label}</p>
                      {v.badge && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300">
                          {v.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                      {v.description}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                      {v.name} • {v.sizeFormatted}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                  <a
                    href={v.downloadUrl}
                    download
                    aria-label={`Download ${v.label} build (${v.name}, ${v.sizeFormatted})`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-sm hover:shadow hover:scale-[1.02] transition-all min-h-[36px]"
                  >
                    <Download aria-hidden="true" className="w-3.5 h-3.5" />
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(v.downloadUrl)}
                    aria-label={`Copy download link for ${v.label} build`}
                    className="min-h-[36px] text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 px-2.5 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
                  >
                    {copiedUrl === v.downloadUrl ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Check aria-hidden="true" className="w-3 h-3" /> Copied
                      </span>
                    ) : (
                      "Copy Link"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            All builds are signed and verified against the official AuraMusic repository.
          </p>
        </div>
      </div>
    </div>
  );
}
