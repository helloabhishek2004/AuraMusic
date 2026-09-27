import React, { useRef, useEffect, useState } from 'react';
import { Search, X, Play, Heart, Download } from 'lucide-react';
import { AuraChip } from './AuraChip';

interface SongItem {
  title: string;
  artist: string;
  image: string;
}

const TOP_RESULT_IMAGE = 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/64/8f/5f/648f5f68-3ffa-e33d-39d0-50210803074f/196871388221.jpg/600x600bb.jpg';

const RELATED_SONGS: SongItem[] = [
  {
    title: 'Pure [feat. Imogen Heap]',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/64/8f/5f/648f5f68-3ffa-e33d-39d0-50210803074f/196871388221.jpg/600x600bb.jpg',
  },
  {
    title: 'Demons',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/c1/8b/a9/c18ba9c4-89a2-748b-5341-2b7d8b984d96/SonyBMG.589835672.00000000000027240959.CROPPED.dj.cbbenczy.jpg/600x600bb.jpg',
  },
  {
    title: 'Sandman',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9f/9b/4c/9f9b4cbc-5910-51fb-8486-adf3b89bc973/886444594837.jpg/600x600bb.jpg',
  },
  {
    title: 'D.M.B.',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Video112/v4/7d/48/7e/7d487e1c-d166-dc9e-8182-4bba3970b9be/1965891418590101.jpg/600x600bb.jpg',
  },
  {
    title: 'RIOT (Rowdy Pipe\'n)',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/2c/68/07/2c680788-dbd2-2a81-0c07-6ae67d9b36ce/196871306652.jpg/600x600bb.jpg',
  },
  {
    title: 'Lord Pretty Flacko Jodye 2',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9f/9b/4c/9f9b4cbc-5910-51fb-8486-adf3b89bc973/886444594837.jpg/600x600bb.jpg',
  },
  {
    title: 'I\'m God',
    artist: 'Clams Casino & Imogen Heap',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/20/8d/df/208ddfb0-763a-2d8d-fcb8-804f9cc3960b/193436209786_01_img001.jpg/600x600bb.jpg',
  },
];

const ARTISTS = [
  {
    name: 'Imogen Heap',
    followers: '3.8M monthly listeners',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Clams Casino',
    followers: '1.9M monthly listeners',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'A$AP Rocky',
    followers: '34M monthly listeners',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Dean Blunt',
    followers: '540K monthly listeners',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/3a/59/77/3a5977f8-ff6d-c938-4a47-f94dd85fb1eb/810025346591_cover.jpg/600x600bb.jpg',
  },
];

const ALBUMS = [
  {
    title: 'CRYPTO RASTA',
    artist: 'Crypto Rasta',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/64/8f/5f/648f5f68-3ffa-e33d-39d0-50210803074f/196871388221.jpg/600x600bb.jpg',
  },
  {
    title: 'LIVE.LOVE.A$AP',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/c1/8b/a9/c18ba9c4-89a2-748b-5341-2b7d8b984d96/SonyBMG.589835672.00000000000027240959.CROPPED.dj.cbbenczy.jpg/600x600bb.jpg',
  },
  {
    title: 'TESTING',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d3/91/9c/d3919c54-3426-07a2-91a4-b4e46b2a8d34/886447076453.jpg/600x600bb.jpg',
  },
  {
    title: 'AT.LONG.LAST.A$AP',
    artist: 'A$AP Rocky',
    image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/9f/9b/4c/9f9b4cbc-5910-51fb-8486-adf3b89bc973/886444594837.jpg/600x600bb.jpg',
  },
];

export const ShowcaseSearchScreen: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);

  // Smooth continuous auto-scroll loop with pause at top and bottom
  useEffect(() => {
    let animId = 0;
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let waitCounter = 90; // 1.5s initial pause so Top Result is seen
    let direction: 'down' | 'up' = 'down';

    const step = () => {
      if (!isPaused.current && scrollContainer) {
        if (waitCounter > 0) {
          waitCounter--;
        } else {
          if (direction === 'down') {
            scrollContainer.scrollTop += 0.65;
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 2) {
              direction = 'up';
              waitCounter = 120; // 2s pause at bottom
            }
          } else {
            scrollContainer.scrollTop -= 2.2; // gentle fast glide back up
            if (scrollContainer.scrollTop <= 0) {
              scrollContainer.scrollTop = 0;
              direction = 'down';
              waitCounter = 100; // 1.6s pause at top
            }
          }
        }
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      className="relative w-full h-full bg-[#08060E] text-white flex flex-col select-none overflow-hidden font-sans min-w-0"
      onMouseEnter={() => { isPaused.current = true; }}
      onMouseLeave={() => { isPaused.current = false; }}
      onTouchStart={() => { isPaused.current = true; }}
      onTouchEnd={() => { isPaused.current = false; }}
    >
      
      {/* ── Top Ambient Atmosphere ── */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-48 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #9A34EA 0%, #46F5E0 60%, transparent 80%)' }}
      />

      {/* ── Fixed Header Section with Safe Area Insets ── */}
      <div className="relative z-20 px-4 pt-3.5 pb-2 bg-[#08060E]/95 backdrop-blur-md border-b border-white/[0.05] shrink-0">
        {/* Top Status Bar (Safe from curved phone corners) */}
        <div className="flex items-center justify-between text-[11px] font-mono text-white/80 pb-2 px-1">
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

        {/* Search Title */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <Search size={18} className="text-[#BF5AF2]" />
          <h3 className="font-display font-bold text-lg text-white tracking-tight">
            Search
          </h3>
        </div>

        {/* Search Input Box */}
        <div className="h-9 rounded-full bg-white/[0.07] border border-white/[0.1] px-3.5 flex items-center justify-between text-xs shadow-inner">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Search size={13} className="text-white/50 shrink-0" />
            <span className="text-white/95 font-medium truncate text-xs">
              i smoked away my brain
            </span>
          </div>
          <button className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white shrink-0">
            <X size={10} />
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 pt-2 overflow-x-auto no-scrollbar">
          {['All', 'Tracks', 'Artists', 'Albums', 'Playlists'].map((cat) => (
            <AuraChip
              key={cat}
              size="xs"
              variant={activeCategory === cat ? 'violet' : 'neutral'}
              label={cat}
              interactive
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>

        {/* Results Tag */}
        <div className="pt-2 text-[10px] font-mono text-[#DAB9FF]/70 px-1">
          Results for <span className="text-white font-semibold">"i smoked away my brain"</span>
        </div>
      </div>

      {/* ── Auto-Scrolling Vertical Results Container (Strictly Bounded by min-h-0) ── */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pt-3 pb-6 space-y-4 text-left"
      >
        
        {/* 1. TOP RESULT CARD */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#BF5AF2] uppercase tracking-wider mb-2">
            <span className="w-1 h-3 rounded-full bg-[#BF5AF2]" />
            <span>Top Result</span>
          </div>

          <div className="rounded-2xl bg-gradient-to-b from-[#1C122C] to-[#120B1D] border border-white/[0.1] p-3 shadow-xl overflow-hidden">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 border border-white/10 shadow-lg bg-[#140D20]">
              <img
                src={TOP_RESULT_IMAGE}
                alt="Don't Be Dumb - A$AP Rocky"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>

            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider bg-[#46F5E0]/15 text-[#46F5E0] border border-[#46F5E0]/30">
                BEST MATCH
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider bg-[#46F5E0]/15 text-[#46F5E0] border border-[#46F5E0]/30">
                SONG
              </span>
            </div>

            <h4 className="font-display font-bold text-sm sm:text-base text-white tracking-tight line-clamp-1">
              I Smoked Away My Brain (I'm God x Demons...
            </h4>
            <p className="text-xs text-white/60 mt-0.5">
              Song • A$AP Rocky
            </p>

            {/* Card Action Row */}
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/[0.06]">
              <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#9A34EA] text-white text-xs font-semibold shadow-md shadow-[#9A34EA]/30 active:scale-95 transition-transform">
                <Play size={12} className="fill-white" />
                <span>Play Now</span>
              </button>
              <div className="flex items-center gap-2.5 text-white/70">
                <Heart size={16} className="hover:text-white" />
                <Download size={16} className="hover:text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. RELATED SONGS LIST */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#46F5E0] uppercase tracking-wider mb-2">
            <span className="w-1 h-3 rounded-full bg-[#46F5E0]" />
            <span>Related Songs</span>
          </div>

          <div className="space-y-1.5">
            {RELATED_SONGS.map((song, i) => (
              <div
                key={i}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.07] flex items-center justify-between transition-colors overflow-hidden"
              >
                <div className="flex items-center gap-2.5 overflow-hidden min-w-0 pr-2">
                  <img
                    src={song.image}
                    alt={song.title}
                    className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0 bg-neutral-900"
                    loading="lazy"
                  />
                  <div className="truncate min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {song.title}
                    </div>
                    <div className="text-[10px] text-white/50 truncate mt-0.5">
                      {song.artist}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-white/60 shrink-0">
                  <Heart size={14} className="hover:text-white" />
                  <Download size={14} className="hover:text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. ARTISTS SECTION */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#DAB9FF] uppercase tracking-wider mb-2">
            <span className="w-1 h-3 rounded-full bg-[#DAB9FF]" />
            <span>Artists</span>
          </div>

          <div className="space-y-2">
            {ARTISTS.map((artist, i) => (
              <div
                key={i}
                className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-between overflow-hidden"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-9 h-9 rounded-full object-cover border border-white/10 bg-neutral-900 shrink-0"
                    loading="lazy"
                  />
                  <div className="truncate min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {artist.name}
                    </div>
                    <div className="text-[10px] text-white/40 truncate">
                      {artist.followers}
                    </div>
                  </div>
                </div>

                <button className="px-3 py-1 rounded-full text-[10px] font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white/80 border border-white/10 transition-colors shrink-0">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 4. ALBUMS SECTION */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#BF5AF2] uppercase tracking-wider mb-2">
            <span className="w-1 h-3 rounded-full bg-[#BF5AF2]" />
            <span>Albums</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ALBUMS.map((album, i) => (
              <div key={i} className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
                <img
                  src={album.image}
                  alt={album.title}
                  className="w-full aspect-square rounded-lg object-cover border border-white/10 mb-1.5 bg-neutral-900"
                  loading="lazy"
                />
                <div className="text-xs font-semibold text-white truncate">
                  {album.title}
                </div>
                <div className="text-[10px] text-white/45 truncate">
                  {album.artist}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Minimal Android Home Gesture Indicator (No Bottom Nav Bar) ── */}
      <div className="relative z-20 pt-1 pb-1.5 flex justify-center bg-[#08060E]/90 border-t border-white/[0.04] shrink-0">
        <div className="w-24 h-1 rounded-full bg-white/35" />
      </div>

    </div>
  );
};

export default ShowcaseSearchScreen;
