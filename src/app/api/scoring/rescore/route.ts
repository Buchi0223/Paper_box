import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  scoreRelevance,
  determineReviewStatus,
  getReviewSettings,
} from "@/lib/scoring";

/**
 * POST /api/scoring/rescore — 既存論文を再スコアリング
 * pending 状態の論文のスコアを再計算する
 */
export async function POST() {
  // 関心プロファイルを取得
  const settings = await getReviewSettings();
  if (!settings.scoring_enabled) {
    return NextResponse.json(
      { error: "スコアリングが無効です" },
      { status: 400 },
    );
  }

  const { data: interests } = await supabase
    .from("interests")
    .select("label, weight");

  if (!interests || interests.length === 0) {
    return NextResponse.json(
      { error: "関心プロファイルが空です。先に関心キーワードを登録してください" },
      { status: 400 },
    );
  }

  // pending 状態の論文を取得（最大50件）
  const { data: papers, error } = await supabase
    .from("papers")
    .select("id, title_original, title_ja, authors, abstract, summary_ja, relevance_score")
    .eq("review_status", "pending")
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!papers || papers.length === 0) {
    return NextResponse.json({
      message: "再スコアリング対象の論文がありません",
      rescored: 0,
    });
  }

  let rescored = 0;
  let errors = 0;
  const results: { title: string; old_score: number | null; new_score: number }[] = [];

  for (const paper of papers) {
    try {
      const newScore = await scoreRelevance(
        {
          title_original: paper.title_original,
          title_ja: paper.title_ja,
          authors: paper.authors,
          abstract: paper.abstract,
          summary_ja: paper.summary_ja,
        },
        interests,
      );

      const newStatus = determineReviewStatus(newScore, settings);

      await supabase
        .from("papers")
        .update({
          relevance_score: newScore,
          review_status: newStatus,
        })
        .eq("id", paper.id);

      results.push({
        title: paper.title_original.slice(0, 50),
        old_score: paper.relevance_score,
        new_score: newScore,
      });
      rescored++;
    } catch (e) {
      console.error(`Rescore failed for "${paper.title_original}":`, e);
      errors++;
    }
  }

  return NextResponse.json({
    message: `${rescored}件の論文を再スコアリングしました`,
    rescored,
    errors,
    total_pending: papers.length,
    results,
  });
}
