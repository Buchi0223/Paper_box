import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-oauth";

/**
 * GET /api/auth/google — OAuth 認証開始。Google 同意画面へリダイレクト
 */
export async function GET(request: NextRequest) {
  try {
    const rawReturnTo = request.nextUrl.searchParams.get("returnTo") || "/settings";
    // オープンリダイレクト防止: 相対パスのみ許可
    const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/settings";
    const authUrl = getAuthUrl(returnTo);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[Google OAuth] Auth start failed:", error);
    return NextResponse.redirect(
      new URL("/settings?error=google_auth_failed", request.url),
    );
  }
}
