import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, saveTokens } from "@/lib/google-oauth";

/**
 * GET /api/auth/google/callback — Google OAuth コールバック処理
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const rawState = request.nextUrl.searchParams.get("state") || "/settings";
  // オープンリダイレクト防止: 相対パスのみ許可
  const state = rawState.startsWith("/") ? rawState : "/settings";

  if (!code) {
    console.error("[Google OAuth] Callback missing code parameter");
    return NextResponse.redirect(
      new URL("/settings?error=google_auth_failed", request.url),
    );
  }

  try {
    const { refreshToken, email } = await exchangeCode(code);
    await saveTokens(refreshToken, email);
    return NextResponse.redirect(new URL(state, request.url));
  } catch (error) {
    console.error("[Google OAuth] Callback failed:", error);
    return NextResponse.redirect(
      new URL("/settings?error=google_auth_failed", request.url),
    );
  }
}
