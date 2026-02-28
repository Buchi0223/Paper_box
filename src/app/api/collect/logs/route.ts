import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 収集ログ取得
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);

  const { data, error } = await supabase
    .from("collection_logs")
    .select("*, keywords(keyword), rss_feeds(name), seed_paper:papers!seed_paper_id(title_original, title_ja)")
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}
