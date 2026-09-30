import React, { useState, useEffect } from 'react';
import { AuraLogo } from './AuraLogo';
import { Download, Menu, X, ArrowUpRight, Sparkles } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import GlassSurface from './GlassSurface';
import DecryptedText from './DecryptedText';
import { SpecularButton } from './SpecularButton';
import { AuraChip } from './AuraChip';
import { AuraIconButton } from './AuraIconButton';
import { motion } from 'framer-motion';
import { fetchLatestRelease, FALLBACK_RELEASE, initiateApkDownload } from '../lib/release';

interface NavigationProps {
  activeSection: string;
}

export const Navigation: React.FC<NavigationProps> = ({ activeSection }) => {
  const [introStage, setIntroStage] = useState<'initial' | 'glowing' | 'title' | 'morphing' | 'settled'>('initial');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [release, setRelease] = useState(FALLBACK_RELEASE);

  useEffect(() => {
    fetchLatestRelease().then(setRelease);
  }, []);

  useEffect(() => {
    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIntroStage('settled');
      return;
    }

    // 1.5 s violet hold → logo reveal → decrypted title → 2 s composed hold → nav morph.
    const t1 = setTimeout(() => setIntroStage('glowing'), 1500);
    const t2 = setTimeout(() => setIntroStage('title'), 2600);
    const t3 = setTimeout(() => setIntroStage('morphing'), 5600);
    const t4 = setTimeout(() => setIntroStage('settled'), 6400);

    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'Showcase', href: '#showcase' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <>
      {/* Cinematic Intro Splash Overlay (Before settling into navbar) */}
      {introStage !== 'settled' && (
        <div
          className="intro-splash fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          <div className={`intro-splash__backdrop ${introStage === 'morphing' ? 'intro-splash__backdrop--leaving' : ''}`} />
          <div className="intro-scene relative z-10 flex flex-col items-center justify-center">
            <div
              className={`intro-mark transition-all duration-[800ms] cubic-bezier(0.16,1,0.3,1) ${
                introStage === 'initial'
                  ? 'scale-90 opacity-0'
                  : introStage === 'glowing' || introStage === 'title'
                  ? 'scale-100 opacity-100'
                  : 'scale-[0.22] -translate-x-[min(41vw,470px)] -translate-y-[calc(50vh-44px)] opacity-100'
              }`}
            >
              <AuraLogo size={118} className="text-[#F8F0FF]" />
            </div>
            {(introStage === 'title' || introStage === 'morphing') && (
              <div className={`intro-title mt-6 transition-opacity duration-[500ms] ease-out ${introStage === 'morphing' ? 'opacity-0' : 'opacity-100'}`}>
                <DecryptedText text="AuraMusic" speed={52} className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-[#F8F0FF]" encryptedClassName="text-[#DAB9FF]/55" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Glass Navigation Bar */}
      <header
        className={`fixed top-5 md:top-6 left-1/2 -translate-x-1/2 z-40 w-[92vw] max-w-[1080px] transition-all duration-700 ${
          introStage === 'initial' || introStage === 'glowing' || introStage === 'title'
            ? 'opacity-0 -translate-y-6 pointer-events-none'
            : 'opacity-100 translate-y-0'
        }`}
      >
        <GlassSurface
          width="100%"
          height="auto"
          borderRadius={999}
          backgroundOpacity={scrolled ? 0.2 : 0.08}
          saturation={1.45}
          blur={10}
          className={`transition-all duration-300 ${scrolled ? 'shadow-[0_20px_40px_-15px_rgba(0,0,0,0.85)]' : 'shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)]'}`}
        >
        <nav className="w-full px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between" aria-label="Main Navigation">
          {/* Brand Mark with Aura SVG */}
          <a
            href="#"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF5AF2]/50 rounded-full pr-2"
          >
            <AuraLogo
              size={28}
              glow
              className="text-white group-hover:text-[#DAB9FF] transition-colors duration-300"
            />
            <span className="font-display font-bold text-base tracking-tight text-white/95 group-hover:text-white transition-colors">
              AuraMusic
            </span>
            <AuraChip
              size="xs"
              variant="default"
              label={release.version}
              className="hidden sm:inline-flex !bg-white/[0.05]"
            />
          </a>

          {/* Desktop Navigation Links (iOS-inspired pill highlight) */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href.replace('#', '');
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className={`relative px-4 py-1.5 text-xs font-medium tracking-tight transition-colors duration-200 rounded-full select-none ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-white/65 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {/* iOS-inspired Animated Active Pill */}
                  {isActive && (
                    <motion.span
                      layoutId="navActivePill"
                      className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/[0.12] shadow-[0_2px_10px_rgba(0,0,0,0.3)] -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* GitHub Link */}
            <a
              href="https://github.com/helloabhishek2004/AuraMusic"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white transition-all duration-200 rounded-full hover:bg-white/[0.05] active:scale-[0.97]"
              title="AuraMusic on GitHub"
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
              <ArrowUpRight size={12} className="opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>

            {/* Primary Action Button: [ Get Aura ] -> Direct APK Download */}
            <SpecularButton
              href={release.apkUrl}
              download={release.apkName}
              onClick={(e) => {
                e.preventDefault();
                initiateApkDownload(release.apkUrl, release.apkName);
              }}
              size="sm"
              radius={999}
              tint="#BF5AF2"
              tintOpacity={0.85}
              lineColor="#ffffff"
              baseColor="#9B38DA"
              intensity={1.0}
              proximity={110}
              followMouse
              autoAnimate={false}
              className="shadow-[0_4px_20px_-3px_rgba(191,90,242,0.5)] active:scale-[0.97] transition-transform duration-150 cursor-pointer"
              title={`Download Standalone APK (${release.apkSize})`}
            >
              <Download size={13} strokeWidth={1.8} />
              <span className="hidden sm:inline">Get Aura ({release.version})</span>
              <span className="sm:hidden">Get Aura</span>
            </SpecularButton>

            {/* Mobile Hamburger Button with 44px touch target */}
            <AuraIconButton
              icon={mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              variant="ghost"
              size="md"
              className="md:hidden"
            />
          </div>
        </nav>
        </GlassSurface>

        {/* Mobile Navigation Drawer / Floating Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 rounded-2xl bg-[#0F0E18]/95 backdrop-blur-2xl border border-white/[0.12] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center justify-between"
                >
                  <span>{link.label}</span>
                  <Sparkles size={13} className="text-[#BF5AF2]/60" />
                </a>
              ))}
              <div className="h-[1px] bg-white/[0.08] my-1" />
              <a
                href="https://github.com/helloabhishek2004/AuraMusic"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-2"
              >
                <GithubIcon size={15} />
                <span>GitHub Repository</span>
                <ArrowUpRight size={13} className="ml-auto opacity-50" />
              </a>
              <SpecularButton
                href={release.apkUrl}
                download={release.apkName}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  initiateApkDownload(release.apkUrl, release.apkName);
                }}
                size="md"
                radius={14}
                tint="#BF5AF2"
                tintOpacity={0.9}
                lineColor="#ffffff"
                baseColor="#9B38DA"
                intensity={1.5}
                className="w-full mt-1 shadow-lg shadow-[#BF5AF2]/25 cursor-pointer"
                followMouse
              >
                <Download size={15} />
                <span>Download APK ({release.version})</span>
              </SpecularButton>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
