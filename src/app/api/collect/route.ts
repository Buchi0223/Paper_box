import { NextResponse } from "next/server";
import { collectAllPapers } from "@/lib/collector";
import { collectAllRssFeeds } from "@/lib/rss-collector";
import {
  collectAllCitations,
  type CitationCollectResult,
} from "@/lib/citation-collector";

export const maxDuration = 60;

// 手動収集実行API
export async function POST() {
  try {
    const startTime = Date.now();

    // キーワード収集
    const keywordResults = await collectAllPapers();
    const keywordTotal = keywordResults.reduce((sum, r) => sum + r.papers_found, 0);
    const keywordErrors = keywordResults.filter((r) => r.status === "error");

    // RSS収集
    const rssResults = await collectAllRssFeeds();
    const rssTotal = rssResults.reduce((sum, r) => sum + r.papers_found, 0);
    const rssErrors = rssResults.filter((r) => r.status === "error");

    // 引用探索（経過時間に応じてシード数を動的に調整）
    let citationResults: CitationCollectResult[] = [];
    try {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const maxSeeds = elapsedSec > 30 ? 5 : elapsedSec > 15 ? 10 : 20;
      citationResults = await collectAllCitations(maxSeeds);
    } catch (e) {
      console.error("Citation collection failed:", e);
    }
    const citationTotal = citationResults.reduce(
      (sum, r) => sum + r.papers_found,
      0,
    );

    // review_breakdownの集計
    const totalBreakdown = { auto_approved: 0, pending: 0, auto_skipped: 0 };
    for (const r of [...keywordResults, ...rssResults, ...citationResults]) {
      if (r.review_breakdown) {
        totalBreakdown.auto_approved += r.review_breakdown.auto_approved;
        totalBreakdown.pending += r.review_breakdown.pending;
        totalBreakdown.auto_skipped += r.review_breakdown.auto_skipped;
      }
    }

    const totalPapers = keywordTotal + rssTotal + citationTotal;
    const hasAnyBreakdown = [
      ...keywordResults,
      ...rssResults,
      ...citationResults,
    ].some((r) => r.review_breakdown !== null);

    return NextResponse.json({
      keyword_results: keywordResults,
      rss_results: rssResults,
      citation_results: citationResults,
      summary: {
        keywords_processed: keywordResults.length,
        keyword_papers_found: keywordTotal,
        keyword_errors: keywordErrors.length,
        feeds_processed: rssResults.length,
        rss_papers_found: rssTotal,
        rss_errors: rssErrors.length,
        seeds_explored: citationResults.length,
        citation_papers_found: citationTotal,
        total_papers_found: totalPapers,
        review_breakdown:
          hasAnyBreakdown && totalPapers > 0 ? totalBreakdown : null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "収集処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
