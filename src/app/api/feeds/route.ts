import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// フィード一覧取得
export async function GET() {
  const { data, error } = await supabase
    .from("rss_feeds")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feeds: data });
}

// フィード登録
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "フィード名は必須です" },
      { status: 400 },
    );
  }

  if (!body.feed_url?.trim()) {
    return NextResponse.json(
      { error: "Feed URLは必須です" },
      { status: 400 },
    );
  }

  const insertData = {
    name: body.name.trim(),
    feed_url: body.feed_url.trim(),
    is_active: body.is_active !== undefined ? body.is_active : true,
  };

  const { data, error } = await supabase
    .from("rss_feeds")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
