import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scoreRelevance, getReviewSettings } from "@/lib/scoring";

/**
 * GET /api/scoring/test — スコアリング動作診断
 * 実際の関心プロファイルとサンプル論文でスコアリングをテストする
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. 関心プロファイルの確認
  const { data: interests, error: interestError } = await supabase
    .from("interests")
    .select("label, weight");

  diagnostics.interests = {
    count: interests?.length ?? 0,
    error: interestError?.message ?? null,
    items: interests?.slice(0, 10) ?? [],
  };

  // 2. スコアリング設定の確認
  const settings = await getReviewSettings();
  diagnostics.settings = settings;

  // 3. 実際にスコアリングを実行（テスト用の論文）
  if (interests && interests.length > 0) {
    const testPapers = [
      {
        title_original:
          "Deep Learning for Natural Language Processing: A Comprehensive Survey",
        title_ja: "自然言語処理のための深層学習：包括的サーベイ",
        authors: ["Test Author"],
        abstract:
          "This paper provides a comprehensive survey of deep learning techniques applied to natural language processing tasks.",
      },
      {
        title_original:
          "A Novel Approach to Quantum Computing Error Correction",
        title_ja: "量子コンピューティングエラー訂正への新しいアプローチ",
        authors: ["Test Author"],
        abstract:
          "We propose a novel error correction method for quantum computing systems using topological codes.",
      },
    ];

    const scoringResults = [];
    for (const paper of testPapers) {
      try {
        const startTime = Date.now();
        const score = await scoreRelevance(paper, interests);
        const elapsed = Date.now() - startTime;
        scoringResults.push({
          title: paper.title_original.slice(0, 60),
          score,
          elapsed_ms: elapsed,
          status: "success",
        });
      } catch (e) {
        scoringResults.push({
          title: paper.title_original.slice(0, 60),
          score: null,
          error: e instanceof Error ? e.message : String(e),
          status: "error",
        });
      }
    }
    diagnostics.scoring_test = scoringResults;
  } else {
    diagnostics.scoring_test = "SKIPPED: No interests found in database";
  }

  // 4. 既存論文のスコア分布を確認
  const { data: papers } = await supabase
    .from("papers")
    .select("relevance_score")
    .not("relevance_score", "is", null);

  if (papers && papers.length > 0) {
    const scores = papers.map((p) => p.relevance_score as number);
    const distribution = { "0-19": 0, "20-39": 0, "40-59": 0, "60-79": 0, "80-100": 0 };
    for (const s of scores) {
      if (s < 20) distribution["0-19"]++;
      else if (s < 40) distribution["20-39"]++;
      else if (s < 60) distribution["40-59"]++;
      else if (s < 80) distribution["60-79"]++;
      else distribution["80-100"]++;
    }
    diagnostics.score_distribution = {
      total: scores.length,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      min: Math.min(...scores),
      max: Math.max(...scores),
      distribution,
    };
  } else {
    diagnostics.score_distribution = "No scored papers found";
  }

  return NextResponse.json(diagnostics);
}
