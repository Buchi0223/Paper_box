import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 収集ログ取得
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = parseInt(searchParams.get("limit") || "50");

  const { data, error } = await supabase
    .from("collection_logs")
    .select("*, keywords(keyword), rss_feeds(name)")
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}
