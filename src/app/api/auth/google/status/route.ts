import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/auth/google/status — Google Drive 接続状態を返す
 */
export async function GET() {
  const { data, error } = await supabase
    .from("review_settings")
    .select("key, value")
    .in("key", ["google_drive_refresh_token", "google_drive_email"]);

  if (error) {
    return NextResponse.json({ connected: false, email: null });
  }

  const tokenRow = data?.find((r) => r.key === "google_drive_refresh_token");
  const emailRow = data?.find((r) => r.key === "google_drive_email");

  const connected = !!tokenRow?.value;
  const email = emailRow?.value || null;

  return NextResponse.json({ connected, email });
}
