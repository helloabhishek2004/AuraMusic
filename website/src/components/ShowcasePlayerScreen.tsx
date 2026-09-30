import React, { useState, useEffect } from 'react';
import { Heart, Download, SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, MessageSquare, ListMusic, MoreHorizontal, ChevronDown } from 'lucide-react';

interface ShowcasePlayerScreenProps {
  onLyricsClick?: () => void;
}

export const ShowcasePlayerScreen: React.FC<ShowcasePlayerScreenProps> = ({ onLyricsClick }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [progress, setProgress] = useState(1); // in seconds
  const totalDuration = 190; // 3:10 in seconds

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= totalDuration ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const remainingTime = totalDuration - progress;

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#2E2024] via-[#1A1318] to-[#0D0B0F] text-white flex flex-col justify-between p-4 sm:p-5 select-none overflow-hidden font-sans">
      
      {/* ── Ambient Glow matching album tone ── */}
      <div
        className="absolute top-12 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-35 blur-3xl pointer-events-none transition-all duration-1000"
        style={{
          background: isPlaying
            ? 'radial-gradient(circle, #E13434 0%, #A8287A 50%, transparent 80%)'
            : 'radial-gradient(circle, #5A3248 0%, transparent 70%)',
        }}
      />

      {/* ── Top Status Bar ── */}
      <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-white/80 pt-1 px-1">
        <div className="flex items-center gap-1.5 font-sans font-medium text-xs">
          <span>12:59</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
          <span className="text-[10px] text-white/70">M</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-[9px] font-mono text-white/70">VoLTE 212.3 KB/s</span>
          <div className="flex items-end gap-0.5 h-2.5">
            <span className="w-0.5 h-1 bg-white rounded-2xs" />
            <span className="w-0.5 h-1.5 bg-white rounded-2xs" />
            <span className="w-0.5 h-2 bg-white rounded-2xs" />
            <span className="w-0.5 h-2.5 bg-white rounded-2xs" />
          </div>
          <span className="text-[10px] font-sans font-semibold">80</span>
        </div>
      </div>

      {/* ── Top Navigation Bar ── */}
      <div className="relative z-10 flex items-center justify-between pt-2 pb-1 px-1 text-white/80">
        <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
          <ChevronDown size={20} className="text-white/80" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-mono tracking-widest text-white/45 uppercase block">
            NOW PLAYING
          </span>
          <span className="text-xs font-semibold text-white/90 truncate max-w-[180px] block">
            Aura Liquid Engine
          </span>
        </div>
        <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
          <MoreHorizontal size={18} className="text-white/80" />
        </button>
      </div>

      {/* ── Album Artwork with Audio Pulse Breathing ── */}
      <div className="relative z-10 my-auto flex flex-col items-center">
        <div
          className={`relative w-[210px] sm:w-[230px] aspect-square rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/10 transition-transform duration-700 ${
            isPlaying ? 'scale-100 hover:scale-[1.02]' : 'scale-[0.96] opacity-85'
          }`}
          style={{
            animation: isPlaying ? 'floatSlow 4s ease-in-out infinite' : 'none',
          }}
        >
          <img
            src="/showcase/asap_album.jpg"
            alt="Don't Be Dumb - A$AP Rocky"
            className="w-full h-full object-cover"
          />
          {/* Subtle frosted glass specular sheen */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10 pointer-events-none" />
        </div>
      </div>

      {/* ── Track Info Row (Title, Artist, Heart, Download) ── */}
      <div className="relative z-10 px-2 pt-2">
        <div className="flex items-center justify-between">
          <div className="truncate pr-2">
            <h4 className="font-display font-bold text-base sm:text-lg text-white tracking-tight truncate">
              I Smoked Away My Brain (I'm ...
            </h4>
            <p className="text-xs sm:text-sm text-white/60 font-medium truncate mt-0.5">
              A$AP Rocky
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className="p-1 text-white/80 hover:text-white transition-colors"
              title="Add to Favorites"
            >
              <Heart
                size={20}
                className={`transition-all duration-200 ${
                  isLiked ? 'fill-[#E13434] text-[#E13434] scale-110' : 'text-white/80'
                }`}
              />
            </button>
            <button className="p-1 text-white/80 hover:text-white transition-colors" title="Download Offline">
              <Download size={20} className="text-white/80" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Progress Scrubber ── */}
      <div className="relative z-10 px-2 pt-4 space-y-1.5">
        <div className="relative h-1 w-full bg-white/20 rounded-full cursor-pointer overflow-hidden group">
          <div
            className="h-full bg-white rounded-full transition-all duration-300 relative"
            style={{ width: `${(progress / totalDuration) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono text-white/50">
          <span>{formatTime(progress)}</span>
          <span>-{formatTime(remainingTime)}</span>
        </div>
      </div>

      {/* ── Transport Controls ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-1">
        <button
          onClick={() => setProgress((p) => Math.max(0, p - 10))}
          className="p-2 text-white/80 hover:text-white transition-colors active:scale-90"
        >
          <SkipBack size={26} className="fill-white/80" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all"
        >
          {isPlaying ? (
            <Pause size={28} className="fill-black" />
          ) : (
            <Play size={28} className="fill-black translate-x-0.5" />
          )}
        </button>

        <button
          onClick={() => setProgress((p) => Math.min(totalDuration, p + 10))}
          className="p-2 text-white/80 hover:text-white transition-colors active:scale-90"
        >
          <SkipForward size={26} className="fill-white/80" />
        </button>
      </div>

      {/* ── Volume Bar Row ── */}
      <div className="relative z-10 flex items-center gap-3 px-3 pt-3 text-white/50">
        <VolumeX size={16} className="shrink-0" />
        <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/85 rounded-full w-[65%]" />
        </div>
        <Volume2 size={16} className="shrink-0 text-white/70" />
      </div>

      {/* ── Bottom Action Row (Lyrics, Queue, More) ── */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-4 pb-1 text-white/65">
        <button
          onClick={onLyricsClick}
          className="p-2 hover:text-white transition-colors flex items-center gap-1 hover:bg-white/[0.08] rounded-xl"
          title="Open Synced Lyrics"
        >
          <MessageSquare size={19} className="text-white/85" />
        </button>
        <button className="p-2 hover:text-white transition-colors hover:bg-white/[0.08] rounded-xl">
          <ListMusic size={19} />
        </button>
        <button className="p-2 hover:text-white transition-colors hover:bg-white/[0.08] rounded-xl">
          <MoreHorizontal size={19} />
        </button>
      </div>

      {/* ── Android Home Gesture Bar ── */}
      <div className="relative z-10 pt-2 pb-0.5 flex justify-center">
        <div className="w-24 h-1 rounded-full bg-white/35" />
      </div>
    </div>
  );
};

export default ShowcasePlayerScreen;
