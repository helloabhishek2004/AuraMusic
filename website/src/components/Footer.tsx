import React from 'react';
import { Coffee, ArrowUp } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { AuraLogo } from './AuraLogo';
import { AuraIconButton } from './AuraIconButton';

interface FooterProps {
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigatePrivacy,
  onNavigateTerms,
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative z-[140] pt-16 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 overflow-hidden">
      
      {/* ── Nebula Dissolving Into Deep Darkness Void ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[90vw] sm:w-[80vw] max-w-[1000px] h-[200px] sm:h-[260px] rounded-full opacity-20 blur-[60px] sm:blur-[130px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top, #BF5AF2 0%, #46F5E0 40%, transparent 80%)',
        }}
      />

      {/* Atmospheric Soft Divider */}
      <div className="max-w-[1200px] mx-auto h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent mb-12 sm:mb-20" />

      <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center">
        
        {/* Luminous Brand Emblem with Subtle Glow */}
        <div className="mb-4 sm:mb-6">
          <AuraLogo size={40} glow className="text-white" />
        </div>

        {/* Final Poetic Statement */}
        <p className="text-[11px] sm:text-xs font-mono tracking-[0.25em] uppercase text-[#DAB9FF]/60 mb-2">
          Keep listening.
        </p>
        <h3 className="font-display font-extrabold text-xl sm:text-3xl text-white tracking-tight">
          AuraMusic — music, in its element.
        </h3>

        {/* Minimalist Nav Links Grid with Generous Whitespace (No Cards) */}
        <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-x-5 sm:gap-x-10 gap-y-2.5 sm:gap-y-4 text-xs sm:text-sm font-medium text-white/60">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#experience" className="hover:text-white transition-colors">Experience</a>
          <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
          <a href="#showcase" className="hover:text-white transition-colors">Showcase</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <a href="#download" className="hover:text-white transition-colors">Download</a>
          <a
            href="/privacy"
            onClick={(e) => {
              if (onNavigatePrivacy) {
                e.preventDefault();
                onNavigatePrivacy();
              }
            }}
            className="hover:text-white text-[#DAB9FF]/90 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            onClick={(e) => {
              if (onNavigateTerms) {
                e.preventDefault();
                onNavigateTerms();
              }
            }}
            className="hover:text-white text-[#DAB9FF]/90 transition-colors"
          >
            Terms of Service
          </a>
          <a
            href="https://github.com/helloabhishek2004/AuraMusic"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://github.com/helloabhishek2004/AuraMusic/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Releases
          </a>
          <a
            href="https://about-abhishek.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Portfolio
          </a>
        </div>

        {/* Legal & Source Disclaimer */}
        <div className="mt-14 max-w-xl text-xs text-white/40 leading-relaxed font-body">
          AuraMusic is an independent source-available personal project developed by Abhishek (@helloabhishek2004) for personal study, technical research, and experimentation with modern Android audio architecture. AuraMusic does not host, store, or distribute copyrighted media files.
        </div>

        {/* Bottom Bar: Copyright & Back to Top */}
        <div className="mt-12 pt-8 w-full border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-white/45">
          <div>
            © 2026 Abhishek (@helloabhishek2004). Source-available on GitHub.
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/helloabhishek2004/AuraMusic"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
            </a>
            <a
              href="https://buymeacoffee.com/helloabhisy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Coffee size={14} />
              <span>Buy me a coffee</span>
            </a>
            <AuraIconButton
              onClick={scrollToTop}
              size="sm"
              variant="glass"
              icon={<ArrowUp size={15} strokeWidth={1.8} />}
              aria-label="Back to top"
              title="Back to top"
            />
          </div>
        </div>

      </div>
    </footer>
  );
};
