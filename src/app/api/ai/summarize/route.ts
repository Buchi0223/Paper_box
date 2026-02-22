import { NextRequest, NextResponse } from "next/server";
import { summarizePaper } from "@/lib/ai";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paper_id, title_original, authors, abstract, text } = body;

    if (!title_original) {
      return NextResponse.json(
        { error: "タイトルは必須です" },
        { status: 400 },
      );
    }

    const result = await summarizePaper({
      title_original,
      authors,
      abstract,
      text,
    });

    // paper_idが指定されていればDBも更新
    if (paper_id) {
      await supabase
        .from("papers")
        .update({ summary_ja: result.summary })
        .eq("id", paper_id);
    }

    return NextResponse.json({
      summary: result.summary,
      usage: result.usage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "要約生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
