import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // If client ID is missing, we simulate a mock OAuth flow for local development / testing
  if (!clientId) {
    console.warn("STRAVA_CLIENT_ID not set. Redirecting to mock callback for local testing.");
    const mockRedirectUrl = `${baseUrl}/api/strava/callback?code=mock_code_123&state=${userId}&mock=true`;
    return NextResponse.redirect(mockRedirectUrl);
  }

  const redirectUri = `${baseUrl}/api/strava/callback`;
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=activity:read_all&state=${userId}`;

  return NextResponse.redirect(stravaAuthUrl);
}
