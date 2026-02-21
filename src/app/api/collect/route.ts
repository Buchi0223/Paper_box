import { NextResponse } from "next/server";
import { collectAllPapers } from "@/lib/collector";

// 手動収集実行API
export async function POST() {
  try {
    const results = await collectAllPapers();

    const totalFound = results.reduce((sum, r) => sum + r.papers_found, 0);
    const errors = results.filter((r) => r.status === "error");

    return NextResponse.json({
      results,
      summary: {
        keywords_processed: results.length,
        total_papers_found: totalFound,
        errors: errors.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "収集処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
