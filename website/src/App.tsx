import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SonicNebulaBackground } from './components/SonicNebulaBackground';
import { Navigation } from './components/Navigation';
import { Hero } from './components/Hero';
import { ExperienceFeatures } from './components/ExperienceFeatures';
import { ArchitectureEngine } from './components/ArchitectureEngine';
import { ShowcaseGallery } from './components/ShowcaseGallery';
import { DownloadSection } from './components/DownloadSection';
import { CreatorStory } from './components/CreatorStory';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { OptionWheel } from './components/OptionWheel';
import GradualBlur from './components/GradualBlur';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { Analytics } from '@vercel/analytics/react';

type Route = 'home' | 'privacy' | 'terms';

export function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      if (p === '/privacy' || h === '#/privacy' || h === '#privacy') return 'privacy';
      if (p === '/terms' || h === '#/terms' || h === '#terms') return 'terms';
    }
    return 'home';
  });

  const [activeSection, setActiveSection] = useState<string>('hero');
  const [showOptionWheel, setShowOptionWheel] = useState(false);
  const [currentMood, setCurrentMood] = useState('Ambient Drift');

  useEffect(() => {
    const handleLocationChange = () => {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      if (p === '/privacy' || h === '#/privacy' || h === '#privacy') {
        setCurrentRoute('privacy');
      } else if (p === '/terms' || h === '#/terms' || h === '#terms') {
        setCurrentRoute('terms');
      } else {
        setCurrentRoute('home');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateTo = (route: Route) => {
    setCurrentRoute(route);
    const path = route === 'home' ? '/' : `/${route}`;
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (route === 'home') {
      document.title = 'AuraMusic — Music, in its element.';
    }
  };

  useEffect(() => {
    if (currentRoute !== 'home') return;

    const sections = ['hero', 'experience', 'architecture', 'showcase', 'download'];
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 250;
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }

      // Start showing from Core Capabilities section
      const featuresEl = document.getElementById('features') || document.getElementById('experience');
      if (featuresEl) {
        const rect = featuresEl.getBoundingClientRect();
        setShowOptionWheel(rect.top <= window.innerHeight * 0.75);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentRoute]);

  if (currentRoute === 'privacy') {
    return (
      <PrivacyPolicy
        onNavigateHome={() => navigateTo('home')}
        onNavigateTerms={() => navigateTo('terms')}
      />
    );
  }

  if (currentRoute === 'terms') {
    return (
      <TermsOfService
        onNavigateHome={() => navigateTo('home')}
        onNavigatePrivacy={() => navigateTo('privacy')}
      />
    );
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-clip bg-[#07070C] text-white selection:bg-[#BF5AF2]/30 selection:text-white">
      {/* ── Multi-Layer Sonic Nebula Background ── */}
      <SonicNebulaBackground />

      {/* ── Cinematic Intro & Floating Glass Capsule Navigation ── */}
      <Navigation activeSection={activeSection} />

      {/* ── Main Continuous Stage (One unified atmospheric environment) ── */}
      <main className="relative z-10 w-full max-w-full overflow-x-clip">
        <div id="hero">
          <Hero />
        </div>

        <div id="features">
          <ExperienceFeatures />
        </div>

        <div id="architecture">
          <ArchitectureEngine />
        </div>

        <div id="showcase">
          <ShowcaseGallery />
        </div>

        <FaqSection />

        <div id="download">
          <DownloadSection />
        </div>

        <CreatorStory />
      </main>

      {/* ── Left-Anchored Atmospheric Sound Wheel (Big screens only, starts from Core Capabilities) ── */}
      <AnimatePresence>
        {showOptionWheel && (
          <motion.aside
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="hidden 2xl:flex fixed left-5 top-1/2 -translate-y-1/2 z-30 flex-col items-start pointer-events-auto"
          >
            <div className="relative rounded-[28px] p-3.5 bg-[#0E0C18]/70 border border-white/[0.08] backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] w-[220px] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 mb-1.5 border-b border-white/[0.06] text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#BF5AF2] animate-pulse" />
                  <span className="text-white/80 font-medium tracking-wider uppercase text-[10px]">
                    Sound Profile
                  </span>
                </div>
                <span className="text-[10px] text-[#46F5E0] font-mono">
                  LIVE EQ
                </span>
              </div>

              {/* Option Wheel */}
              <div className="w-full h-[260px] relative overflow-hidden">
                <OptionWheel
                  items={[
                    'Ambient Drift',
                    'Liquid DnB',
                    'Lo-Fi Chill',
                    'Synthwave',
                    'Cloud Rap',
                    'Dark Techno',
                    'Deep House',
                    'Ether Wave',
                    'Neo-Classical'
                  ]}
                  defaultSelected={0}
                  side="left"
                  fontSize={1.1}
                  spacing={1.6}
                  curve={1.1}
                  tilt={7}
                  inset={14}
                  textColor="#6C6080"
                  activeColor="#DAB9FF"
                  smoothing={180}
                  loop={true}
                  draggable={true}
                  onChange={(_idx, item) => setCurrentMood(item)}
                />
              </div>

              {/* Footer status */}
              <div className="pt-2.5 mt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-white/50">
                <span className="truncate max-w-[125px] text-white/80 font-medium">
                  {currentMood}
                </span>
                <div className="flex items-end gap-0.5 h-3">
                  {[40, 75, 55, 90, 60].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-[#BF5AF2]"
                      style={{
                        height: `${h}%`,
                        animation: `pulse ${1 + (i % 3) * 0.4}s ease-in-out infinite`
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Liquid Glass Dissolving Footer ── */}
      <Footer
        onNavigatePrivacy={() => navigateTo('privacy')}
        onNavigateTerms={() => navigateTo('terms')}
      />

      {/* Subtle fixed edge treatment: ten percent of the visible viewport. */}
      <GradualBlur
        target="page"
        position="bottom"
        height="clamp(48px, 7vh, 88px)"
        strength={2}
        divCount={8}
        curve="bezier"
        exponential
        opacity={0.96}
        zIndex={30}
      />

      {/* Vercel Web Analytics */}
      <Analytics />
    </div>
  );
}

export default App;
