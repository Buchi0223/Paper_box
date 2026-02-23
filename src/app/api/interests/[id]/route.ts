import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/interests/:id — 関心キーワードの更新（weight, label）
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.label !== undefined) updateData.label = body.label;
  if (body.weight !== undefined) updateData.weight = body.weight;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "更新するフィールドがありません" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("interests")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/interests/:id — 関心キーワードの削除
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const { error } = await supabase.from("interests").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
