import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import {
  ArrowLeft,
  Scale,
  ShieldCheck,
  Cpu,
  Globe,
  Code2,
  AlertCircle,
  Ban,
  FileText,
  Mail,
  CheckCircle2,
} from "lucide-react";

import { getBaseUrl } from "@/lib/siteUrl";

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing the use of the AuraMusic Android application and official website.",
  alternates: {
    canonical: `${baseUrl}/terms`,
  },
  openGraph: {
    title: "AuraMusic — Terms of Service",
    description:
      "Terms governing the use of the AuraMusic Android application and official website.",
    url: `${baseUrl}/terms`,
    siteName: "AuraMusic",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraMusic — Terms of Service",
    description:
      "Terms governing the use of the AuraMusic Android application and official website.",
  },
};

const sections = [
  {
    icon: ShieldCheck,
    title: "1. Acceptance of Terms",
    content:
      "By installing, copying, or utilizing the AuraMusic Android application or browsing this website, you agree to be bound by these Terms of Service. If you do not agree, do not install or use the application or website. These Terms represent an agreement between you and the project maintainer, Abhishek (@bh!shek).",
  },
  {
    icon: Cpu,
    title: "2. Description of Application & Architecture",
    content:
      "AuraMusic is an independent audio player interface. It does not operate or maintain a media distribution server, central music library, or proxy service. All audio streaming chunks and search metadata are fetched directly from external third-party providers (such as YouTube Music, Googlevideo CDN, and LRCLIB) or played from your local device storage. AuraMusic acts solely as a specialized client interface.",
  },
  {
    icon: Globe,
    title: "3. Eligibility & Personal License",
    content:
      "You are granted a revocable, non-exclusive, non-transferable personal license to install and run the application on your personal devices for lawful, non-commercial educational, research, and entertainment use.",
  },
  {
    icon: Code2,
    title: "4. Software Repository & Intellectual Property",
    content:
      "AuraMusic application source code is maintained publicly at github.com/helloabhishek2004/AuraMusic. A formal open-source license has not yet been selected in the repository; all rights are reserved by the original author and contributors pending formal license selection. Third-party components and libraries (including AndroidX Media3, React Native, and ExoPlayer) are the property of their respective copyright holders.",
  },
  {
    icon: AlertCircle,
    title: "5. Third-Party Services & Media Content Disclaimer",
    content:
      "AuraMusic DOES NOT HOST, STORE, DISTRIBUTE, LICENSE, OR SELL copyrighted media files. All sound recordings, music videos, and album art accessed via AuraMusic are streamed directly from third-party networks (such as YouTube) under the user's direction. Your access to external services remains subject to those platforms' respective terms of service (including the YouTube Terms of Service and Spotify Terms).",
  },
  {
    icon: Ban,
    title: "6. Acceptable Use & User Conduct",
    content:
      "You agree not to use AuraMusic to infringe intellectual property rights, commercially re-sell streams, launch denial-of-service attacks against content providers, or distribute malicious modifications of the application.",
  },
  {
    icon: FileText,
    title: "7. Copyright & DMCA Notice Procedures",
    content:
      "AuraMusic does not store user-generated content or host media on servers. If you are a copyright holder with inquiries regarding repository code or application assets, please contact our maintainer channel or submit an inquiry through official GitHub advisory channels.",
  },
  {
    icon: Scale,
    title: "8. Disclaimer of Warranties",
    content:
      "THE APPLICATION AND WEBSITE ARE PROVIDED 'AS IS' AND 'AS AVAILABLE' WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED AVAILABILITY OR ACCESSIBILITY OF THIRD-PARTY STREAM ENDPOINTS.",
  },
  {
    icon: AlertCircle,
    title: "9. Limitation of Liability",
    content:
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE MAINTAINER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OF OR INABILITY TO USE THIS APPLICATION.",
  },
  {
    icon: Mail,
    title: "10. Contact Information",
    content:
      "Questions regarding these Terms may be directed via our GitHub repository at github.com/helloabhishek2004/AuraMusic or via official GitHub issues.",
  },
];

export default function TermsPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Terms of Service",
        item: `${baseUrl}/terms`,
      },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-purple-500/30 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Skip Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 border-b border-zinc-800/80 backdrop-blur-md bg-zinc-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              aria-label="Back to AuraMusic home page"
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors py-2"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Back to Home
            </Link>
            <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <Image
                src="/app-icon.png"
                alt=""
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-white">AuraMusic</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/privacy"
              className="text-purple-400 hover:text-purple-300 transition-colors py-2"
            >
              Privacy Policy →
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-grow py-12 sm:py-16 focus:outline-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Scale aria-hidden="true" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Terms of Service
              </h1>
              <p className="text-xs font-mono text-zinc-400 mt-1">
                Effective: September 26, 2026 • Last Updated: September 26, 2026
              </p>
            </div>
          </div>

          <div className="my-8 p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-1">Client Application Notice:</strong>
              AuraMusic is an independent client interface developed for personal study, research, and lawful audio playback. AuraMusic does not host or license copyrighted media files.
            </div>
          </div>

          <div className="space-y-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  key={section.title}
                  className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80"
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <Icon aria-hidden="true" className="w-4 h-4 text-purple-400" />
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <Link
              href="/"
              aria-label="Back to AuraMusic home page"
              className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-medium py-2"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              Back to Home
            </Link>
            <Link
              href="/privacy"
              className="hover:text-zinc-300 transition-colors py-2"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
