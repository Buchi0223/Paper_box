import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// フィード更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.feed_url !== undefined) updateData.feed_url = body.feed_url.trim();
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "更新するフィールドがありません" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("rss_feeds")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// フィード削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { error } = await supabase.from("rss_feeds").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
