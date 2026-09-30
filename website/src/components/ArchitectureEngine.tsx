import React from 'react';
import { Cpu, Smartphone, HardDrive, CheckCircle2 } from 'lucide-react';
import BlurText from './BlurText';
import { AuraChip } from './AuraChip';

export const ArchitectureEngine: React.FC = () => {
  return (
    <section id="architecture" className="relative py-16 sm:py-24 px-3 sm:px-6 md:px-12 max-w-[1440px] mx-auto">
      
      {/* ── Section Title ── */}
      <div className="flex flex-col items-start mb-10 sm:mb-16 max-w-3xl">
        <div className="mb-3 sm:mb-4">
          <AuraChip
            size="sm"
            variant="aqua"
            icon={<Cpu size={13} strokeWidth={1.8} />}
            label="Under the Hood"
          />
        </div>
        <h2 className="font-display font-extrabold text-2xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.12]">
          <BlurText
            text="Engineered for Android."
            as="span"
            className="block text-white"
            scrollDriven
            direction="bottom"
          />
          <BlurText
            text="Not ported to it."
            as="span"
            className="block text-white/45 mt-0.5 sm:mt-1"
            scrollDriven
            direction="bottom"
          />
        </h2>
        <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-white/65 font-normal leading-relaxed max-w-2xl">
          By partitioning UI rendering from playback execution, AuraMusic achieves the fluid responsiveness of modern declarative UI while keeping audio completely uncompromised.
        </p>
      </div>

      {/* ── Architectural Flow Stage ── */}
      <div className="rounded-[28px] sm:rounded-[36px] bg-[#0A0912]/80 border border-white/[0.08] p-4 sm:p-8 md:p-14 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Soft background ambient gradient */}
        <div
          className="absolute -top-[20%] right-[10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #46F5E0 0%, #BF5AF2 60%, transparent 80%)' }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Diagram: Architectural Layers (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Layer 1: Presentation Layer */}
            <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08] relative group hover:border-[#DAB9FF]/30 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <AuraChip
                  size="xs"
                  variant="lavender"
                  icon={<Smartphone size={13} strokeWidth={1.8} />}
                  label="UI & Presentation Layer"
                />
                <AuraChip
                  size="xs"
                  variant="neutral"
                  label="React Native • Expo SDK 55"
                />
              </div>
              <p className="text-sm text-white/80 leading-relaxed font-body">
                Liquid Glass design tokens, 38–54 blur hierarchies, gesture navigation, FlashList 120fps virtualization, and reactive Zustand state stores.
              </p>
            </div>

            {/* Connection Bridge Indicator */}
            <div className="flex items-center justify-center gap-2 py-1 text-xs font-mono text-white/35">
              <span className="h-4 w-[1px] bg-gradient-to-b from-white/20 to-white/5" />
              <span>Native Bridge & JSI Calls</span>
              <span className="h-4 w-[1px] bg-gradient-to-b from-white/20 to-white/5" />
            </div>

            {/* Layer 2: Kotlin Native Music Core */}
            <div className="rounded-2xl p-6 bg-gradient-to-r from-[#BF5AF2]/10 to-transparent border border-[#BF5AF2]/25 relative shadow-[0_10px_30px_rgba(191,90,242,0.1)]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <AuraChip
                  size="xs"
                  variant="violet"
                  icon={<Cpu size={13} strokeWidth={1.8} />}
                  label="Kotlin Native Core (AuraPlayer)"
                />
                <AuraChip
                  size="xs"
                  variant="violet"
                  pulseDot="#BF5AF2"
                  label="ANDROID OS THREAD"
                />
              </div>
              <p className="text-sm text-white/90 leading-relaxed font-body mb-4">
                AndroidX Media3 (ExoPlayer) pipeline handles low-latency audio buffering, system wake locks, hardware audio session routing, and Android MediaSessionCompat.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 text-[11px] font-mono text-white/70">
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-white/40 block text-[10px]">BUFFERING</span>
                  Adaptive Chunking
                </div>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-white/40 block text-[10px]">RESOLVER</span>
                  InnerTube & VR Direct
                </div>
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-white/40 block text-[10px]">SESSION ID</span>
                  Hardware Passthrough
                </div>
              </div>
            </div>

            {/* Connection Bridge Indicator */}
            <div className="flex items-center justify-center gap-2 py-1 text-xs font-mono text-white/35">
              <span className="h-4 w-[1px] bg-gradient-to-b from-white/20 to-white/5" />
              <span>SQLite Vector & DAO</span>
              <span className="h-4 w-[1px] bg-gradient-to-b from-white/20 to-white/5" />
            </div>

            {/* Layer 3: Persistence Layer */}
            <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.08] relative">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <AuraChip
                  size="xs"
                  variant="aqua"
                  icon={<HardDrive size={13} strokeWidth={1.8} />}
                  label="Local Storage & Room Database"
                />
                <AuraChip
                  size="xs"
                  variant="neutral"
                  label="Room SQLite • Scoped Storage"
                />
              </div>
              <p className="text-sm text-white/80 leading-relaxed font-body">
                100% on-device relational tables for playback history, offline downloaded tracks, cached lyrics, and metadata indexing.
              </p>
            </div>

          </div>

          {/* Right Column: Comparative Metrics & Guarantees (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="rounded-3xl p-6 sm:p-8 bg-[#12101D]/70 border border-white/[0.09]">
              <h3 className="font-display font-bold text-xl text-white mb-4">
                Architecture Guarantees
              </h3>
              
              <ul className="space-y-4 text-sm text-white/75 font-body">
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={17} className="text-[#46F5E0] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Zero Cloud Dependencies:</strong> No third-party servers storing your listening history or tokens.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={17} className="text-[#46F5E0] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Lockscreen Sync:</strong> Native notification seekbar and metadata sync flawlessly without lag.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={17} className="text-[#46F5E0] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Continuous Backgrounding:</strong> Android Foreground Service prevents battery-killer OS kills mid-track.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={17} className="text-[#46F5E0] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Low Memory Footprint:</strong> Strict heap budgeting prevents memory spikes on low-RAM devices.
                  </span>
                </li>
              </ul>
            </div>

            {/* Quick Stat Pill */}
            <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-white/[0.04] to-transparent border border-white/[0.06] flex items-center justify-between text-xs font-mono">
              <span className="text-white/50 tracking-wider">AVERAGE AUDIO START LATENCY</span>
              <AuraChip
                size="sm"
                variant="aqua"
                pulseDot="#46F5E0"
                label="~140ms"
              />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
