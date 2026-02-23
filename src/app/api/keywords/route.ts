import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// キーワード一覧取得
export async function GET() {
  const { data, error } = await supabase
    .from("keywords")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keywords: data });
}

// キーワード登録
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.keyword?.trim()) {
    return NextResponse.json(
      { error: "キーワードは必須です" },
      { status: 400 },
    );
  }

  const insertData = {
    keyword: body.keyword.trim(),
    category: body.category?.trim() || null,
    sources: body.sources || ["arXiv"],
    journals: body.journals || [],
    is_active: body.is_active !== undefined ? body.is_active : true,
  };

  const { data, error } = await supabase
    .from("keywords")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
