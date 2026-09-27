export interface HistoricalRelease {
  version: string;
  build: string;
  date: string;
  changes: string[];
  compareUrl: string;
}

export const HISTORICAL_RELEASES: HistoricalRelease[] = [
  {
    version: "v2.0.0",
    build: "V2 Release",
    date: "September 20, 2026",
    changes: [
      "Native Media3 playback with improved caching and reliable offline playback",
      "Like/unlike directly from Android notification and lock screen controls",
      "More reliable downloads with complete song and album metadata",
      "Refined Liquid Glass navigation and atmospheric player experience",
      "Improved Library and downloaded-music management",
      "Improved lyrics synchronization when changing tracks",
      "Proper multi-artist metadata preservation",
      "Improved music discovery and search interaction",
      "Improved local Room database migrations and metadata persistence",
      "Reliable offline playback for downloaded music",
      "Added in-app Privacy Policy and FAQ",
      "Faster startup and smoother navigation across all views",
    ],
    compareUrl:
      "https://github.com/helloabhishek2004/AuraMusic/releases/tag/v2.0.0",
  },
  {
    version: "v0.1.0-beta.1",
    build: "Public Beta",
    date: "September 4, 2026",
    changes: [
      "Initial public beta release of AuraMusic Android music player",
      "Native AndroidX Media3 / ExoPlayer hardware decode audio engine",
      "Direct on-device InnerTube stream resolution without intermediate proxies",
      "Signature Liquid Glass design language with atmospheric dynamic gradients",
      "Synchronized LRC lyrics integration with LRCLIB & KuGou providers",
      "Background playback with lock screen and notification media session controls",
      "Local-first SQLite state persistence powered by AndroidX Room",
    ],
    compareUrl:
      "https://github.com/helloabhishek2004/AuraMusic/releases/tag/v0.1.0-beta.1",
  },
];
