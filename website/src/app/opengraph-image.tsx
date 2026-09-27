import { ImageResponse } from "next/og";
import { getLatestAuraRelease } from "@/lib/release";

export const alt = "AuraMusic – Android Music Player with Native Media3";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  let version = "v2.0.0";
  try {
    const release = await getLatestAuraRelease();
    if (release.displayVersion) {
      version = release.displayVersion;
    }
  } catch {
    // fallback
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 20% 25%, rgba(249, 115, 22, 0.22), transparent 45%), radial-gradient(circle at 80% 75%, rgba(236, 72, 153, 0.22), transparent 45%)",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Subtle border outline */}
        <div
          style={{
            position: "absolute",
            inset: "20px",
            borderRadius: "28px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
          }}
        />

        {/* Top badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 20px",
            borderRadius: "9999px",
            backgroundColor: "rgba(249, 115, 22, 0.15)",
            border: "1px solid rgba(249, 115, 22, 0.35)",
            color: "#fb923c",
            fontSize: "20px",
            fontWeight: 600,
            marginBottom: "28px",
          }}
        >
          <span>Official Android Client</span>
          <span style={{ color: "#71717a" }}>•</span>
          <span>{version}</span>
        </div>

        {/* Main Logo & Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "20px",
          }}
        >
          {/* Logo icon representation */}
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "22px",
              background: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 32px rgba(249, 115, 22, 0.35)",
            }}
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: "76px",
              fontWeight: 800,
              letterSpacing: "-2px",
              margin: 0,
              background: "linear-gradient(to right, #ffffff, #e4e4e7)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            AuraMusic
          </h1>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: "30px",
            color: "#a1a1aa",
            textAlign: "center",
            maxWidth: "880px",
            lineHeight: 1.35,
            margin: "0 0 40px 0",
          }}
        >
          Android-First Music Player with Native Media3
        </p>

        {/* Feature Pills */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            "Native Media3 Core",
            "On-Device Stream Resolution",
            "Synced Live Lyrics",
            "Liquid Glass UI",
            "Offline Caching",
          ].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 18px",
                borderRadius: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#e4e4e7",
                fontSize: "18px",
                fontWeight: 500,
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Bottom domain indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            fontSize: "18px",
            color: "#71717a",
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        >
          auramusic.site
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
