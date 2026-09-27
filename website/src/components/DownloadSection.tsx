import React, { useState, useEffect } from 'react';
import { Download, ShieldCheck, Sparkles, Smartphone, ArrowUpRight, Check } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { AuraLogo } from './AuraLogo';
import { SpecularButton } from './SpecularButton';
import { AuraChip } from './AuraChip';
import BlurText from './BlurText';
import { fetchLatestRelease, FALLBACK_RELEASE, initiateApkDownload } from '../lib/release';

export const DownloadSection: React.FC = () => {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [release, setRelease] = useState(FALLBACK_RELEASE);

  useEffect(() => {
    fetchLatestRelease().then(setRelease);
  }, []);

  const handleDownloadClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setDownloadStarted(true);
    initiateApkDownload(release.apkUrl, release.apkName);
    setTimeout(() => setDownloadStarted(false), 3500);
  };

  return (
    <section id="download" className="relative py-16 sm:py-24 md:py-28 px-3 sm:px-6 md:px-12 max-w-[1200px] mx-auto text-center">
      
      {/* ── Soft Ambient Glow ── */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[800px] h-[300px] sm:h-[400px] rounded-full opacity-25 blur-[60px] sm:blur-[140px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #BF5AF2 0%, #46F5E0 60%, transparent 80%)' }}
      />

      <div className="relative rounded-[28px] sm:rounded-[40px] bg-[#0C0B14]/85 border border-white/[0.09] p-5 sm:p-12 md:p-16 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl">
        
        {/* Brand Icon Header */}
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-white/[0.04] border border-white/[0.1] mb-4 sm:mb-6 shadow-inner">
          <AuraLogo size={28} glow className="text-[#DAB9FF]" />
        </div>

        <BlurText
          text="Experience AuraMusic."
          as="h2"
          className="font-display font-extrabold text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white tracking-tight leading-[1.12] text-center justify-center"
          scrollDriven
          direction="bottom"
        />
        <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-white/70 max-w-xl mx-auto font-body">
          Download the latest standalone signed Android APK directly or explore the open-source repository on GitHub.
        </p>

        {/* Release Version Tag */}
        <div className="mt-4 sm:mt-6">
          <AuraChip
            size="sm"
            variant="aqua"
            pulseDot="#46F5E0"
            label={`${release.version} Official Release (${release.apkName} • ${release.apkSize})`}
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
          {/* Direct Download Trigger */}
          <SpecularButton
            href={release.apkUrl}
            download={release.apkName}
            onClick={handleDownloadClick}
            size="lg"
            radius={999}
            tint="#BF5AF2"
            tintOpacity={0.9}
            lineColor="#ffffff"
            baseColor="#9B38DA"
            intensity={1.0}
            shineSize={10}
            shineFade={36}
            speed={0.35}
            proximity={120}
            followMouse
            autoAnimate={false}
            className="w-full sm:w-auto shadow-[0_10px_35px_-5px_rgba(191,90,242,0.6)] active:scale-[0.97] transition-transform cursor-pointer"
          >
            {downloadStarted ? (
              <>
                <Check size={17} strokeWidth={2} className="text-[#46F5E0]" />
                <span className="text-[#46F5E0]">Downloading {release.version}...</span>
              </>
            ) : (
              <>
                <Download size={17} strokeWidth={1.8} />
                <span>Download APK ({release.version})</span>
              </>
            )}
          </SpecularButton>

          {/* GitHub Releases */}
          <SpecularButton
            href={release.releasesPage}
            target="_blank"
            size="lg"
            radius={999}
            tint="#ffffff"
            tintOpacity={0.06}
            lineColor="#DAB9FF"
            baseColor="#3a3048"
            intensity={0.9}
            blur={8}
            proximity={110}
            followMouse
            autoAnimate={false}
            className="w-full sm:w-auto"
          >
            <GithubIcon size={16} />
            <span>GitHub Releases</span>
            <ArrowUpRight size={14} className="opacity-60" />
          </SpecularButton>
        </div>

        {/* Specifications Grid */}
        <div className="mt-12 pt-10 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <Smartphone size={18} className="text-[#BF5AF2] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-mono text-white/40 uppercase">Compatibility</div>
              <div className="text-sm font-medium text-white/90">Android 8.0+ (API 26+)</div>
              <div className="text-[11px] text-white/50">Targeting Android 14+</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-[#46F5E0] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-mono text-white/40 uppercase">Distribution</div>
              <div className="text-sm font-medium text-white/90">Standalone Signed</div>
              <div className="text-[11px] text-white/50">Zero telemetry or adware</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-[#DAB9FF] shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-mono text-white/40 uppercase">Architectures</div>
              <div className="text-sm font-medium text-white/90">Universal ABI</div>
              <div className="text-[11px] text-white/50">arm64-v8a • v7a • x86_64</div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
