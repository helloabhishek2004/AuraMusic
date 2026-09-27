import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Download, Play, Pause, SkipForward, SkipBack, Sparkles, ShieldCheck, Cpu, Radio, Disc3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuraLogo } from './AuraLogo';
import { SpecularButton } from './SpecularButton';
import { AuraChip } from './AuraChip';
import { AuraIconButton } from './AuraIconButton';
import { staggerContainerPreset, fadeUpItem } from '../lib/motion-tokens';
import { fetchLatestRelease, FALLBACK_RELEASE, initiateApkDownload } from '../lib/release';

export const Hero: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [release, setRelease] = useState(FALLBACK_RELEASE);

  useEffect(() => {
    fetchLatestRelease().then(setRelease);
  }, []);

  return (
    <section className="relative pt-20 sm:pt-24 md:pt-32 pb-12 sm:pb-16 px-2 sm:px-6 flex justify-center items-center overflow-hidden">
      {/* ── Outer Portal Stage Frame (92-95vw, max-w-1500px, 32-48px radius) ── */}
      <div className="relative w-full max-w-[1440px] min-h-[75vh] md:min-h-[86vh] rounded-[28px] sm:rounded-[44px] bg-[#0A0912]/80 border border-white/[0.08] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9),inset_0_1px_1px_0_rgba(255,255,255,0.12)] overflow-hidden flex flex-col justify-between p-4 sm:p-10 md:p-14">
        
        {/* ── Atmospheric Inside Glows (Asymmetrical Sonic Nebula) ── */}
        <div
          className="absolute -top-[15%] -left-[10%] w-[350px] sm:w-[700px] h-[350px] sm:h-[700px] rounded-full opacity-[0.28] blur-[60px] sm:blur-[100px] pointer-events-none mix-blend-screen"
          style={{ background: 'radial-gradient(circle, #BF5AF2 0%, #6F2BBE 50%, transparent 75%)' }}
        />
        <div
          className="absolute top-[25%] -right-[10%] w-[320px] sm:w-[650px] h-[320px] sm:h-[650px] rounded-full opacity-[0.18] blur-[60px] sm:blur-[110px] pointer-events-none mix-blend-screen"
          style={{ background: 'radial-gradient(circle, #46F5E0 0%, #2F8CFF 60%, transparent 80%)' }}
        />
        <div
          className="absolute bottom-[-10%] left-[30%] w-[280px] sm:w-[400px] h-[280px] sm:h-[400px] rounded-full opacity-[0.14] blur-[50px] sm:blur-[90px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #DAB9FF 0%, transparent 70%)' }}
        />

        {/* ── Decorative Technical & Musical Signal Lines (Subtle SVG paths) ── */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-40 hidden md:block"
          viewBox="0 0 1440 850"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left Signal Trace */}
          <path
            d="M 60 280 H 180 C 230 280, 250 210, 310 210 H 420"
            stroke="url(#signalGradViolet)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            className="signal-line"
          />
          {/* Right Signal Trace */}
          <path
            d="M 1380 290 H 1220 C 1170 290, 1140 360, 1070 360 H 940"
            stroke="url(#signalGradAqua)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            className="signal-line"
          />
          {/* Subtle curved orbital arc */}
          <path
            d="M 120 750 C 400 820, 1000 820, 1320 740"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="1"
          />
          <defs>
            <linearGradient id="signalGradViolet" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#BF5AF2" stopOpacity="0.1" />
              <stop offset="60%" stopColor="#BF5AF2" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#DAB9FF" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="signalGradAqua" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#46F5E0" stopOpacity="0.1" />
              <stop offset="60%" stopColor="#46F5E0" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#2F8CFF" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>

        {/* ── Floating Signal Metadata Badges (Subtle music indicators) ── */}
        <div className="absolute top-8 left-12 hidden lg:flex items-center gap-3 text-white/50 text-xs font-mono">
          <div className="w-2 h-2 rounded-full bg-[#46F5E0] shadow-[0_0_8px_#46F5E0] animate-ping" />
          <span className="text-white/70">Media3 Engine</span>
          <span className="text-white/30">•</span>
          <span className="text-white/40">Native Audio Thread</span>
        </div>

        <div className="absolute top-8 right-12 hidden lg:flex items-center gap-3 text-white/50 text-xs font-mono">
          <span className="text-[#DAB9FF]/80">Lossless 24-bit / 96kHz</span>
          <span className="text-white/30">•</span>
          <span className="text-white/40">Direct Stream Sync</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#BF5AF2]" />
        </div>

        {/* ── Main Hero Layout: Asymmetric Content & Floating Player ── */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto py-8">
          
          {/* Left Column: Editorial Headline & Copy (7 cols) */}
          <motion.div
            variants={staggerContainerPreset}
            initial="hidden"
            animate="visible"
            className="lg:col-span-7 flex flex-col items-start text-left max-w-2xl"
          >
            {/* Context Pill Badge */}
            <motion.div variants={fadeUpItem} className="mb-6">
              <AuraChip
                size="sm"
                variant="violet"
                pulseDot="#BF5AF2"
                label={`AuraMusic ${release.version} Official Architecture`}
              />
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              variants={fadeUpItem}
              className="font-display font-extrabold text-3xl sm:text-5xl lg:text-[72px] leading-[1.1] sm:leading-[1.08] tracking-[-0.03em] text-white"
            >
              Music,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFFFFF] via-[#E2DDEE] to-[#DAB9FF]/90">
                in its
              </span>{' '}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#BF5AF2] via-[#DAB9FF] to-[#46F5E0]">
                element.
                <span
                  className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full opacity-60"
                  style={{ background: 'linear-gradient(90deg, #BF5AF2 0%, #46F5E0 100%)' }}
                />
              </span>
            </motion.h1>

            {/* Concise Supporting Copy */}
            <motion.p
              variants={fadeUpItem}
              className="mt-4 sm:mt-6 text-sm sm:text-lg text-white/75 leading-relaxed font-body font-normal max-w-xl"
            >
              A free, ad-free Android music player engineered for distraction-free listening,
              featuring true offline playback, local file management, and native AndroidX Media3 sound fidelity.
            </motion.p>

            {/* High-Intent Value Chips */}
            <motion.div variants={fadeUpItem} className="mt-4 flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#BF5AF2]/15 text-[#DAB9FF] border border-[#BF5AF2]/25">
                100% Ad-Free
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#46F5E0]/15 text-[#46F5E0] border border-[#46F5E0]/25">
                Offline Downloads
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.08] text-white/80 border border-white/10">
                Local Device Audio
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.08] text-white/80 border border-white/10">
                Direct APK
              </span>
            </motion.div>

            {/* CTAs Cluster */}
            <motion.div
              variants={fadeUpItem}
              className="mt-6 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto"
            >
              {/* Primary CTA */}
              <SpecularButton
                href="#experience"
                size="md"
                radius={999}
                tint="#BF5AF2"
                tintOpacity={0.88}
                lineColor="#ffffff"
                baseColor="#9B38DA"
                intensity={1.0}
                shineSize={10}
                shineFade={36}
                speed={0.35}
                proximity={120}
                followMouse
                autoAnimate={false}
                className="w-full sm:w-auto shadow-[0_10px_35px_-5px_rgba(191,90,242,0.6)]"
              >
                <Sparkles size={16} strokeWidth={1.8} className="text-white" />
                <span>Explore AuraMusic</span>
              </SpecularButton>

              {/* Secondary CTA */}
              <SpecularButton
                href="https://github.com/helloabhishek2004/AuraMusic"
                target="_blank"
                size="md"
                radius={999}
                tint="#ffffff"
                tintOpacity={0.06}
                lineColor="#DAB9FF"
                baseColor="#433355"
                intensity={0.9}
                blur={8}
                proximity={110}
                followMouse
                autoAnimate={false}
                className="w-full sm:w-auto"
              >
                <span>View on GitHub</span>
                <ArrowUpRight size={15} strokeWidth={1.8} className="opacity-70" />
              </SpecularButton>

              {/* Direct APK Link */}
              <SpecularButton
                href={release.apkUrl}
                download={release.apkName}
                onClick={(e) => {
                  e.preventDefault();
                  initiateApkDownload(release.apkUrl, release.apkName);
                }}
                size="sm"
                radius={999}
                tint="#1e1828"
                tintOpacity={0.4}
                lineColor="#46F5E0"
                baseColor="#2d2040"
                intensity={0.9}
                textColor="#DAB9FF"
                title={`Download Standalone APK (${release.apkSize})`}
                proximity={110}
                followMouse
                autoAnimate={false}
                className="w-full sm:w-auto cursor-pointer"
              >
                <Download size={14} strokeWidth={1.8} />
                <span>Download APK ({release.version})</span>
              </SpecularButton>
            </motion.div>

            {/* Quick Architecture Indicators */}
            <motion.div
              variants={fadeUpItem}
              className="mt-8 sm:mt-12 flex flex-wrap items-center gap-2.5 sm:gap-3"
            >
              <AuraChip
                size="xs"
                variant="neutral"
                icon={<ShieldCheck size={13} strokeWidth={1.8} className="text-[#46F5E0]" />}
                label="Zero Cloud Proxy"
              />
              <AuraChip
                size="xs"
                variant="neutral"
                icon={<Cpu size={13} strokeWidth={1.8} className="text-[#BF5AF2]" />}
                label="Kotlin Media3"
              />
              <AuraChip
                size="xs"
                variant="neutral"
                icon={<Disc3 size={13} strokeWidth={1.8} className="text-[#DAB9FF]" />}
                label="Room SQLite Offline"
              />
            </motion.div>
          </motion.div>

          {/* Right Column: Floating AuraMusic Player Surface (5 cols) */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end relative w-full">
            
            {/* Ambient Radial Under-Glow for the Player */}
            <div
              className="absolute -inset-4 rounded-3xl opacity-40 blur-3xl pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(191,90,242,0.45) 0%, rgba(70,245,224,0.2) 60%, transparent 80%)',
              }}
            />

            {/* The Floating Liquid Glass Player Card */}
            <div className="relative w-full max-w-[340px] sm:max-w-[390px] rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 flex flex-col bg-[#12101C]/85 border border-white/[0.14] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-2xl animate-ambient-drift">
              
              {/* Card Header with Aura Branding & Status */}
              <div className="flex items-center justify-between mb-5 text-xs text-white/60 font-mono">
                <div className="flex items-center gap-2">
                  <AuraLogo size={16} glow className="text-[#BF5AF2]" />
                  <span className="text-white/80 font-medium font-sans">Now Playing</span>
                </div>
                <AuraChip
                  size="xs"
                  variant="aqua"
                  pulseDot="#46F5E0"
                  label="ON-DEVICE"
                />
              </div>

              {/* Album Art with Dynamic Ambient Shadow */}
              <div className="relative w-full h-[260px] sm:h-[300px] rounded-2xl overflow-hidden mb-5 group shadow-2xl bg-[#191226]">
                {/* Artwork Real Asset */}
                <img
                  src="/icon.png"
                  alt="AuraMusic Artwork"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="eager"
                />
                {/* Frosted Specular Sheen Over Artwork */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10 pointer-events-none" />
                
                {/* Dynamic Waveform Visualizer simulation inside album art */}
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-1 h-7 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/75">
                    <Radio size={11} strokeWidth={1.8} className="text-[#46F5E0] animate-pulse" />
                    <span>SYNCS OVER LRCLIB</span>
                  </div>
                  <div className="flex items-end gap-1 h-3.5">
                    {[40, 75, 55, 90, 60, 85, 45].map((h, i) => (
                      <span
                        key={i}
                        className="w-[2.5px] rounded-full bg-[#BF5AF2]"
                        style={{
                          height: isPlaying ? `${h}%` : '20%',
                          transition: 'height 0.3s ease',
                          animation: isPlaying ? `pulse ${1 + (i % 3) * 0.3}s ease-in-out infinite` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Track Metadata & Audio Quality Chip */}
              <div className="flex items-center justify-between mb-4">
                <div className="truncate pr-3">
                  <h3 className="font-display font-bold text-lg text-white truncate tracking-tight">
                    Sonic Nebula (Original Mix)
                  </h3>
                  <p className="text-xs text-[#DAB9FF]/70 truncate mt-0.5 font-medium">
                    Aura Sound Collective • Liquid Ambient
                  </p>
                </div>
                <AuraChip
                  size="xs"
                  variant="default"
                  label="FLAC"
                />
              </div>

              {/* Real-time Synced Lyrics Sneak Peek */}
              <div className="mb-5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left">
                <div className="mb-1.5">
                  <AuraChip
                    size="xs"
                    variant="violet"
                    pulseDot="#BF5AF2"
                    label="SYNCED LYRICS"
                  />
                </div>
                <p className="text-xs text-white/90 font-medium leading-relaxed italic mt-1">
                  "Suspended in the atmosphere, where every frequency breathes..."
                </p>
              </div>

              {/* Progress Scrubber */}
              <div className="space-y-1.5 mb-5">
                <div className="relative h-1.5 w-full bg-white/[0.1] rounded-full overflow-hidden cursor-pointer group">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#BF5AF2] via-[#9B38DA] to-[#46F5E0] relative"
                    style={{ width: '42%' }}
                  >
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex justify-between text-[11px] font-mono text-white/45">
                  <span>01:42</span>
                  <span>03:58</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between pt-1 px-2">
                <AuraIconButton
                  icon={<SkipBack size={19} strokeWidth={1.8} />}
                  aria-label="Previous track"
                  variant="ghost"
                  size="md"
                />

                <SpecularButton
                  onClick={() => setIsPlaying(!isPlaying)}
                  size="sm"
                  radius={999}
                  tint="#BF5AF2"
                  tintOpacity={0.92}
                  lineColor="#ffffff"
                  baseColor="#9B38DA"
                  intensity={1.0}
                  proximity={75}
                  followMouse
                  autoAnimate={false}
                  className="!p-4 shadow-[0_0_25px_rgba(191,90,242,0.6)] active:scale-[0.94] transition-transform"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={20} strokeWidth={1.8} /> : <Play size={20} strokeWidth={1.8} className="translate-x-0.5" />}
                </SpecularButton>

                <AuraIconButton
                  icon={<SkipForward size={19} strokeWidth={1.8} />}
                  aria-label="Next track"
                  variant="ghost"
                  size="md"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stage Bottom Bar: Scroll Indicator & Ticker ── */}
        <div className="relative z-10 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs font-mono text-white/40">
          <div className="flex items-center gap-2.5 text-[11px] sm:text-xs">
            <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/[0.06] text-white/70">
              ↓
            </span>
            <span>01 / 04 • Scroll to enter the Sonic Nebula</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 text-[10px] sm:text-[11px] tracking-wider uppercase text-center">
            <span className="text-white/60">ExoPlayer Media3</span>
            <span className="hidden sm:inline text-white/20">•</span>
            <span className="text-white/60">Android 14+ Ready</span>
            <span className="hidden sm:inline text-white/20">•</span>
            <span className="text-white/60">100% Free & Open Source</span>
          </div>
        </div>

      </div>
    </section>
  );
};
