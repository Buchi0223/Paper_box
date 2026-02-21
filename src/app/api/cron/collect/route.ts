import { NextRequest, NextResponse } from "next/server";
import { collectAllPapers } from "@/lib/collector";

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
    const results = await collectAllPapers();

    const totalFound = results.reduce((sum, r) => sum + r.papers_found, 0);

    return NextResponse.json({
      ok: true,
      keywords_processed: results.length,
      total_papers_found: totalFound,
      results,
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
