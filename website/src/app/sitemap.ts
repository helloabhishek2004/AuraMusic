import type { MetadataRoute } from "next";
import { getLatestAuraRelease } from "@/lib/release";
import { getBaseUrl } from "@/lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  let releaseDate = new Date();
  try {
    const release = await getLatestAuraRelease();
    if (release.publishedAt) {
      releaseDate = new Date(release.publishedAt);
    }
  } catch {
    // Fallback to current date
  }

  return [
    {
      url: baseUrl,
      lastModified: releaseDate,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: releaseDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/offline-music-player`,
      lastModified: releaseDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ad-free-music-player`,
      lastModified: releaseDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/youtube-music-alternative`,
      lastModified: releaseDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: releaseDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-09-26T00:00:00.000Z"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2026-09-26T00:00:00.000Z"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
