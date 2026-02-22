import { NextRequest, NextResponse } from "next/server";
import { processAllAI } from "@/lib/ai";
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

    const result = await processAllAI({
      title_original,
      authors,
      abstract,
      text,
    });

    // paper_idが指定されていればDBも更新
    if (paper_id) {
      const updateData: Record<string, string> = {
        summary_ja: result.summary_ja,
        explanation_ja: result.explanation_ja,
      };
      if (result.title_ja) {
        updateData.title_ja = result.title_ja;
      }
      await supabase.from("papers").update(updateData).eq("id", paper_id);
    }

    return NextResponse.json({
      title_ja: result.title_ja,
      summary_ja: result.summary_ja,
      explanation_ja: result.explanation_ja,
      total_tokens: result.total_tokens,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
