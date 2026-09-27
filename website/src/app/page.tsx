import { Metadata } from "next";
import { getLatestAuraRelease } from "@/lib/release";
import { getBaseUrl } from "@/lib/siteUrl";
import HomePageClient from "@/components/HomePageClient";

export const revalidate = 300; // 5 minutes ISR cache

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const release = await getLatestAuraRelease();
  const title = `AuraMusic ${release.displayVersion} – Free, Ad-Free Android Music Player`;
  const description = `Download AuraMusic ${release.displayVersion} APK (${release.primaryApk?.sizeFormatted || "110.2 MB"}). Free, ad-free Android music player with native AndroidX Media3 playback, offline caching, and live synced lyrics.`;

  return {
    title,
    description,
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      title: `AuraMusic ${release.displayVersion} – Free, Ad-Free Android Music Player`,
      description: `Download the latest official AuraMusic ${release.displayVersion} APK with native Media3 playback, synchronized lyrics, offline caching, and Liquid Glass UI.`,
      url: baseUrl,
      siteName: "AuraMusic",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `AuraMusic ${release.displayVersion} – Free, Ad-Free Android Music Player`,
      description: `Download the latest official AuraMusic ${release.displayVersion} APK with native Media3 playback, synchronized lyrics, offline caching, and Liquid Glass UI.`,
    },
  };
}

export default async function Home() {
  const baseUrl = getBaseUrl();
  const release = await getLatestAuraRelease();

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${baseUrl}/#software`,
        name: "AuraMusic",
        operatingSystem: "Android 7.0+",
        applicationCategory: "MultimediaApplication",
        applicationSubCategory: "AudioApplication",
        softwareVersion: release.version,
        fileSize: release.primaryApk?.sizeFormatted || "110.2 MB",
        downloadUrl:
          release.primaryApk?.downloadUrl ||
          `https://github.com/helloabhishek2004/AuraMusic/releases/download/${release.tag}/AuraMusic-${release.tag}-universal.apk`,
        datePublished: release.publishedAt,
        codeRepository: "https://github.com/helloabhishek2004/AuraMusic",
        description:
          "Android music player with native AndroidX Media3 playback, on-device stream resolution, live synchronized lyrics, offline caching, and Liquid Glass design.",
        screenshot: [
          `${baseUrl}/screenshots/1.jpg`,
          `${baseUrl}/screenshots/2.jpg`,
          `${baseUrl}/screenshots/3.jpg`,
          `${baseUrl}/screenshots/4.jpg`,
          `${baseUrl}/screenshots/5.jpg`,
          `${baseUrl}/screenshots/6.jpg`,
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        author: {
          "@type": "Person",
          name: "Abhishek",
          url: "https://github.com/helloabhishek2004",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: "AuraMusic",
        description:
          "Official website and download portal for AuraMusic, an Android music player with native Media3 playback.",
        publisher: {
          "@type": "Person",
          name: "Abhishek",
          url: "https://github.com/helloabhishek2004",
        },
      },
      {
        "@type": "WebPage",
        "@id": `${baseUrl}/#webpage`,
        url: baseUrl,
        name: "AuraMusic – Free, Ad-Free Android Music Player",
        isPartOf: {
          "@id": `${baseUrl}/#website`,
        },
        about: {
          "@id": `${baseUrl}/#software`,
        },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: baseUrl,
            },
          ],
        },
      },
      {
        "@type": "Person",
        "@id": `${baseUrl}/#author`,
        name: "Abhishek",
        url: "https://github.com/helloabhishek2004",
        sameAs: [
          "https://github.com/helloabhishek2004",
          "https://github.com/helloabhishek2004/AuraMusic",
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomePageClient release={release} />
    </>
  );
}
