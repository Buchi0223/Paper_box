import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// キーワード更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.keyword !== undefined) updateData.keyword = body.keyword.trim();
  if (body.category !== undefined)
    updateData.category = body.category?.trim() || null;
  if (body.sources !== undefined) updateData.sources = body.sources;
  if (body.journals !== undefined) updateData.journals = body.journals;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "更新するフィールドがありません" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("keywords")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// キーワード削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { error } = await supabase.from("keywords").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
