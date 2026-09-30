import React from 'react';
import { Coffee, ExternalLink, Globe, Sparkles } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { SpecularButton } from './SpecularButton';
import { AuraChip } from './AuraChip';
import BlurText from './BlurText';

export const CreatorStory: React.FC = () => {
  return (
    <section className="relative py-12 sm:py-20 px-3 sm:px-6 md:px-12 max-w-[1200px] mx-auto">
      
      {/* ── Container with Soft Tonal Depth ── */}
      <div className="rounded-[28px] sm:rounded-[36px] bg-[#0A0912]/75 border border-white/[0.08] p-5 sm:p-8 md:p-12 relative overflow-hidden backdrop-blur-xl">
        
        {/* Subtle Violet Nebula Glow */}
        <div
          className="absolute -top-[20%] -left-[10%] w-[320px] sm:w-[450px] h-[320px] sm:h-[450px] rounded-full opacity-20 blur-[60px] sm:blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #BF5AF2 0%, #DAB9FF 60%, transparent 80%)' }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center">
          
          {/* Creator Profile (5 cols) */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col items-center sm:items-start text-center sm:text-left gap-6">
            {/* Avatar with Symmetrical Glass Border */}
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#BF5AF2] via-[#46F5E0] to-[#DAB9FF] opacity-50 blur-md group-hover:opacity-75 transition-opacity duration-500" />
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#101018] border border-white/20 shadow-xl">
                <img
                  src="/avatar.png"
                  alt="@bh!shek"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to icon if avatar fails
                    (e.target as HTMLImageElement).src = '/icon.png';
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2">
                <AuraChip
                  size="xs"
                  variant="lavender"
                  label="Independent Creator"
                />
              </div>
              <h3 className="font-display font-bold text-2xl text-white">
                Abhishek (@bh!shek)
              </h3>
              <p className="text-xs text-white/50 font-mono mt-0.5">
                Maintainer of helloabhishek2004/AuraMusic
              </p>

              {/* Creator Links */}
              <div className="flex flex-wrap items-center gap-2.5 mt-4 justify-center sm:justify-start">
                <SpecularButton
                  href="https://github.com/helloabhishek2004"
                  target="_blank"
                  size="sm"
                  radius={999}
                  tint="#ffffff"
                  tintOpacity={0.06}
                  lineColor="#DAB9FF"
                  baseColor="#3a3048"
                  intensity={1.0}
                  proximity={85}
                  followMouse
                  autoAnimate={false}
                >
                  <GithubIcon size={13} />
                  <span>GitHub</span>
                </SpecularButton>

                <SpecularButton
                  href="https://about-abhishek.vercel.app"
                  target="_blank"
                  size="sm"
                  radius={999}
                  tint="#ffffff"
                  tintOpacity={0.06}
                  lineColor="#DAB9FF"
                  baseColor="#3a3048"
                  intensity={1.0}
                  proximity={85}
                  followMouse
                  autoAnimate={false}
                >
                  <Globe size={13} />
                  <span>Portfolio</span>
                  <ExternalLink size={11} className="opacity-50" />
                </SpecularButton>

                <SpecularButton
                  href="https://buymeacoffee.com/helloabhisy"
                  target="_blank"
                  size="sm"
                  radius={999}
                  tint="#FFDD00"
                  tintOpacity={0.16}
                  lineColor="#FFDD00"
                  baseColor="#665500"
                  textColor="#FFDD00"
                  intensity={1.0}
                  proximity={85}
                  followMouse
                  autoAnimate={false}
                >
                  <Coffee size={13} />
                  <span>Buy me a coffee</span>
                </SpecularButton>
              </div>
            </div>
          </div>

          {/* Story & Acknowledgements (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-white/[0.08] pt-8 lg:pt-0 lg:pl-10 text-left">
            <BlurText
              text="Crafted with vision & dedication"
              as="h4"
              className="font-display font-bold text-xl text-white mb-3"
              scrollDriven
              direction="bottom"
            />
            <p className="text-sm text-white/70 leading-relaxed font-body mb-6">
              AuraMusic began from a simple conviction: modern mobile music players shouldn't be sluggish web wrappers or compromise audio fidelity for visual style. Every blur radius, spring tension, and native stream resolver was tuned to feel cinematic yet lightweight.
            </p>

            {/* Special Thanks Card */}
            <div className="rounded-2xl p-5 bg-white/[0.03] border border-white/[0.06] relative">
              <div className="flex items-center gap-2 text-xs font-mono text-[#DAB9FF] mb-2 uppercase tracking-wide">
                <Sparkles size={13} className="text-[#BF5AF2]" />
                <span>Special Thanks to Gokul (@Gokul7105)</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Massive gratitude to Gokul for backing the vision and generously sponsoring the Google Antigravity developer tooling through the entire architectural rewrite of the native Media3 playback core.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
