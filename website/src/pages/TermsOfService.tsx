import React, { useState, useEffect } from 'react';
import {
  FileText,
  ArrowLeft,
  Scale,
  ShieldCheck,
  AlertCircle,
  Code2,
  Cpu,
  Globe,
  Ban,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import { AuraLogo } from '../components/AuraLogo';
import { GithubIcon } from '../components/GithubIcon';

interface TermsOfServiceProps {
  onNavigateHome: () => void;
  onNavigatePrivacy: () => void;
}

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'description', title: '2. Description of Application & Architecture' },
  { id: 'eligibility', title: '3. Eligibility & Personal License' },
  { id: 'licensing', title: '4. Open-Source Software & Intellectual Property' },
  { id: 'third-party-content', title: '5. Third-Party Services & Media Disclaimer' },
  { id: 'user-conduct', title: '6. Acceptable Use & User Conduct' },
  { id: 'copyright-dmca', title: '7. Copyright, DMCA & Notice Procedures' },
  { id: 'disclaimer-warranties', title: '8. Disclaimer of Warranties ("AS IS")' },
  { id: 'limitation-liability', title: '9. Limitation of Liability' },
  { id: 'service-changes', title: '10. Modifications & Termination' },
  { id: 'governing-law', title: '11. Governing Law & Jurisdiction' },
  { id: 'contact', title: '12. Contact Information' },
];

export const TermsOfService: React.FC<TermsOfServiceProps> = ({
  onNavigateHome,
  onNavigatePrivacy,
}) => {
  const [activeSection, setActiveSection] = useState<string>('acceptance');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'AuraMusic — Terms of Service';

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
              Document: Terms of Service
            </span>
            <button
              onClick={onNavigatePrivacy}
              className="text-xs text-[#DAB9FF] hover:text-white transition-colors underline-offset-4 hover:underline"
            >
              Privacy Policy →
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 lg:py-16">
        {/* Hero Title Block */}
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#46F5E0]/10 border border-[#46F5E0]/20 text-[#46F5E0] text-xs font-mono uppercase tracking-wider mb-4">
            <Scale className="w-3.5 h-3.5 text-[#46F5E0]" />
            Official Terms of Service
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight">
            Terms of Service & Usage Conditions
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs font-mono text-white/50">
            <span>Effective Date: September 26, 2026</span>
            <span>•</span>
            <span>Last Updated: September 26, 2026</span>
            <span>•</span>
            <span className="text-[#BF5AF2]">Applies to AuraMusic Application & Website</span>
          </div>

          {/* Key Facts Summary Box */}
          <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-[#0E0C18]/90 border border-white/[0.12] backdrop-blur-md">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-white mb-3">
              <CheckCircle2 className="w-4 h-4 text-[#DAB9FF]" />
              Important Terms Summary
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed text-white/80">
              <div className="flex items-start gap-2">
                <span className="text-[#DAB9FF] font-mono">01.</span>
                <span><strong>Independent Client:</strong> AuraMusic is a client-side interface tool; it does not host or license copyrighted audio.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#DAB9FF] font-mono">02.</span>
                <span><strong>Personal Study & Use:</strong> Designed for personal research, educational study, and lawful audio playback.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#DAB9FF] font-mono">03.</span>
                <span><strong>Third-Party Compliance:</strong> Your streaming of external catalogs is governed by the respective providers' terms.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#DAB9FF] font-mono">04.</span>
                <span><strong>No Commercial Warranty:</strong> Provided "AS IS" free of charge under open-source software principles.</span>
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
                  <span>GitHub Repository</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Legal Document Content */}
          <article className="lg:col-span-8 xl:col-span-9 space-y-12 text-sm leading-relaxed text-white/75 font-body">

            {/* SECTION 1 */}
            <section id="acceptance" className="scroll-mt-28 space-y-4">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#BF5AF2]" />
                1. Acceptance of Terms
              </h2>
              <p>
                By downloading, installing, accessing, or using the AuraMusic Android application ("Application") or the AuraMusic website (<a href="https://listenwith-auramusic.vercel.app" className="text-[#DAB9FF] hover:underline">listenwith-auramusic.vercel.app</a>, "Website"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not install or use the Application or Website.
              </p>
              <p>
                These Terms constitute a binding legal agreement between you as an individual user and the AuraMusic open-source project maintainer, Abhishek (<code className="text-[#46F5E0] bg-white/[0.06] px-1.5 py-0.5 rounded">@bh!shek</code>).
              </p>
            </section>

            {/* SECTION 2 */}
            <section id="description" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-[#46F5E0]" />
                2. Description of Application & Architecture
              </h2>
              <p>
                AuraMusic is an independent, client-side Android music player utility engineered for local playback, high-fidelity audio rendering, and modern visual design experimentation. AuraMusic functions exclusively as a <strong>local client interface</strong>.
              </p>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2 text-xs">
                <p>
                  <strong>Architectural Reality:</strong> AuraMusic does not maintain or host a media catalog, centralized database, or media distribution server. All audio queries, catalog discovery, and stream playback chunks are initiated directly from your device to third-party endpoints (such as YouTube Music, Googlevideo CDN, LRCLIB, and Spotify).
                </p>
                <p>
                  AuraMusic acts as an interactive browser/client for publicly accessible endpoints and user-imported local files, similar in operational model to a specialized web browser.
                </p>
              </div>
            </section>

            {/* SECTION 3 */}
            <section id="eligibility" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-[#BF5AF2]" />
                3. Eligibility & Personal License
              </h2>
              <p>
                You represent that you have reached the age of majority in your jurisdiction, or possess valid parental or legal guardian consent to use this Application.
              </p>
              <p>
                Subject to compliance with these Terms, you are granted a non-exclusive, non-transferable, revocable license to install and run the Application on personal Android devices solely for personal, non-commercial entertainment, study, and research purposes.
              </p>
            </section>

            {/* SECTION 4 */}
            <section id="licensing" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Code2 className="w-5 h-5 text-[#46F5E0]" />
                4. Open-Source Software & Intellectual Property
              </h2>
              <p>
                The original source code, architecture, and user interface designs created specifically for the AuraMusic project are developed and maintained in the public repository at <a href="https://github.com/helloabhishek2004/AuraMusic" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] hover:underline">github.com/helloabhishek2004/AuraMusic</a>.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-white/80">
                <li><strong>Application Code:</strong> Governed by the open-source licensing terms specified in the repository's <code className="text-white">LICENSE</code> file.</li>
                <li><strong>Third-Party Libraries:</strong> AuraMusic incorporates open-source components including AndroidX Media3 (Apache 2.0), React Native / Expo (MIT), Room, OkHttp, and Lucide Icons (ISC). All third-party copyrights remain the property of their respective holders.</li>
                <li><strong>Trademarks:</strong> "AuraMusic", the AuraMusic emblem, and custom brand assets belong to the maintainer. "YouTube", "Google", "Spotify", and "Android" are registered trademarks of their respective owners, and no endorsement, sponsorship, or affiliation is implied.</li>
              </ul>
            </section>

            {/* SECTION 5 */}
            <section id="third-party-content" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-[#BF5AF2]" />
                5. Third-Party Services & Media Content Disclaimer
              </h2>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs space-y-2">
                <p className="font-semibold text-white">CRITICAL CONTENT CLARIFICATION:</p>
                <p>
                  AuraMusic <strong>DOES NOT HOST, STORE, DISTRIBUTE, LICENSE, OR SELL</strong> music files, master sound recordings, or musical compositions.
                </p>
                <p>
                  All audio streams, song titles, cover artwork, and lyrics accessed via AuraMusic are retrieved in real-time from external third-party services (such as YouTube, Googlevideo CDN, LRCLIB, and KuGou) or loaded from your own device's internal storage.
                </p>
              </div>
              <p>
                Your interaction with external content providers through AuraMusic is subject to the respective provider's terms and policies:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-white/80">
                <li>YouTube & Google Services: Governed by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] hover:underline">YouTube Terms of Service</a> and Google Terms.</li>
                <li>Spotify Web API: Governed by the <a href="https://www.spotify.com/legal/end-user-agreement/" target="_blank" rel="noopener noreferrer" className="text-[#DAB9FF] hover:underline">Spotify Terms and Conditions</a>.</li>
                <li>Lyrics Providers: LRCLIB and KuGou lyrics databases.</li>
              </ul>
              <p className="text-xs text-white/70">
                AuraMusic has no control over the availability, copyright status, or quality of external streams. External services may alter, restrict, or terminate API access or streaming formats at any time without notice.
              </p>
            </section>

            {/* SECTION 6 */}
            <section id="user-conduct" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Ban className="w-5 h-5 text-[#46F5E0]" />
                6. Acceptable Use & User Conduct
              </h2>
              <p>
                You agree to use AuraMusic in strict compliance with all applicable local, national, and international laws, regulations, and third-party terms. You specifically agree NOT to:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-2">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="font-semibold text-rose-400 block mb-1">Commercial Exploitation:</span>
                  <p className="text-white/70">Re-sell, rent, lease, or commercially exploit audio streams or software binaries without authorization.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="font-semibold text-rose-400 block mb-1">Copyright Infringement:</span>
                  <p className="text-white/70">Use the Application to capture, redistribute, broadcast, or republish copyrighted media in violation of intellectual property laws.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="font-semibold text-rose-400 block mb-1">Denial of Service:</span>
                  <p className="text-white/70">Abuse, overload, or launch automated scraping attacks against upstream content endpoints (YouTube, LRCLIB).</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="font-semibold text-rose-400 block mb-1">Malicious Modification:</span>
                  <p className="text-white/70">Distribute Trojan-infected or malware-packaged forks of AuraMusic misrepresenting them as official builds.</p>
                </div>
              </div>
            </section>

            {/* SECTION 7 */}
            <section id="copyright-dmca" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#BF5AF2]" />
                7. Copyright, DMCA & Notice Procedures
              </h2>
              <p>
                AuraMusic respects the intellectual property rights of creators and copyright owners. Because AuraMusic does not host or store media files on any server, removing content from AuraMusic requires removing it from the origin platform (such as YouTube), which automatically removes it from search and resolution in client applications.
              </p>
              <p>
                If you are a copyright holder and believe that any software asset, repository code, or promotional media in the AuraMusic project infringes your copyright:
              </p>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs space-y-2">
                <p>
                  Please submit a detailed notice containing:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-white/70">
                  <li>Identification of the copyrighted work claimed to be infringed.</li>
                  <li>Identification of the specific repository material claimed to be infringing.</li>
                  <li>Your contact information (name, address, email address, phone number).</li>
                  <li>A statement that you have a good-faith belief that the use is not authorized.</li>
                  <li>A statement under penalty of perjury that the information in your notice is accurate and that you are authorized to act on behalf of the copyright owner.</li>
                </ol>
                <p className="pt-2 text-white/60">
                  Notices can be submitted via the contact channels listed in Section 12 or via GitHub's official DMCA procedure.
                </p>
              </div>
            </section>

            {/* SECTION 8 */}
            <section id="disclaimer-warranties" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-[#46F5E0]" />
                8. Disclaimer of Warranties ("AS IS")
              </h2>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs leading-relaxed space-y-2 uppercase font-mono text-white/80">
                <p>
                  THE APPLICATION AND WEBSITE ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                </p>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE MAINTAINER DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
                </p>
                <p>
                  WE DO NOT WARRANT THAT THE APPLICATION WILL OPERATE ERROR-FREE, UNINTERRUPTED, OR COMPATIBLE WITH EVERY ANDROID DEVICE, OR THAT THIRD-PARTY STREAM ENDPOINTS WILL REMAIN ACCESSIBLE.
                </p>
              </div>
            </section>

            {/* SECTION 9 */}
            <section id="limitation-liability" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-[#BF5AF2]" />
                9. Limitation of Liability
              </h2>
              <p className="text-xs leading-relaxed text-white/70">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE MAINTAINER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
              </p>
            </section>

            {/* SECTION 10 */}
            <section id="service-changes" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Code2 className="w-5 h-5 text-[#46F5E0]" />
                10. Modifications & Termination
              </h2>
              <p>
                The maintainer reserves the right to modify, suspend, or discontinue the Application or Website at any time without notice. We may update these Terms periodically to reflect architectural changes or legal developments. Continued use of AuraMusic after changes are posted constitutes acceptance of the amended Terms.
              </p>
            </section>

            {/* SECTION 11 */}
            <section id="governing-law" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-[#BF5AF2]" />
                11. Governing Law & Jurisdiction
              </h2>
              <p>
                These Terms shall be construed and interpreted in accordance with the laws applicable to open-source personal software projects, without regard to conflict of law principles. If any provision of these Terms is deemed unlawful or unenforceable, that provision shall be severable and shall not affect the validity of remaining provisions.
              </p>
            </section>

            {/* SECTION 12 */}
            <section id="contact" className="scroll-mt-28 space-y-4 pt-6 border-t border-white/[0.08]">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-[#46F5E0]" />
                12. Contact Information
              </h2>
              <p>
                If you have questions regarding these Terms of Service, please contact the maintainer through the official project channels:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                  <span className="text-white/50 uppercase font-mono tracking-wider text-[10px]">Project Repository</span>
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
                    Track architectural discussions, release updates, and license notices.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                  <span className="text-white/50 uppercase font-mono tracking-wider text-[10px]">Maintainer Communication</span>
                  <div className="font-medium text-white flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#46F5E0]" />
                    <span className="text-white">abhishekdq2004@gmail.com</span>
                  </div>
                  <p className="text-white/60 text-[11px]">
                    [Maintainer Contact — Inquiries & Responsible Notices]
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
              onClick={onNavigatePrivacy}
              className="text-white/70 hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
          </div>
          <div>
            © 2026 AuraMusic Project • Source-Available Client
          </div>
        </div>
      </div>
    </div>
  );
};
