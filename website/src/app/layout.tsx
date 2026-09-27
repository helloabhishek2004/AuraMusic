import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getBaseUrl } from "@/lib/siteUrl";
import "./globals.css";

const baseUrl = getBaseUrl();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "AuraMusic – Android Music Player with Native Media3",
    template: "%s – AuraMusic",
  },
  description:
    "A free, ad-free Android music player featuring native AndroidX Media3 playback, on-device stream resolution, live synced lyrics, offline caching, and Liquid Glass design.",
  applicationName: "AuraMusic",
  authors: [{ name: "Abhishek", url: "https://github.com/helloabhishek2004" }],
  creator: "Abhishek",
  publisher: "Abhishek",
  category: "music",
  keywords: [
    "AuraMusic",
    "Android music player",
    "free music player Android",
    "ad-free music player",
    "offline music player Android",
    "free offline music app",
    "Media3",
    "ExoPlayer",
    "live synced lyrics",
    "Liquid Glass",
    "background playback",
    "YouTube Music alternative",
  ],
  alternates: {
    canonical: baseUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/app-icon.png",
    apple: "/app-icon.png",
  },
  openGraph: {
    title: "AuraMusic – Android Music Player with Native Media3",
    description:
      "Experience Android music playback with native AndroidX Media3, synchronized lyrics, offline caching, and Liquid Glass design.",
    url: baseUrl,
    siteName: "AuraMusic",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraMusic – Android Music Player with Native Media3",
    description:
      "Experience Android music playback with native AndroidX Media3, synchronized lyrics, offline caching, and Liquid Glass design.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("auramusic-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark")}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
