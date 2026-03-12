import { NextResponse } from "next/server";
import { verifyConnection } from "@/lib/notion";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/notion/settings/test — Notion接続テスト
 */
export async function POST() {
  if (!process.env.NOTION_TOKEN) {
    return NextResponse.json(
      { connected: false, error: "NOTION_TOKEN環境変数が設定されていません" },
      { status: 400 },
    );
  }

  const { data } = await supabase
    .from("review_settings")
    .select("value")
    .eq("key", "notion_database_id")
    .single();

  const databaseId = data?.value;
  if (!databaseId) {
    return NextResponse.json(
      { connected: false, error: "NotionデータベースIDが設定されていません" },
      { status: 400 },
    );
  }

  const connected = await verifyConnection(databaseId);
  if (!connected) {
    return NextResponse.json(
      {
        connected: false,
        error:
          "Notionデータベースに接続できませんでした。インテグレーションの接続を確認してください",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ connected: true });
}
