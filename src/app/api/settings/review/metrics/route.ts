import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/settings/review/metrics — スコアリング精度メトリクスを取得
 */
export async function GET() {
  // 全フィードバックデータを取得
  const { data: feedback, error } = await supabase
    .from("scoring_feedback")
    .select("ai_score, user_action, is_correct");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!feedback || feedback.length === 0) {
    return NextResponse.json({
      total_reviews: 0,
      score_gap: null,
      accuracy: null,
      precision_at_10: null,
      avg_approved_score: null,
      avg_skipped_score: null,
    });
  }

  // 承認・スキップ別の平均スコア
  const approved = feedback.filter((f) => f.user_action === "approve");
  const skipped = feedback.filter((f) => f.user_action === "skip");

  const avgApprovedScore =
    approved.length > 0
      ? approved.reduce((sum, f) => sum + f.ai_score, 0) / approved.length
      : null;
  const avgSkippedScore =
    skipped.length > 0
      ? skipped.reduce((sum, f) => sum + f.ai_score, 0) / skipped.length
      : null;

  // scoreGap: 承認論文と棄却論文の平均スコア差
  const scoreGap =
    avgApprovedScore !== null && avgSkippedScore !== null
      ? Math.round(avgApprovedScore - avgSkippedScore)
      : null;

  // 正解率
  const correctCount = feedback.filter((f) => f.is_correct).length;
  const accuracy = Math.round((correctCount / feedback.length) * 100);

  // Precision@10: スコア上位10件中の承認率
  const sorted = [...feedback].sort((a, b) => b.ai_score - a.ai_score);
  const top10 = sorted.slice(0, 10);
  const top10Approved = top10.filter((f) => f.user_action === "approve").length;
  const precisionAt10 =
    top10.length > 0 ? Math.round((top10Approved / top10.length) * 100) : null;

  return NextResponse.json({
    total_reviews: feedback.length,
    score_gap: scoreGap,
    accuracy,
    precision_at_10: precisionAt10,
    avg_approved_score:
      avgApprovedScore !== null ? Math.round(avgApprovedScore) : null,
    avg_skipped_score:
      avgSkippedScore !== null ? Math.round(avgSkippedScore) : null,
  });
}
