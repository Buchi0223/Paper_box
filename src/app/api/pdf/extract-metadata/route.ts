import { NextRequest, NextResponse } from "next/server";
import { extractMetadata } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, pdfInfo, pages } = body;

    if (!text || typeof text !== "string" || text.length < 10) {
      return NextResponse.json(
        { error: "テキストが不十分です" },
        { status: 400 },
      );
    }

    const metadata = await extractMetadata(text);

    // クライアント側 pdfInfo でフォールバック補完
    if (!metadata.title && pdfInfo?.title) {
      metadata.title = pdfInfo.title;
    }
    if (metadata.authors.length === 0 && pdfInfo?.author) {
      metadata.authors = pdfInfo.author
        .split(/[,;]/)
        .map((a: string) => a.trim())
        .filter(Boolean);
    }

    return NextResponse.json({
      title: metadata.title,
      authors: metadata.authors,
      journal: metadata.journal,
      published_date: metadata.published_date,
      doi: metadata.doi,
      abstract: metadata.abstract,
      text: text.slice(0, 12000),
      pages: pages || 0,
      ocr_used: false,
    });
  } catch (error) {
    console.error("[PDF Extract Metadata Error]", error);
    const message =
      error instanceof Error ? error.message : "メタデータ抽出に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
