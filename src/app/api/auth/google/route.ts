import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-oauth";

/**
 * GET /api/auth/google — OAuth 認証開始。Google 同意画面へリダイレクト
 */
export async function GET(request: NextRequest) {
  try {
    const returnTo = request.nextUrl.searchParams.get("returnTo") || "/settings";
    const authUrl = getAuthUrl(returnTo);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[Google OAuth] Auth start failed:", error);
    return NextResponse.redirect(
      new URL("/settings?error=google_auth_failed", request.url),
    );
  }
}
