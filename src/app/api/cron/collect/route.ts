import { NextRequest, NextResponse } from "next/server";
import { collectAllPapers } from "@/lib/collector";
import { collectAllRssFeeds } from "@/lib/rss-collector";
import { getReviewSettings } from "@/lib/scoring";

// Cron Job用の収集API（CRON_SECRETで認証）
export async function POST(request: NextRequest) {
  // CRON_SECRETによる認証チェック
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // 自動収集が無効の場合はスキップ
    const settings = await getReviewSettings();
    if (!settings.auto_collect_enabled) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: "自動収集は無効に設定されています",
      });
    }

    // キーワード収集
    const keywordResults = await collectAllPapers();
    const keywordTotal = keywordResults.reduce((sum, r) => sum + r.papers_found, 0);

    // RSS収集
    const rssResults = await collectAllRssFeeds();
    const rssTotal = rssResults.reduce((sum, r) => sum + r.papers_found, 0);

    return NextResponse.json({
      ok: true,
      keywords_processed: keywordResults.length,
      keyword_papers_found: keywordTotal,
      feeds_processed: rssResults.length,
      rss_papers_found: rssTotal,
      total_papers_found: keywordTotal + rssTotal,
      keyword_results: keywordResults,
      rss_results: rssResults,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cron collection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel CronはGETリクエストも送ることがある
export async function GET(request: NextRequest) {
  return POST(request);
}
