import { NextResponse } from "next/server";
import { getLatestAuraRelease, getAllAuraReleases } from "@/lib/release";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const getAll = searchParams.get("all") === "true";

    if (getAll) {
      const releases = await getAllAuraReleases();
      return NextResponse.json(
        {
          success: true,
          count: releases.length,
          releases,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    const latest = await getLatestAuraRelease();
    return NextResponse.json(
      {
        success: true,
        release: latest,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[api/release] Error handling request:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch release information",
      },
      { status: 500 }
    );
  }
}
