import { NextRequest, NextResponse } from "next/server";
import { collectAllCitations } from "@/lib/citation-collector";
import { getReviewSettings } from "@/lib/scoring";

export const maxDuration = 60; // Hobbyプラン上限

// 引用探索専用Cron Job（CRON_SECRETで認証）
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

    // cron時は5シードに制限（60秒以内に収まるように）
    const results = await collectAllCitations(5);

    const totalPapersFound = results.reduce(
      (sum, r) => sum + r.papers_found,
      0,
    );
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      ok: true,
      seeds_processed: results.length,
      seeds_success: successCount,
      seeds_error: errorCount,
      total_papers_found: totalPapersFound,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Citation collection cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel CronはGETリクエストも送ることがある
export async function GET(request: NextRequest) {
  return POST(request);
}
