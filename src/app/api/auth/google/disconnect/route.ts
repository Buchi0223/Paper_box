import { NextResponse } from "next/server";
import { revokeAndClear } from "@/lib/google-oauth";

/**
 * POST /api/auth/google/disconnect — Google Drive 接続を解除
 */
export async function POST() {
  try {
    await revokeAndClear();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Google OAuth] Disconnect failed:", error);
    const message =
      error instanceof Error ? error.message : "切断に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
