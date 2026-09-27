import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, RotateCcw, MessageSquare } from 'lucide-react';
import { AuraChip } from './AuraChip';

const LYRICS = [
  'of these',
  'Will you quit kicking me under the table?',
  "I'm trying, will somebody make her (I just live, I live day by day)",
  'Shut up about it, can we settle down please? (Fighting demons)',
  "I smoked away my brain, I think I'm going dumb",
  'I just live, I live day by day',
  'Fell in love with a girl, fell out of love with the world',
  "Lord forgive me, I'm trying to find my way",
  "I'm trying, will somebody make her (I just live, I live day by day)",
  'Shut up about it, can we settle down please? (Fighting demons)',
  "I smoked away my brain, I think I'm going dumb"
];

export const ShowcaseLyricsScreen: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(2);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % LYRICS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const activeEl = lineRefs.current[activeIndex];
    const container = scrollContainerRef.current;
    if (activeEl && container) {
      const targetScroll = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [activeIndex]);

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#2B1D22] via-[#1A1116] to-[#0B090D] text-white flex flex-col justify-between p-4 sm:p-5 select-none overflow-hidden font-sans">
      
      {/* ── Soft Ambient Background Atmospheric Glow ── */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #BF5AF2 0%, #E13434 50%, transparent 80%)',
        }}
      />

      {/* ── Top Status Bar ── */}
      <div className="relative z-20 flex items-center justify-between text-[11px] font-mono text-white/80 pt-1 px-1">
        <div className="flex items-center gap-1.5 font-sans font-medium text-xs">
          <span>12:59</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
          <span className="text-[10px] text-white/70">M</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[9px] font-mono text-white/70">VoLTE 0.25 KB/s</span>
          <div className="flex items-end gap-0.5 h-2.5">
            <span className="w-0.5 h-1 bg-white rounded-2xs" />
            <span className="w-0.5 h-1.5 bg-white rounded-2xs" />
            <span className="w-0.5 h-2 bg-white rounded-2xs" />
            <span className="w-0.5 h-2.5 bg-white rounded-2xs" />
          </div>
          <span className="text-[10px] font-sans font-semibold">80</span>
        </div>
      </div>

      {/* ── Top Header with Time-Synced Badge ── */}
      <div className="relative z-20 flex items-center justify-between pt-2 pb-2 px-1 text-white">
        <button className="w-8 h-8 rounded-full bg-white/[0.08] backdrop-blur-md flex items-center justify-center hover:bg-white/[0.14] active:scale-95 transition-all">
          <ChevronDown size={19} strokeWidth={1.8} className="text-white/85" />
        </button>

        <div className="flex flex-col items-center max-w-[210px]">
          <span className="text-xs font-semibold text-white/95 truncate block">
            I Smoked Away My Brain (I'm God x ...
          </span>
          <div className="mt-1">
            <AuraChip
              size="xs"
              variant="violet"
              pulseDot="#BF5AF2"
              label="TIME-SYNCED"
            />
          </div>
        </div>

        <button className="w-8 h-8 rounded-full bg-white/[0.08] backdrop-blur-md flex items-center justify-center hover:bg-white/[0.14] active:scale-95 transition-all">
          <RotateCcw size={16} strokeWidth={1.8} className="text-white/85" />
        </button>
      </div>

      {/* ── Auto-Scrolling Synced Lyrics Body ── */}
      <div
        ref={scrollContainerRef}
        className="relative z-10 my-auto flex-1 overflow-y-auto no-scrollbar py-16 px-3 space-y-7 text-left transition-all"
        style={{ scrollBehavior: 'smooth' }}
      >
        {LYRICS.map((line, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={idx}
              ref={(el) => { lineRefs.current[idx] = el; }}
              onClick={() => setActiveIndex(idx)}
              className={`cursor-pointer transition-all duration-700 select-none ${
                isActive
                  ? 'text-white font-extrabold text-lg sm:text-xl leading-snug drop-shadow-[0_0_15px_rgba(255,255,255,0.45)] scale-100 origin-left opacity-100'
                  : 'text-white/35 font-bold text-base sm:text-lg leading-relaxed hover:text-white/60 opacity-60'
              }`}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* ── Bottom Controls & Floating Capsule ── */}
      <div className="relative z-20 flex items-center justify-between pt-2 pb-1 px-2">
        {/* Floating Purple Glass Icon Capsule */}
        <div className="w-11 h-11 rounded-2xl bg-[#4A2058]/80 border border-white/15 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-[#BF5AF2]/30">
          <MessageSquare size={18} className="text-white fill-white/20" />
        </div>
      </div>

      {/* ── Android Home Gesture Bar ── */}
      <div className="relative z-20 pt-1 pb-0.5 flex justify-center">
        <div className="w-24 h-1 rounded-full bg-white/35" />
      </div>
    </div>
  );
};

export default ShowcaseLyricsScreen;
