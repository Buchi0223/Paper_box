import { NextResponse } from "next/server";
import { collectAllPapers } from "@/lib/collector";
import { collectAllRssFeeds } from "@/lib/rss-collector";

// 手動収集実行API
export async function POST() {
  try {
    // キーワード収集
    const keywordResults = await collectAllPapers();
    const keywordTotal = keywordResults.reduce((sum, r) => sum + r.papers_found, 0);
    const keywordErrors = keywordResults.filter((r) => r.status === "error");

    // RSS収集
    const rssResults = await collectAllRssFeeds();
    const rssTotal = rssResults.reduce((sum, r) => sum + r.papers_found, 0);
    const rssErrors = rssResults.filter((r) => r.status === "error");

    // review_breakdownの集計
    const totalBreakdown = { auto_approved: 0, pending: 0, auto_skipped: 0 };
    for (const r of [...keywordResults, ...rssResults]) {
      if (r.review_breakdown) {
        totalBreakdown.auto_approved += r.review_breakdown.auto_approved;
        totalBreakdown.pending += r.review_breakdown.pending;
        totalBreakdown.auto_skipped += r.review_breakdown.auto_skipped;
      }
    }

    const totalPapers = keywordTotal + rssTotal;
    const hasAnyBreakdown = [...keywordResults, ...rssResults].some(
      (r) => r.review_breakdown !== null,
    );

    return NextResponse.json({
      keyword_results: keywordResults,
      rss_results: rssResults,
      summary: {
        keywords_processed: keywordResults.length,
        keyword_papers_found: keywordTotal,
        keyword_errors: keywordErrors.length,
        feeds_processed: rssResults.length,
        rss_papers_found: rssTotal,
        rss_errors: rssErrors.length,
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
