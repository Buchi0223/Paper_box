import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, doi } = body as { title?: string; doi?: string };

  if (!title && !doi) {
    return NextResponse.json({ matches: [] });
  }

  // DOI完全一致を優先
  if (doi) {
    const { data } = await supabase
      .from("papers")
      .select("id, title_original, title_ja, doi, source, authors, published_date, journal, summary_ja, explanation_ja, google_drive_url")
      .eq("doi", doi)
      .limit(5);
    if (data && data.length > 0) {
      return NextResponse.json({ matches: data, matched_by: "doi" });
    }
  }

  // タイトル一致（大文字小文字無視）
  if (title) {
    const normalized = title.trim();
    const { data } = await supabase
      .from("papers")
      .select("id, title_original, title_ja, doi, source, authors, published_date, journal, summary_ja, explanation_ja, google_drive_url")
      .ilike("title_original", normalized)
      .limit(5);
    if (data && data.length > 0) {
      return NextResponse.json({ matches: data, matched_by: "title" });
    }
  }

  return NextResponse.json({ matches: [] });
}
