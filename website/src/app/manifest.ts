import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AuraMusic - Android Music Player",
    short_name: "AuraMusic",
    description:
      "A modern Android music player featuring native AndroidX Media3 playback, live synced lyrics, and Liquid Glass design.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#f97316",
    icons: [
      {
        src: "/app-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
