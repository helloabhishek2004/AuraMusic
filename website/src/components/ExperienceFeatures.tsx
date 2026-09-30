import React from 'react';
import { Cpu, ShieldCheck, Waves, Mic2, Sliders, Layers, Zap } from 'lucide-react';
import MagicBento from './MagicBento';
import BlurText from './BlurText';
import { AuraChip } from './AuraChip';

export const ExperienceFeatures: React.FC = () => {
  return (
    <section id="experience" className="relative py-16 sm:py-24 md:py-28 px-3 sm:px-6 md:px-12 max-w-[1440px] mx-auto">
      
      {/* ── Section Atmospheric Anchor ── */}
      <div className="flex flex-col items-start mb-10 sm:mb-16 md:mb-24 max-w-3xl">
        <div className="mb-3 sm:mb-4">
          <AuraChip
            size="sm"
            variant="violet"
            icon={<Layers size={13} strokeWidth={1.8} />}
            label="Core Capabilities"
          />
        </div>
        <h2 className="font-display font-extrabold text-2xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.12]">
          <BlurText
            text="Built with bare metal."
            as="span"
            className="block text-white"
            scrollDriven
            direction="bottom"
          />
          <BlurText
            text="Felt in every transition."
            as="span"
            className="block text-white/45 mt-0.5 sm:mt-1"
            scrollDriven
            direction="bottom"
          />
        </h2>
        <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-white/65 font-normal leading-relaxed max-w-2xl">
          Most mobile music clients fall into two extremes: sluggish web wrappers or fragile setups requiring self-hosted cloud proxies. AuraMusic runs stream extraction, audio buffering, and state reconciliation directly on your Android device.
        </p>
      </div>

      {/* ── Asymmetric Bento Matrix (Tonal Shifts & Soft Occlusion, No Hard 1px Borders Everywhere) ── */}
      <MagicBento><div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
        
        {/* Feature 1: Direct On-Device Stream Resolution (7 cols) */}
        <div className="magic-bento-card md:col-span-7 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 md:p-10 bg-[#0C0B14]/70 border border-white/[0.07] backdrop-blur-xl relative overflow-hidden group hover:border-white/[0.14] transition-all duration-500 flex flex-col justify-between">
          <div
            className="absolute top-0 right-0 w-[350px] h-[350px] rounded-full opacity-20 blur-3xl pointer-events-none group-hover:opacity-30 transition-opacity"
            style={{ background: 'radial-gradient(circle, #46F5E0 0%, transparent 70%)' }}
          />
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[#46F5E0] mb-5 shadow-inner">
              <Zap size={22} strokeWidth={1.8} />
            </div>
            <div className="mb-3">
              <AuraChip
                size="xs"
                variant="aqua"
                label="Autonomous Pipeline"
              />
            </div>
            <h3 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight mb-4">
              Direct On-Device Stream Resolution
            </h3>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-xl">
              Eliminates the latency and fragility of intermediate cloud scrapers. AuraMusic resolves audio endpoints directly within Kotlin using dual-pipeline InnerTube <code className="text-[#46F5E0] bg-white/[0.05] px-1.5 py-0.5 rounded font-mono text-xs">WEB_REMIX</code> and high-res <code className="text-[#46F5E0] bg-white/[0.05] px-1.5 py-0.5 rounded font-mono text-xs">AndroidVR</code> fallback.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-wrap items-center gap-3">
            <AuraChip
              size="xs"
              variant="neutral"
              icon={<ShieldCheck size={13} strokeWidth={1.8} className="text-[#46F5E0]" />}
              label="Zero Middleman Servers"
            />
            <AuraChip
              size="xs"
              variant="neutral"
              label="Client-side token caching"
            />
          </div>
        </div>

        {/* Feature 2: AndroidX Media3 Core (5 cols) */}
        <div className="magic-bento-card md:col-span-5 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 md:p-10 bg-[#0E0D18]/70 border border-white/[0.07] backdrop-blur-xl relative overflow-hidden group hover:border-white/[0.14] transition-all duration-500 flex flex-col justify-between">
          <div
            className="absolute bottom-0 right-0 w-[240px] sm:w-[280px] h-[240px] sm:h-[280px] rounded-full opacity-20 blur-3xl pointer-events-none group-hover:opacity-30 transition-opacity"
            style={{ background: 'radial-gradient(circle, #BF5AF2 0%, transparent 70%)' }}
          />
          <div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[#BF5AF2] mb-4 sm:mb-5 shadow-inner">
              <Cpu size={20} strokeWidth={1.8} />
            </div>
            <div className="mb-3">
              <AuraChip
                size="xs"
                variant="violet"
                label="Audio Engine"
              />
            </div>
            <h3 className="font-display font-bold text-xl sm:text-2xl md:text-3xl text-white tracking-tight mb-3 sm:mb-4">
              AndroidX Media3 Native Core
            </h3>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed">
              Maintained strictly on the Android OS audio thread. Playback timelines, buffer fills, and notifications never stutter when the UI performs complex transitions.
            </p>
          </div>

          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/[0.06] flex items-center gap-3">
            <AuraChip
              size="xs"
              variant="neutral"
              pulseDot="#BF5AF2"
              label="ExoPlayer hardware acceleration"
            />
          </div>
        </div>

        {/* Feature 3: Vibe-Aware Dynamic Queue (4 cols) */}
        <div className="magic-bento-card md:col-span-4 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 bg-[#0D0C16]/70 border border-white/[0.07] backdrop-blur-xl relative overflow-hidden group hover:border-white/[0.14] transition-all duration-500 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[#DAB9FF] mb-4 sm:mb-5 shadow-inner">
              <Waves size={20} strokeWidth={1.8} />
            </div>
            <div className="mb-2.5">
              <AuraChip
                size="xs"
                variant="lavender"
                label="Dynamic Autoplay"
              />
            </div>
            <h3 className="font-display font-bold text-lg sm:text-xl md:text-2xl text-white tracking-tight mb-2 sm:mb-3">
              Vibe-Aware Continuation
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Never lets the music die. Blends real-time online automix queues with local listening history affinity using mathematical fatigue suppression rules.
            </p>
          </div>

          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/[0.06]">
            <AuraChip
              size="xs"
              variant="neutral"
              label="Score = Relational + Affinity - Fatigue"
            />
          </div>
        </div>

        {/* Feature 4: Multi-Provider Synced Lyrics (4 cols) */}
        <div className="magic-bento-card md:col-span-4 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 bg-[#0C0B14]/70 border border-white/[0.07] backdrop-blur-xl relative overflow-hidden group hover:border-white/[0.14] transition-all duration-500 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[#46F5E0] mb-4 sm:mb-5 shadow-inner">
              <Mic2 size={20} strokeWidth={1.8} />
            </div>
            <div className="mb-2.5">
              <AuraChip
                size="xs"
                variant="aqua"
                label="Vocal Tracking"
              />
            </div>
            <h3 className="font-display font-bold text-lg sm:text-xl md:text-2xl text-white tracking-tight mb-2 sm:mb-3">
              Multi-Source Synced Lyrics
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Precision line-by-line vocal synchronization powered by LRCLIB with KuGou fallback, cached offline for instantaneous loading without network delays.
            </p>
          </div>

          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/[0.06]">
            <AuraChip
              size="xs"
              variant="neutral"
              label="LRCLIB + KuGou Engine"
            />
          </div>
        </div>

        {/* Feature 5: Local-First Room SQLite & System EQ (4 cols) */}
        <div className="magic-bento-card md:col-span-4 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 bg-[#0E0D18]/70 border border-white/[0.07] backdrop-blur-xl relative overflow-hidden group hover:border-white/[0.14] transition-all duration-500 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[#BF5AF2] mb-4 sm:mb-5 shadow-inner">
              <Sliders size={20} strokeWidth={1.8} />
            </div>
            <div className="mb-2.5">
              <AuraChip
                size="xs"
                variant="violet"
                label="System Fidelity"
              />
            </div>
            <h3 className="font-display font-bold text-lg sm:text-xl md:text-2xl text-white tracking-tight mb-2 sm:mb-3">
              Room SQLite & System EQ
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Instantaneous offline playlist recovery through on-device Room SQLite, paired with 1-tap delegation to your smartphone's native OEM hardware equalizer.
            </p>
          </div>

          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/[0.06]">
            <AuraChip
              size="xs"
              variant="neutral"
              label="Hardware Equalizer Intent Delegation"
            />
          </div>
        </div>

      </div></MagicBento>
    </section>
  );
};
