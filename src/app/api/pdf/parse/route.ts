import { NextRequest, NextResponse } from "next/server";
import { extractMetadata } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルを指定してください" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // pdf-parse v1はrequire("pdf-parse")だとテストファイルを読み込むバグがあるため
    // lib/pdf-parseから直接読み込む
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    const pdfData = await pdfParse(buffer);

    const text = (pdfData.text || "") as string;

    // AIでメタデータを構造化抽出
    let metadata = {
      title: "",
      authors: [] as string[],
      journal: null as string | null,
      published_date: null as string | null,
      doi: null as string | null,
      abstract: null as string | null,
    };

    if (text.length > 50) {
      try {
        metadata = await extractMetadata(text);
      } catch (e) {
        console.error("[PDF Parse] AI metadata extraction failed:", e);
        // AI抽出失敗時はPDFメタデータにフォールバック
      }
    }

    // AIで取得できなかった場合はPDFメタデータにフォールバック
    const info = pdfData.info || {};
    if (!metadata.title) {
      const lines = text.split("\n").filter((l: string) => l.trim().length > 0);
      metadata.title = info.Title || lines[0]?.trim() || "";
    }
    if (metadata.authors.length === 0 && info.Author) {
      metadata.authors = info.Author.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean);
    }

    return NextResponse.json({
      title: metadata.title,
      authors: metadata.authors,
      journal: metadata.journal,
      published_date: metadata.published_date,
      doi: metadata.doi,
      abstract: metadata.abstract,
      text: text.slice(0, 12000),
      pages: pdfData.numpages,
    });
  } catch (error) {
    console.error("[PDF Parse Error]", error);
    const message = error instanceof Error ? error.message : "PDF解析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
