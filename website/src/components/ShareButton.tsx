import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { shareAuraWebsite } from '../lib/analytics';

interface ShareButtonProps {
  variant?: 'pill' | 'icon' | 'specular';
  className?: string;
  label?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  variant = 'pill',
  className = '',
  label = 'Share',
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await shareAuraWebsite();
    if (result === 'copied' || result === 'shared') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleShare}
        aria-label="Share AuraMusic website"
        title={copied ? 'Link copied to clipboard!' : 'Share AuraMusic'}
        className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white transition-all duration-200 border border-white/[0.08] active:scale-90 ${className}`}
      >
        {copied ? (
          <Check size={14} className="text-[#46F5E0] animate-in zoom-in-50 duration-150" />
        ) : (
          <Share2 size={14} className="transition-transform duration-200 group-hover:scale-105" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      aria-label="Share AuraMusic website"
      title={copied ? 'Link copied to clipboard!' : 'Share AuraMusic'}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white border border-white/[0.08] transition-all duration-200 active:scale-95 cursor-pointer select-none ${className}`}
    >
      {copied ? (
        <>
          <Check size={13} className="text-[#46F5E0]" />
          <span className="text-[#46F5E0] font-semibold">Link Copied!</span>
        </>
      ) : (
        <>
          <Share2 size={13} className="text-[#DAB9FF]/80" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
