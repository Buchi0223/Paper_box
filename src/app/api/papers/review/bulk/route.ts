import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/papers/review/bulk — 一括レビュー操作
 *
 * action:
 *   - "approve_all_auto": min_score 以上の pending 論文を一括承認
 *   - "skip_all_auto": max_score 以下の pending 論文を一括スキップ
 *   - "skip_all_auto_skipped": auto_skipped 論文を一括スキップ
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, min_score, max_score } = body;

  if (!action) {
    return NextResponse.json(
      { error: "action は必須です" },
      { status: 400 },
    );
  }

  switch (action) {
    case "approve_all_auto": {
      const threshold = min_score ?? 70;

      const { data, error } = await supabase
        .from("papers")
        .update({ review_status: "approved" })
        .eq("review_status", "pending")
        .gte("relevance_score", threshold)
        .select("id");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "approve_all_auto",
        affected_count: data?.length ?? 0,
      });
    }

    case "skip_all_auto": {
      const threshold = max_score ?? 30;

      const { data, error } = await supabase
        .from("papers")
        .update({ review_status: "skipped" })
        .eq("review_status", "pending")
        .lte("relevance_score", threshold)
        .select("id");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "skip_all_auto",
        affected_count: data?.length ?? 0,
      });
    }

    case "skip_all_auto_skipped": {
      const { data, error } = await supabase
        .from("papers")
        .update({ review_status: "skipped" })
        .eq("review_status", "auto_skipped")
        .select("id");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "skip_all_auto_skipped",
        affected_count: data?.length ?? 0,
      });
    }

    default:
      return NextResponse.json(
        {
          error:
            "action は 'approve_all_auto', 'skip_all_auto', 'skip_all_auto_skipped' のいずれかを指定してください",
        },
        { status: 400 },
      );
  }
}
