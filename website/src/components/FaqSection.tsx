import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, ShieldCheck, Zap, Download, Music2, Smartphone, Radio } from 'lucide-react';
import { AuraChip } from './AuraChip';
import BlurText from './BlurText';

interface FaqItem {
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    question: 'Is AuraMusic completely free to use?',
    answer: 'Yes. AuraMusic is 100% free with no subscription plans, no paywalled features, and no in-app purchases. You can download the universal APK and access full playback capabilities immediately.',
    icon: <Zap size={18} className="text-[#46F5E0]" />
  },
  {
    question: 'Does AuraMusic display any advertisements?',
    answer: 'No. AuraMusic contains zero advertisements. There are no banner ads, video popups, audio sponsor interruptions between tracks, or third-party ad networks embedded in the player.',
    icon: <ShieldCheck size={18} className="text-[#BF5AF2]" />
  },
  {
    question: 'Can I listen to music offline without an internet connection?',
    answer: 'Yes. AuraMusic features dedicated offline listening. You can download tracks and albums with high-fidelity audio and embedded cover art directly into local storage, enabling continuous offline playback on planes, commutes, or in areas without signal.',
    icon: <Download size={18} className="text-[#DAB9FF]" />
  },
  {
    question: 'Can AuraMusic play local music files stored on my Android phone?',
    answer: 'Yes. AuraMusic scans and organizes local audio files (including MP3, FLAC, AAC, and WAV) from your device storage through Android MediaStore, allowing you to seamlessly play personal files alongside saved tracks.',
    icon: <Music2 size={18} className="text-[#46F5E0]" />
  },
  {
    question: 'Where can I safely download the official AuraMusic APK?',
    answer: 'The official signed release is distributed exclusively through the developer GitHub repository at github.com/helloabhishek2004/AuraMusic/releases. The primary build is AuraMusic-v2.0.0-universal.apk (110.2 MB). Never download AuraMusic APKs from untrusted third-party mirror portals.',
    icon: <Smartphone size={18} className="text-[#BF5AF2]" />
  },
  {
    question: 'Which Android versions and devices are supported?',
    answer: 'AuraMusic requires Android 7.0 (Nougat / API level 24) or higher. It is built and physically tested on Android 14 hardware, targeting SDK 36, and is compatible with modern ARM64, ARMv7, and x86_64 Android smartphones and tablets.',
    icon: <Radio size={18} className="text-[#DAB9FF]" />
  },
  {
    question: 'Is AuraMusic open source?',
    answer: 'AuraMusic is developed and maintained by Abhishek as a source-available project. The entire codebase is publicly viewable on GitHub at helloabhishek2004/AuraMusic for complete architectural transparency, security inspection, and community issue tracking.',
    icon: <HelpCircle size={18} className="text-[#46F5E0]" />
  }
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleIndex = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <section id="faq" className="relative py-16 sm:py-24 px-3 sm:px-6 md:px-12 max-w-[1100px] mx-auto">
      {/* Background radial accent */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[250px] sm:h-[350px] rounded-full opacity-15 blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #BF5AF2 0%, #46F5E0 70%, transparent 85%)' }}
      />

      <div className="relative text-center mb-10 sm:mb-14">
        <div className="inline-block mb-3">
          <AuraChip
            size="sm"
            variant="violet"
            icon={<HelpCircle size={13} strokeWidth={1.8} />}
            label="Answers & Information"
          />
        </div>
        <BlurText
          text="Frequently Asked Questions"
          as="h2"
          className="font-display font-extrabold text-2xl sm:text-4xl md:text-5xl text-white tracking-tight leading-[1.15] justify-center"
          scrollDriven
          direction="bottom"
        />
        <p className="mt-3 sm:mt-4 text-sm sm:text-base text-white/60 max-w-xl mx-auto font-body">
          Everything you need to know about AuraMusic’s playback engine, offline capabilities, ad-free architecture, and APK installation.
        </p>
      </div>

      <div className="space-y-3.5 relative z-10">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`rounded-[20px] sm:rounded-[24px] border transition-all duration-300 overflow-hidden ${
                isOpen
                  ? 'bg-[#0E0C18]/90 border-white/[0.14] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.8)]'
                  : 'bg-[#0A0912]/60 border-white/[0.06] hover:border-white/[0.1] hover:bg-[#0C0B14]/75'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleIndex(idx)}
                className="w-full py-4 sm:py-5 px-5 sm:px-7 flex items-center justify-between text-left gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BF5AF2]/50"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                    {faq.icon}
                  </div>
                  <span className="font-display font-semibold text-base sm:text-lg text-white">
                    {faq.question}
                  </span>
                </div>
                <div
                  className={`w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 bg-[#BF5AF2]/20 text-[#DAB9FF]' : 'text-white/40'
                  }`}
                >
                  <ChevronDown size={16} strokeWidth={2} />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="px-5 sm:px-7 pb-5 sm:pb-6 pt-1 text-sm sm:text-base text-white/70 leading-relaxed font-body border-t border-white/[0.04] ml-11 sm:ml-12">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FaqSection;
