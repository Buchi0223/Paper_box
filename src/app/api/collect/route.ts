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
        total_papers_found: keywordTotal + rssTotal,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "収集処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
