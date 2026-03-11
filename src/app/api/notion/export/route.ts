import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { exportPaperToNotion } from "@/lib/notion";
import type { Paper } from "@/types/database";

/**
 * POST /api/notion/export — 論文をNotionにエクスポート
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const paperId = body.paper_id;

  if (!paperId) {
    return NextResponse.json(
      { error: "paper_id is required" },
      { status: 400 },
    );
  }

  // 論文を取得
  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .select("*")
    .eq("id", paperId)
    .single();

  if (paperError || !paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Notion設定を取得
  const { data: setting } = await supabase
    .from("review_settings")
    .select("value")
    .eq("key", "notion_database_id")
    .single();

  const databaseId = setting?.value;
  if (!databaseId || !process.env.NOTION_TOKEN) {
    return NextResponse.json(
      { error: "Notion is not configured" },
      { status: 400 },
    );
  }

  // Notionにエクスポート
  try {
    const result = await exportPaperToNotion(paper as Paper, databaseId);

    // papersテーブルを更新
    const { error: updateError } = await supabase
      .from("papers")
      .update({
        notion_page_id: result.page_id,
        notion_page_url: result.page_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paperId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save Notion page info" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      notion_page_id: result.page_id,
      notion_page_url: result.page_url,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to export to Notion" },
      { status: 500 },
    );
  }
}
