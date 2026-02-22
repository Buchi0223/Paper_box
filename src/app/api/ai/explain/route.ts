import { NextRequest, NextResponse } from "next/server";
import { explainPaper } from "@/lib/ai";
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

    const result = await explainPaper({
      title_original,
      authors,
      abstract,
      text,
    });

    // paper_idが指定されていればDBも更新
    if (paper_id) {
      await supabase
        .from("papers")
        .update({ explanation_ja: result.explanation })
        .eq("id", paper_id);
    }

    return NextResponse.json({
      explanation: result.explanation,
      usage: result.usage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "解説生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
