import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/settings/review — スコアリング設定取得
 */
export async function GET() {
  const { data, error } = await supabase
    .from("review_settings")
    .select("key, value");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings: Record<string, string | number | boolean> = {};
  for (const row of data || []) {
    switch (row.key) {
      case "auto_approve_threshold":
      case "auto_skip_threshold":
        settings[row.key] = parseInt(row.value) || 0;
        break;
      case "scoring_enabled":
        settings[row.key] = row.value === "true";
        break;
      default:
        settings[row.key] = row.value;
    }
  }

  return NextResponse.json(settings);
}

/**
 * PATCH /api/settings/review — スコアリング設定更新
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  const allowedKeys = [
    "auto_approve_threshold",
    "auto_skip_threshold",
    "scoring_enabled",
  ];

  const updates: { key: string; value: string }[] = [];

  for (const key of allowedKeys) {
    if (body[key] !== undefined) {
      updates.push({ key, value: String(body[key]) });
    }
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "更新するフィールドがありません" },
      { status: 400 },
    );
  }

  for (const { key, value } of updates) {
    const { error } = await supabase
      .from("review_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 更新後の設定を返す
  const { data } = await supabase
    .from("review_settings")
    .select("key, value");

  const settings: Record<string, string | number | boolean> = {};
  for (const row of data || []) {
    switch (row.key) {
      case "auto_approve_threshold":
      case "auto_skip_threshold":
        settings[row.key] = parseInt(row.value) || 0;
        break;
      case "scoring_enabled":
        settings[row.key] = row.value === "true";
        break;
      default:
        settings[row.key] = row.value;
    }
  }

  return NextResponse.json(settings);
}
