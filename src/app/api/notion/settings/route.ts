import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyConnection } from "@/lib/notion";

/**
 * GET /api/notion/settings — Notion設定取得
 */
export async function GET() {
  const { data, error } = await supabase
    .from("review_settings")
    .select("key, value")
    .eq("key", "notion_database_id")
    .single();

  if (error) {
    return NextResponse.json(
      { notion_database_id: "", is_configured: false },
      { status: 200 },
    );
  }

  const notionDatabaseId = data?.value || "";
  const hasToken = !!process.env.NOTION_TOKEN;
  const isConfigured = hasToken && notionDatabaseId !== "";

  return NextResponse.json({
    notion_database_id: notionDatabaseId,
    is_configured: isConfigured,
  });
}

/**
 * PATCH /api/notion/settings — NotionデータベースID更新
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const databaseId = body.notion_database_id;

  if (databaseId === undefined) {
    return NextResponse.json(
      { error: "notion_database_id is required" },
      { status: 400 },
    );
  }

  // 空文字の場合は設定クリア
  if (databaseId === "") {
    const { error } = await supabase
      .from("review_settings")
      .update({ value: "", updated_at: new Date().toISOString() })
      .eq("key", "notion_database_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // 接続検証
  const connected = await verifyConnection(databaseId);
  if (!connected) {
    return NextResponse.json(
      {
        error:
          "NotionデータベースIDが無効です。インテグレーションの接続を確認してください",
      },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("review_settings")
    .update({ value: databaseId, updated_at: new Date().toISOString() })
    .eq("key", "notion_database_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
