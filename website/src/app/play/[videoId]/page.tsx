import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/siteUrl";
import PlayPageClient from "./PlayPageClient";

type Props = {
  params: Promise<{ videoId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const { videoId } = await params;
  const songUrl = `${baseUrl}/play/${videoId}`;
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    title: "Listen on AuraMusic",
    description:
      "Someone shared a song with you! Tap to listen on AuraMusic – an Android music player with native Media3 playback.",
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: songUrl,
    },
    openGraph: {
      title: "🎵 Listen on AuraMusic",
      description:
        "Tap to play this song in AuraMusic – Android music player with native Media3 playback, lyrics & offline caching.",
      url: songUrl,
      siteName: "AuraMusic",
      type: "website",
      images: [
        {
          url: thumbnailUrl,
          width: 480,
          height: 360,
          alt: "Song thumbnail",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "🎵 Listen on AuraMusic",
      description:
        "Tap to play this song in AuraMusic – Android music player with native Media3 playback, lyrics & offline caching.",
      images: [thumbnailUrl],
    },
    other: {
      "og:image": thumbnailUrl,
    },
  };
}

export default async function PlaySongPage({ params }: Props) {
  const { videoId } = await params;
  return <PlayPageClient videoId={videoId} />;
}
