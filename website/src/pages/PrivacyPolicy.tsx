import React, { useState, useEffect } from 'react';
import {
  Shield,
  ArrowLeft,
  Lock,
  Database,
  Wifi,
  EyeOff,
  FolderLock,
  CloudOff,
  Trash2,
  Users,
  Scale,
  FileText,
  Mail,
  CheckCircle2,
  HardDrive,
  Key,
} from 'lucide-react';
import { AuraLogo } from '../components/AuraLogo';
import { GithubIcon } from '../components/GithubIcon';

interface PrivacyPolicyProps {
  onNavigateHome: () => void;
  onNavigateTerms: () => void;
}

const SECTIONS = [
  { id: 'overview', title: '1. Overview & Data Philosophy' },
  { id: 'on-device-data', title: '2. Information Processed On-Device' },
  { id: 'network-requests', title: '3. Direct Outbound Network Requests' },
  { id: 'zero-telemetry', title: '4. Zero Analytics & Tracking Telemetry' },
  { id: 'permissions', title: '5. Android Permissions & Justifications' },
  { id: 'connected-services', title: '6. Optional Connected Services (Google & Spotify)' },
  { id: 'storage-isolation', title: '7. Downloads, Caching & Sandbox Isolation' },
  { id: 'backup-rules', title: '8. Android Auto Backup Configuration' },
  { id: 'data-retention', title: '9. Data Retention & User Controls' },
  { id: 'children-privacy', title: '10. Children\'s Privacy' },
  { id: 'legal-frameworks', title: '11. Rights Under Applicable Laws (India DPDP, GDPR, CCPA)' },
  { id: 'play-data-safety', title: '12. Google Play Data Safety Alignment' },
  { id: 'policy-changes', title: '13. Policy Changes & Versioning' },
  { id: 'contact', title: '14. Contact & Grievance Redressal' },
];

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  onNavigateHome,
  onNavigateTerms,
}) => {
  const [activeSection, setActiveSection] = useState<string>('overview');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'AuraMusic — Privacy Policy';

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#07070C] text-[#FFFFFF] selection:bg-[#BF5AF2]/30 selection:text-white">
      {/* ── Top Atmospheric Ambient Lighting ── */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[90vw] max-w-[1200px] h-[340px] rounded-full opacity-25 blur-[140px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at top, #BF5AF2 0%, #46F5E0 35%, transparent 75%)',
        }}
      />

      {/* ── Minimal Legal Sticky Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#07070C]/85 border-b border-white/[0.08]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Back to AuraMusic Home"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <div className="h-4 w-[1px] bg-white/[0.12] hidden sm:block" />
            <div className="flex items-center gap-2">
              <AuraLogo size={24} />
              <span className="font-display font-bold text-sm tracking-tight text-white hidden sm:inline">
                AuraMusic
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-[#DAB9FF] border border-white/[0.08]">
                Legal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/50 hidden md:inline">
              Document: Privacy Policy
            </span>
            <button
              onClick={onNavigateTerms}
              className="text-xs text-[#DAB9FF] hover:text-white transition-colors underline-offset-4 hover:underline"
            >
              Terms of Service →
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 lg:py-16">
        {/* Hero Title Block */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#BF5AF2]/10 border border-[#BF5AF2]/20 text-[#DAB9FF] text-xs font-mono uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5 text-[#BF5AF2]" />
            Official Legal Transparency Notice
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight">
            Privacy Policy & Data Transparency
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs font-mono text-white/50">
            <span>Effective Date: September 26, 2026</span>
            <span>•</span>
            <span>Last Updated: September 26, 2026</span>
            <span>•</span>
            <span className="text-[#46F5E0]">Applies to AuraMusic v3.0.0+ & Web</span>
          </div>

          {/* Key Facts Summary Box */}
          <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-[#0E0C18]/90 border border-white/[0.12] backdrop-blur-md">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-white mb-3">
              <CheckCircle2 className="w-4 h-4 text-[#46F5E0]" />
              Core Architectural Commitments at a Glance
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed text-white/80">
              <div className="flex items-start gap-2">
                <span className="text-[#46F5E0] font-mono">01.</span>
                <span><strong>Local-First:</strong> Playlists, history, and favorites are stored strictly on your device.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#46F5E0] font-mono">02.</span>
                <span><strong>No Aura Servers:</strong> No proprietary backend server collects or proxies your listening habits.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#46F5E0] font-mono">03.</span>
                <span><strong>Zero Ad/Tracker SDKs:</strong> No Firebase, Google Analytics, Sentry, Mixpanel, or advertising IDs.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#46F5E0] font-mono">04.</span>
                <span><strong>Complete Deletion:</strong> You can purge caches, downloads, and databases at any time in settings.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content & TOC Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Desktop Table of Contents (Sticky) */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 p-4 rounded-2xl bg-[#0A0912]/80 border border-white/[0.08] backdrop-blur-xl">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#DAB9FF]/70 mb-3 px-2">
                Table of Contents
              </div>
              <nav className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto pr-1 text-xs">
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors leading-snug truncate block ${
                      activeSection === sec.id
                        ? 'bg-[#BF5AF2]/20 text-[#DAB9FF] font-semibold'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {sec.title}
                  </button>
                ))}
              </nav>

              <div className="mt-4 pt-4 border-t border-white/[0.08] text-[11px] text-white/50 px-2 flex flex-col gap-2">
                <a
                  href="https://github.com/helloabhishek2004/AuraMusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
                >
                  <GithubIcon size={12} />
                  <span>Audit Source on GitHub</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Legal Document Content */}
          <article className="lg:col-span-8 xl:col-span-9 space-y-12 text-sm leading-relaxed text-white/75 font-body">

            {/* SECTION 1 */}
            <section id="overview" className="scroll-mt-28 space-y-4">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-[#BF5AF2]" />
                1. Overview & Data Philosophy
              </h2>
              <p>
                AuraMusic is an independent, source-available audio client application and research project created by Abhishek (<code className="text-[#46F5E0] bg-white/[0.06] px-1.5 py-0.5 rounded">@bh!shek</code>). The application combines an AndroidX Media3 (ExoPlayer) native Kotlin audio engine with a modern Liquid Glass user interface.
              </p>
              <p>
                Our architectural philosophy is founded on <strong>complete on-device sovereignty</strong>. AuraMusic does not operate any centralized backend database, intermediary streaming proxy, or user-profiling server. You are not required to create an account, register an email address, or provide any personal details to use AuraMusic.
              </p>
              <p>
                This Privacy Policy provides a rigorous, factually verifiable accounting of how data is stored on your device, what outbound network requests are made, and how your privacy is protected under applicable laws including India's Digital Personal Data Protection Act, 2023, the European Union General Data Protection Regulation (GDPR), and platform developer policies.
              </p>
            </section>

            {/* SECTION 2 */}
            <section id="on-device-data" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Database className="w-5 h-5 text-[#46F5E0]" />
                2. Information Processed On-Device (Local-Only)
              </h2>
              <p>
                All personal customization, listening metrics, and playback states are processed locally and stored exclusively inside your Android device's private app sandbox. This information <strong>never leaves your device</strong> unless you explicitly initiate an external action:
              </p>
              <div className="space-y-3 mt-3">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <h3 className="font-semibold text-white text-xs font-mono uppercase tracking-wider mb-1 text-[#DAB9FF]">
                    • SQLite Database (<code className="text-white">aura_music.db</code>)
                  </h3>
                  <p className="text-xs text-white/70">
                    Stores custom user-created playlists, track bookmarking, liked songs, cached song metadata (title, artist, duration, album art URL), and lyrics cache. Managed via Android Room.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <h3 className="font-semibold text-white text-xs font-mono uppercase tracking-wider mb-1 text-[#DAB9FF]">
                    • Listening History & Local Play Counts (<code className="text-white">AuraPlayer.kt</code> / <code className="text-white">useAnalyticsStore</code>)
                  </h3>
                  <p className="text-xs text-white/70">
                    AuraMusic maintains a local listening history log (track timestamp, completion events, repeat plays) strictly to compute on-device features such as "Quick Picks", "Keep Listening", and "Top Tracks". Despite the naming of internal store modules (e.g., <code className="text-white">analytics.store.ts</code>), <strong>no listening history or analytics event is ever transmitted over the network</strong>. It remains 100% on-device in volatile RAM and SQLite.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <h3 className="font-semibold text-white text-xs font-mono uppercase tracking-wider mb-1 text-[#DAB9FF]">
                    • Application Preferences (<code className="text-white">aura_player_prefs.xml</code> & AsyncStorage)
                  </h3>
                  <p className="text-xs text-white/70">
                    Stores user interface configurations, dynamic/dark theme mode, audio quality presets (High, Medium, Data Saver), equalizer settings, and playback preferences.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 3 */}
            <section id="network-requests" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Wifi className="w-5 h-5 text-[#BF5AF2]" />
                3. Direct Outbound Network Requests
              </h2>
              <p>
                To provide audio discovery, streaming, lyrics, and app updates without an intermediate server, AuraMusic initiates direct HTTPS connections from your device to third-party endpoints. When your device connects to these services, standard TCP/IP transport metadata (such as your device IP address, TLS handshake, and HTTP User-Agent) is inherently exposed to the destination servers as part of standard Internet communication:
              </p>

              <div className="space-y-4 mt-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white">YouTube & Googlevideo CDN (Google LLC)</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Audio & Catalog</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    <strong>Purpose:</strong> Querying public music metadata, artist discographies, album covers, and resolving HTTPS audio stream chunks via the native stream resolver (<code className="text-[#46F5E0]">AndroidVrStreamResolver.kt</code>).<br />
                    <strong>Data Sent:</strong> Search query strings, video/track IDs, and client identification headers necessary for Innertube stream resolution. Visitor data and PoTokens are computed client-side to ensure stable stream delivery.<br />
                    <strong>Governing Policies:</strong> Subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] hover:underline">Google Privacy Policy</a> and <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] hover:underline">YouTube Terms of Service</a>. AuraMusic does not own, store, or control Google servers.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white">LRCLIB (Community API)</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">Synchronized Lyrics</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    <strong>Purpose:</strong> Retrieving time-synchronized (<code className="text-white">.lrc</code>) and plain-text lyrics via <code className="text-[#46F5E0]">LrcLibLyricsProvider.kt</code>.<br />
                    <strong>Data Sent:</strong> Canonical track title, artist name, and duration in seconds. No personal identifiers or account tokens are transmitted.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white">KuGou Lyrics Service</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Lyrics Fallback</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    <strong>Purpose:</strong> Secondary fallback for international and Asian-language synchronized lyrics.<br />
                    <strong>Data Sent:</strong> Track title and artist name. No user data transmitted.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white">GitHub API (GitHub, Inc. / Microsoft)</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-300 border border-zinc-500/20">Software Updates</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    <strong>Purpose:</strong> When checking for newer app versions, AuraMusic contacts <code className="text-[#46F5E0]">https://api.github.com/repos/helloabhishek2004/AuraMusic/releases</code>.<br />
                    <strong>Data Sent:</strong> Standard User-Agent (<code className="text-white">AuraMusic/&lt;version&gt;</code>). Subject to GitHub's Privacy Statement.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white">Network Connectivity Probe (Google)</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Diagnostics</span>
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">
                    <strong>Purpose:</strong> A lightweight HTTP GET request to <code className="text-[#46F5E0]">https://clients3.google.com/generate_204</code> is made solely to test whether active Wi-Fi or Cellular connectivity provides real internet access. No user data or payload is sent.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 4 */}
            <section id="zero-telemetry" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <EyeOff className="w-5 h-5 text-[#46F5E0]" />
                4. Zero Analytics & Tracking Telemetry
              </h2>
              <p>
                AuraMusic contains <strong>NO</strong> commercial trackers, analytics software development kits (SDKs), advertising platforms, or telemetry agents. Specifically:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-white/80">
                <li>No Google Firebase Analytics, Crashlytics, or Cloud Messaging SDKs.</li>
                <li>No Meta (Facebook) SDK, pixel, or Graph API telemetry.</li>
                <li>No Sentry, PostHog, Mixpanel, Amplitude, Bugsnag, or Plausible trackers.</li>
                <li>No advertising SDKs (AdMob, Unity Ads, AppLovin). Zero in-app banner or video ads.</li>
                <li>No reading of Android Advertising ID (AAID) or hardware identifiers (IMEI, MAC address).</li>
                <li>The website (<a href="https://listenwith-auramusic.vercel.app" className="text-[#DAB9FF] hover:underline">listenwith-auramusic.vercel.app</a>) places zero tracking cookies, utilizes zero web beacons, and sets zero persistent identifiers in localStorage.</li>
              </ul>
            </section>

            {/* SECTION 5 */}
            <section id="permissions" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-[#BF5AF2]" />
                5. Android Permissions & Justifications
              </h2>
              <p>
                AuraMusic requests only permissions strictly necessary for native media playback and offline functionality. None of these permissions are used to collect personal information:
              </p>

              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.04] text-white/90 border-b border-white/[0.08]">
                      <th className="p-3 font-mono">Permission</th>
                      <th className="p-3 font-mono">Type</th>
                      <th className="p-3">Purpose & Scope</th>
                      <th className="p-3">Data Leaves Device?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-white/70">
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">FOREGROUND_SERVICE & MEDIA_PLAYBACK</td>
                      <td className="p-3 font-mono">Normal</td>
                      <td className="p-3">Powers continuous background audio playback via AndroidX Media3 when the app is minimized or the screen is locked.</td>
                      <td className="p-3 font-semibold text-emerald-400">NO</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">FOREGROUND_SERVICE_DATA_SYNC</td>
                      <td className="p-3 font-mono">Normal</td>
                      <td className="p-3">Enables uninterrupted background downloading of user-selected offline tracks.</td>
                      <td className="p-3 font-semibold text-emerald-400">NO</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">INTERNET</td>
                      <td className="p-3 font-mono">Normal</td>
                      <td className="p-3">Required to connect directly to YouTube Music, Googlevideo CDN, LRCLIB, KuGou, and GitHub.</td>
                      <td className="p-3">Only to request requested content</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">POST_NOTIFICATIONS</td>
                      <td className="p-3 font-mono">Runtime (13+)</td>
                      <td className="p-3">Displays active playback notification controls (play/pause/skip) and download progress in notification drawer. Optional.</td>
                      <td className="p-3 font-semibold text-emerald-400">NO</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">READ_MEDIA_AUDIO / STORAGE</td>
                      <td className="p-3 font-mono">Runtime</td>
                      <td className="p-3">Allows you to scan and play audio files stored on your device (Local Files tab). Requested only when accessing local files.</td>
                      <td className="p-3 font-semibold text-emerald-400">NO (Local scan only)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">RECORD_AUDIO</td>
                      <td className="p-3 font-mono">Runtime</td>
                      <td className="p-3">Historically required by the Android <code className="text-white">Visualizer</code> API to compute live FFT frequency wave animations for playback visuals. AuraMusic <strong>does NOT record, capture, or save microphone audio</strong>.</td>
                      <td className="p-3 font-semibold text-emerald-400">NO (Volatile audio spectrum)</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">SYSTEM_ALERT_WINDOW</td>
                      <td className="p-3 font-mono">Special</td>
                      <td className="p-3">Powers the floating mini-player overlay on Android. Disabled by default and requires explicit user enablement in Settings.</td>
                      <td className="p-3 font-semibold text-emerald-400">NO</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-[#DAB9FF]">WAKE_LOCK & MODIFY_AUDIO_SETTINGS</td>
                      <td className="p-3 font-mono">Normal</td>
                      <td className="p-3">Prevents CPU sleep during playback to stop audio stuttering; routes audio through equalizer and handles audio focus changes.</td>
                      <td className="p-3 font-semibold text-emerald-400">NO</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 6 */}
            <section id="connected-services" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Key className="w-5 h-5 text-[#46F5E0]" />
                6. Optional Connected Services (Google Sign-In & Spotify)
              </h2>
              <p>
                AuraMusic includes an optional "Connected Apps" hub allowing you to import your personal music libraries. These integrations are completely optional and initiated solely at your discretion:
              </p>
              <div className="space-y-3 mt-3">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <h3 className="font-semibold text-white text-sm mb-1 text-[#DAB9FF]">
                    • Google Sign-In & YouTube API Services (YouTube Music Library)
                  </h3>
                  <div className="text-xs text-white/70 leading-relaxed space-y-2">
                    <p>
                      AuraMusic utilizes official Google Sign-In and YouTube API Services to allow you to view and play your personal YouTube Music playlists. By connecting your Google account, you agree to be bound by the{' '}
                      <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] underline hover:text-white">YouTube Terms of Service</a> and the{' '}
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] underline hover:text-white">Google Privacy Policy</a>.
                    </p>
                    <p>
                      <strong>Requested Scope:</strong> Strictly limited to read-only access: <code className="text-[#46F5E0]">https://www.googleapis.com/auth/youtube.readonly</code>.
                    </p>
                    <p>
                      <strong>Data Accessed:</strong> Your Google account display name/email (for identification in the Connected Apps UI), user-owned playlists (IDs, titles, thumbnails, item counts), and playlist items (video IDs, titles, thumbnails, durations). AuraMusic <strong>never sees, handles, or stores your Google password</strong>.
                    </p>
                    <p>
                      <strong>Token Management:</strong> Google OAuth 2.0 access tokens are held exclusively in volatile memory via native Google Play Services on your device. They are <strong>never stored</strong> in AuraMusic's databases, persistent AsyncStorage, SecureStore, or any developer server. No long-lived refresh tokens exist on your device (<code className="text-white">offlineAccess: false</code>).
                    </p>
                    <p>
                      <strong>Data Retention & Caching:</strong> In compliance with the{' '}
                      <a href="https://developers.google.com/youtube/terms/developer-policies" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] underline hover:text-white">YouTube API Services Developer Policies</a>{' '}
                      (Section III.D), cached playlist and track metadata are stored locally on your device for a maximum of 30 calendar days. Any cached YouTube data exceeding 30 days is deterministically purged.
                    </p>
                    <p>
                      <strong>Disconnect & Programmatic Revocation:</strong> When you disconnect YouTube Music via Settings → Connected Apps, AuraMusic attempts programmatic OAuth revocation via Google Play Services (<code className="text-white">GoogleSignin.revokeAccess()</code>), terminates the local session, and permanently deletes all imported playlists and cached track listings from local storage. If device network connectivity prevents immediate server-side revocation confirmation, AuraMusic alerts the user and provides a direct path to Google Account Security Settings to verify or revoke access directly.
                    </p>
                    <p>
                      <strong>Google Security Settings:</strong> You can view or revoke AuraMusic's access directly at any time via{' '}
                      <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-[#46F5E0] underline hover:text-white font-mono">Google Account Security Settings (Permissions)</a>. When access is revoked externally, AuraMusic detects the revocation, transitions the service to expired status, and immediately purges all cached YouTube Authorized Data.
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <h3 className="font-semibold text-white text-sm mb-1 text-[#DAB9FF]">
                    • Spotify Integration (Library Sync via PKCE OAuth)
                  </h3>
                  <p className="text-xs text-white/70 leading-relaxed">
                    Uses standard RFC 7636 Proof Key for Code Exchange (PKCE) OAuth 2.0 directly communicating with <code className="text-white">accounts.spotify.com</code>. Tokens are encrypted locally in <code className="text-white">expo-secure-store</code>. Used solely to read your public/private playlists and match tracks to YouTube stream counterparts. AuraMusic never transmits your Spotify tokens to any third party.
                  </p>
                </div>
              </div>
              <p className="text-xs text-white/60">
                You can disconnect these services at any time from <strong>Settings → Connected Apps</strong>, which immediately erases all stored tokens from secure storage.
              </p>
            </section>

            {/* SECTION 7 */}
            <section id="storage-isolation" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <FolderLock className="w-5 h-5 text-[#BF5AF2]" />
                7. Downloads, Caching & Sandbox Isolation
              </h2>
              <p>
                AuraMusic stores downloaded music and cached media within the Android application sandbox directory (<code className="text-[#46F5E0]">Context.getFilesDir()</code>):
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-white/80">
                <li>Downloaded audio files are placed in <code className="text-white">/files/aura/audio/</code>.</li>
                <li>Album artwork and visual assets are placed in <code className="text-white">/files/aura/artwork/</code>.</li>
                <li>Temporary streaming chunks are handled by ExoPlayer's memory and temporary disk cache (<code className="text-white">getCacheDir()</code>).</li>
              </ul>
              <p className="text-xs text-white/70">
                Android sandbox isolation prevents other non-root applications from inspecting or accessing these private directories. If you uninstall AuraMusic, the Android operating system immediately and irrevocably erases all sandboxed files, downloads, and databases.
              </p>
            </section>

            {/* SECTION 8 */}
            <section id="backup-rules" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <CloudOff className="w-5 h-5 text-[#46F5E0]" />
                8. Android Auto Backup Configuration
              </h2>
              <p>
                AuraMusic enforces explicit Android Auto Backup rules (<code className="text-white">backup_rules.xml</code> and <code className="text-white">data_extraction_rules.xml</code>):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="font-semibold text-emerald-400 block mb-1">Included in Backup (&lt; 1 MB):</span>
                  <p className="text-white/70">
                    Room database files (<code className="text-white">aura_music.db</code>), SharedPreferences, and AsyncStorage settings. This allows your playlist organization and preferences to restore seamlessly if you migrate devices.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <span className="font-semibold text-rose-400 block mb-1">Strictly Excluded from Backup:</span>
                  <p className="text-white/70">
                    Downloaded audio files (<code className="text-white">/files/aura/audio/</code>), cached album artwork, and temporary media chunks. Audio files are never uploaded to Google Drive backup storage.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 9 */}
            <section id="data-retention" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Trash2 className="w-5 h-5 text-[#BF5AF2]" />
                9. Data Retention & User Deletion Controls
              </h2>
              <p>
                Because all data resides on your physical device, you maintain total, sovereign control over its retention and deletion. You can execute immediate deletion at any time through the app:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <span><strong>Clear Media Cache:</strong> Settings → Storage & Cache → Clear Cache</span>
                  <span className="text-white/50 font-mono">Wipes cached audio chunks & lyrics</span>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <span><strong>Delete Offline Downloads:</strong> Downloads tab or Settings → Clear Downloads</span>
                  <span className="text-white/50 font-mono">Permanently removes all saved audio files</span>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <span><strong>Clear Listening History:</strong> Settings → Library & History → Clear History</span>
                  <span className="text-white/50 font-mono">Resets playback logs & recommendations</span>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <span><strong>Complete App Purge:</strong> Device Settings → Apps → AuraMusic → Clear Data or Uninstall</span>
                  <span className="text-white/50 font-mono">Android OS erases 100% of app storage</span>
                </div>
              </div>
            </section>

            {/* SECTION 10 */}
            <section id="children-privacy" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#46F5E0]" />
                10. Children's Privacy
              </h2>
              <p>
                AuraMusic is a general-purpose audio player utility. We do not knowingly solicit, collect, or process personal data from children under the age of 13 (or under 16/18 where specified by local law, including India's Digital Personal Data Protection Act, 2023). Because AuraMusic operates without user accounts and does not transmit personal data off-device, no identifiable children's data is gathered or stored by the developer.
              </p>
            </section>

            {/* SECTION 11 */}
            <section id="legal-frameworks" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-[#BF5AF2]" />
                11. Rights Under Applicable Laws
              </h2>
              <p>
                AuraMusic honors the core privacy principles established by international privacy statutes:
              </p>
              <div className="space-y-3 mt-2 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <h3 className="font-bold text-white mb-1">India: Digital Personal Data Protection Act, 2023 (DPDPA) & Rules 2025</h3>
                  <p className="text-white/70">
                    AuraMusic operates on a privacy-by-design, local-first paradigm. Because no personal data fiduciary server is maintained, processing is performed under user command on the user's digital personal device. You have the right to access, rectify, and erase all local data directly via in-app controls, and to contact our designated Grievance mechanism.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <h3 className="font-bold text-white mb-1">European Economic Area (EEA) / UK: GDPR & Data Protection Act 2018</h3>
                  <p className="text-white/70">
                    Under GDPR, outgoing requests to third-party CDNs are executed based on legitimate interest and contract performance to stream audio you select. You retain full rights to data erasure (Right to be Forgotten), access, and restriction—all executable locally without requiring interaction with a central data controller.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <h3 className="font-bold text-white mb-1">California: CCPA / CPRA Notice</h3>
                  <p className="text-white/70">
                    AuraMusic does not "sell", "share", or commercialize your personal information or sensitive personal data as defined by the California Consumer Privacy Act.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 12 */}
            <section id="play-data-safety" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#46F5E0]" />
                12. Google Play Data Safety Alignment
              </h2>
              <p>
                This policy is calibrated for total consistency with Google Play's User Data and Data Safety declaration standards:
              </p>
              <div className="p-4 rounded-xl bg-[#0E0C18]/80 border border-white/[0.1] text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <span className="font-semibold text-white">Data Collection by AuraMusic:</span>
                  <span className="text-emerald-400 font-mono">None (0 data types collected off-device)</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <span className="font-semibold text-white">Data Sharing with Third Parties:</span>
                  <span className="text-emerald-400 font-mono">None (No developer data transfers)</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <span className="font-semibold text-white">Ephemeral Processing:</span>
                  <span className="text-white/70 font-mono">Outbound stream requests to YouTube / LRCLIB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Account / Data Deletion Mechanism:</span>
                  <span className="text-white/70 font-mono">In-App Reset & OS Application Clear Data</span>
                </div>
              </div>
            </section>

            {/* SECTION 13 */}
            <section id="policy-changes" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-[#BF5AF2]" />
                13. Policy Changes & Versioning
              </h2>
              <p>
                If future versions of AuraMusic introduce new features that alter networking or storage architecture, this Privacy Policy will be revised with an updated "Last Updated" timestamp and published directly within official application releases and on <a href="https://listenwith-auramusic.vercel.app/privacy" className="text-[#DAB9FF] hover:underline">listenwith-auramusic.vercel.app/privacy</a>. Continued use of AuraMusic following an update constitutes acceptance of the amended policy.
              </p>
            </section>

            {/* SECTION 14 */}
            <section id="contact" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-[#46F5E0]" />
                14. Contact & Grievance Redressal
              </h2>
              <p>
                AuraMusic is developed and maintained by Abhishek (<code className="text-[#46F5E0]">@bh!shek</code>). For technical questions, privacy inquiries, or responsible vulnerability disclosure, please utilize the official channels below:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                  <span className="text-white/50 uppercase font-mono tracking-wider text-[10px]">GitHub Repository</span>
                  <div className="font-medium text-white flex items-center gap-1.5">
                    <GithubIcon size={14} />
                    <a
                      href="https://github.com/helloabhishek2004/AuraMusic"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#DAB9FF] hover:underline"
                    >
                      helloabhishek2004/AuraMusic
                    </a>
                  </div>
                  <p className="text-white/60 text-[11px]">
                    Open public issues or private security advisories for architectural audits.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                  <span className="text-white/50 uppercase font-mono tracking-wider text-[10px]">Maintainer Contact</span>
                  <div className="font-medium text-white flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#46F5E0]" />
                    <span className="text-white">abhishekdq2004@gmail.com</span>
                  </div>
                  <p className="text-white/60 text-[11px]">
                    [Grievance Officer / Maintainer Communication Channel]
                  </p>
                </div>
              </div>
            </section>

          </article>
        </div>

        {/* Footer Navigation Bar */}
        <div className="mt-16 pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-white/50">
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateHome}
              className="text-[#DAB9FF] hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to AuraMusic</span>
            </button>
            <span>•</span>
            <button
              onClick={onNavigateTerms}
              className="text-white/70 hover:text-white transition-colors"
            >
              Terms of Service
            </button>
          </div>
          <div>
            © 2026 AuraMusic Project • Private by Design
          </div>
        </div>
      </div>
    </div>
  );
};
