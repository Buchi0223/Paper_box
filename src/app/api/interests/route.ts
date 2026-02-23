import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/interests — 関心プロファイル一覧取得
 */
export async function GET() {
  const { data, error } = await supabase
    .from("interests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ interests: data || [] });
}

/**
 * POST /api/interests — 関心キーワード手動追加
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { label, weight } = body;

  if (!label || !label.trim()) {
    return NextResponse.json(
      { error: "キーワードは必須です" },
      { status: 400 },
    );
  }

  const insertData = {
    label: label.trim(),
    type: "manual",
    weight: weight ?? 1.0,
  };

  const { data, error } = await supabase
    .from("interests")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
