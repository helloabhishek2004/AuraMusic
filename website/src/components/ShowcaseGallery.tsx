import React, { useState } from 'react';
import { Eye, Sparkles, Smartphone, Music2, Search as SearchIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BlurText from './BlurText';
import { AuraChip } from './AuraChip';
import { ShowcasePlayerScreen } from './ShowcasePlayerScreen';
import { ShowcaseLyricsScreen } from './ShowcaseLyricsScreen';
import { ShowcaseSearchScreen } from './ShowcaseSearchScreen';

type ShowcaseTab = 'player' | 'lyrics' | 'search';

interface TabItem {
  id: ShowcaseTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  { id: 'player', label: 'Now Playing', icon: <Music2 size={13} strokeWidth={1.8} /> },
  { id: 'lyrics', label: 'Synced Lyrics', icon: <Sparkles size={13} strokeWidth={1.8} /> },
  { id: 'search', label: 'Smart Discovery', icon: <SearchIcon size={13} strokeWidth={1.8} /> },
];

interface Ripple {
  id: number;
  x: number;
  y: number;
  tabId: ShowcaseTab;
}

export const ShowcaseGallery: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('player');
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleTabClick = (tabId: ShowcaseTab, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple: Ripple = { id: Date.now(), x, y, tabId };

    setRipples((prev) => [...prev.slice(-4), newRipple]);
    setActiveTab(tabId);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  };

  return (
    <section id="showcase" className="relative py-16 sm:py-24 md:py-28 px-3 sm:px-6 md:px-12 max-w-[1440px] mx-auto">
      
      {/* ── Section Title ── */}
      <div className="flex flex-col items-center text-center mb-8 sm:mb-14 max-w-2xl mx-auto">
        <div className="mb-3 sm:mb-4">
          <AuraChip
            size="sm"
            variant="violet"
            icon={<Eye size={13} strokeWidth={1.8} />}
            label="Interface Showcase"
          />
        </div>
        <BlurText
          text="Liquid Glass in motion."
          as="h2"
          className="font-display font-extrabold text-2xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-white leading-[1.12] text-center justify-center"
          scrollDriven
          direction="bottom"
        />
        <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-white/65 font-normal leading-relaxed">
          Not a flat card in sight. AuraMusic's interface is built from refractive translucent glass that breathes with the color palette of what you're listening to.
        </p>

        {/* ── Sliding Options Container with Spring Pill & Ripple Effect ── */}
        <div className="mt-6 sm:mt-8 relative inline-flex p-1 sm:p-1.5 rounded-full bg-[#120E1C]/80 border border-white/[0.12] backdrop-blur-2xl shadow-[0_12px_35px_-8px_rgba(0,0,0,0.8)] max-w-full overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={(e) => handleTabClick(tab.id, e)}
                className={`relative px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide transition-all duration-200 active:scale-[0.97] flex items-center gap-1.5 sm:gap-2 select-none overflow-hidden outline-none whitespace-nowrap ${
                  isActive ? 'text-white' : 'text-white/65 hover:text-white'
                }`}
              >
                {/* Smooth Sliding Active Background Pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeShowcaseTab"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-[#BF5AF2] via-[#A838DA] to-[#9B38DA] shadow-[0_4px_22px_rgba(191,90,242,0.6)]"
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 32,
                    }}
                  />
                )}

                {/* Click Ripple Effect */}
                {ripples
                  .filter((r) => r.tabId === tab.id)
                  .map((r) => (
                    <motion.span
                      key={r.id}
                      className="absolute rounded-full pointer-events-none bg-white/35 z-10"
                      style={{
                        left: r.x,
                        top: r.y,
                        transform: 'translate(-50%, -50%)',
                      }}
                      initial={{ width: 0, height: 0, opacity: 0.8 }}
                      animate={{ width: 140, height: 140, opacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    />
                  ))}

                {/* Tab Content */}
                <span className="relative z-20 flex items-center gap-1 sm:gap-1.5">
                  <span className={isActive ? 'text-white' : 'text-[#DAB9FF]/70'}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Showcase Stage ── */}
      <div className="relative rounded-[28px] sm:rounded-[40px] bg-[#0A0912]/80 border border-white/[0.08] p-4 sm:p-10 md:p-16 overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-12 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]">
        
        {/* Soft atmospheric glow inside showcase */}
        <div
          className="absolute -top-[10%] left-[20%] w-[320px] sm:w-[600px] h-[320px] sm:h-[600px] rounded-full opacity-20 blur-[60px] sm:blur-[130px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #BF5AF2 0%, #46F5E0 50%, transparent 75%)' }}
        />

        {/* Left Side: Editorial Design System Notes (Order 2 on mobile, Order 1 on desktop) */}
        <div className="lg:w-1/2 flex flex-col items-start text-left z-10 order-2 lg:order-1">
          <div className="mb-3">
            <AuraChip
              size="xs"
              variant="aqua"
              icon={<Smartphone size={13} strokeWidth={1.8} />}
              label="Native Android Experience"
            />
          </div>
          <h3 className="font-display font-bold text-2xl sm:text-4xl text-white tracking-tight mb-4 sm:mb-6">
            The Sonic Nebula Aesthetic
          </h3>
          
          <div className="space-y-4 sm:space-y-6 text-sm text-white/70 leading-relaxed font-body">
            <div className="rounded-2xl p-4 sm:p-5 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
              <h4 className="font-display font-semibold text-white text-base mb-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#BF5AF2]" />
                Interactive Screen Mirror
              </h4>
              <p>
                Experience the live player, synchronized lyrics engine, and smart instant discovery screens tuned exactly as they render on physical Android devices.
              </p>
            </div>

            <div className="rounded-2xl p-4 sm:p-5 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
              <h4 className="font-display font-semibold text-white text-base mb-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#46F5E0]" />
                Adaptive Album-Art Tinting
              </h4>
              <p>
                Colors are not pre-baked. The UI dynamically extracts key tones from the active artwork and shifts the background nebula in real time.
              </p>
            </div>

            <div className="rounded-2xl p-4 sm:p-5 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
              <h4 className="font-display font-semibold text-white text-base mb-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#DAB9FF]" />
                Continuous Fluid Animation
              </h4>
              <p>
                Zero stiff transitions. Synced lyrics advance line-by-line automatically, the search feed smoothly flows through discovery results, and the playback timeline updates in real time.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Android App Frame Visual (Order 1 on mobile, Order 2 on desktop) */}
        <div className="lg:w-1/2 flex justify-center z-10 w-full order-1 lg:order-2">
          <div className="relative w-full max-w-[310px] sm:max-w-[360px] rounded-[38px] sm:rounded-[48px] p-2.5 sm:p-3 bg-gradient-to-b from-white/20 via-white/5 to-white/15 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]">
            
            {/* Outer Bezel Frame */}
            <div className="relative rounded-[40px] bg-[#07070C] overflow-hidden border border-white/10 shadow-2xl">
              
              {/* Device Camera Punch Hole / Status Island */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-4 rounded-full bg-black/85 border border-white/10 z-40 flex items-center justify-center pointer-events-none">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-700" />
              </div>

              {/* High-Fidelity Phone Screen Container */}
              <div className="w-full aspect-[9/19.5] bg-[#07070C] select-none relative overflow-hidden rounded-[36px]">
                <AnimatePresence mode="wait">
                  {activeTab === 'player' && (
                    <motion.div
                      key="player"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.03 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 w-full h-full overflow-hidden"
                    >
                      <ShowcasePlayerScreen onLyricsClick={() => setActiveTab('lyrics')} />
                    </motion.div>
                  )}

                  {activeTab === 'lyrics' && (
                    <motion.div
                      key="lyrics"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.03 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 w-full h-full overflow-hidden"
                    >
                      <ShowcaseLyricsScreen />
                    </motion.div>
                  )}

                  {activeTab === 'search' && (
                    <motion.div
                      key="search"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.03 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 w-full h-full overflow-hidden"
                    >
                      <ShowcaseSearchScreen />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Glowing Accent Shadow Under Phone */}
            <div
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-12 rounded-full opacity-40 blur-2xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, #BF5AF2 0%, #46F5E0 70%, transparent 100%)' }}
            />
          </div>
        </div>

      </div>
    </section>
  );
};

export default ShowcaseGallery;
