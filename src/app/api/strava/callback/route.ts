import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // state holds our userId
  const isMock = searchParams.get("mock") === "true" || !process.env.STRAVA_CLIENT_SECRET;

  if (!code || !userId) {
    return NextResponse.json({ error: "Authorization code and state are required" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    if (isMock) {
      // Mock exchange
      await prisma.user.update({
        where: { id: userId },
        data: {
          stravaAccessToken: "mock_access_token_abc123",
          stravaRefreshToken: "mock_refresh_token_xyz789",
          stravaExpiresAt: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 hours
          stravaAthleteId: "mock_athlete_9999",
        },
      });

      return NextResponse.redirect(`${baseUrl}/?userId=${userId}&connected=strava-mock`);
    }

    // Real exchange
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    const data = await res.json();

    if (data.errors || !data.access_token) {
      console.error("Strava token exchange failed:", data);
      return NextResponse.json({ error: "Failed to exchange token with Strava" }, { status: 500 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        stravaAccessToken: data.access_token,
        stravaRefreshToken: data.refresh_token,
        stravaExpiresAt: data.expires_at,
        stravaAthleteId: String(data.athlete.id),
      },
    });

    return NextResponse.redirect(`${baseUrl}/?userId=${userId}&connected=strava`);
  } catch (error: any) {
    console.error("Error in Strava callback:", error);
    return NextResponse.json({ error: "Internal server error during Strava authentication" }, { status: 500 });
  }
}
