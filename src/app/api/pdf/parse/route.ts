import { NextRequest, NextResponse } from "next/server";
import { extractMetadata, extractMetadataFromPdf } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルを指定してください" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let metadata = {
      title: "",
      authors: [] as string[],
      journal: null as string | null,
      published_date: null as string | null,
      doi: null as string | null,
      abstract: null as string | null,
    };
    let extractedText = "";
    let ocrUsed = false;
    let pages = 0;
    let pdfInfo: Record<string, string> = {};

    // Step 1: pdf-parseでテキスト抽出を試行
    let textExtractionSucceeded = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse");
      const pdfData = await pdfParse(buffer);
      extractedText = (pdfData.text || "") as string;
      pages = pdfData.numpages || 0;
      pdfInfo = pdfData.info || {};
      textExtractionSucceeded = true;
    } catch (e) {
      console.warn("[PDF Parse] pdf-parse失敗、Geminiマルチモーダルにフォールバック:", e instanceof Error ? e.message : e);
    }

    const isTextSufficient = textExtractionSucceeded && extractedText.length > 50;

    // Step 2: メタデータ抽出
    if (isTextSufficient) {
      try {
        metadata = await extractMetadata(extractedText);
      } catch (e) {
        console.error("[PDF Parse] AIメタデータ抽出失敗:", e);
      }
    } else {
      // テキスト不足またはpdf-parse失敗: Geminiマルチモーダルで一括抽出
      console.log("[PDF Parse] Geminiマルチモーダルで抽出 (テキスト: %d文字, pdf-parse: %s)", extractedText.length, textExtractionSucceeded ? "成功" : "失敗");
      try {
        const result = await extractMetadataFromPdf(buffer);
        metadata = {
          title: result.title,
          authors: result.authors,
          journal: result.journal,
          published_date: result.published_date,
          doi: result.doi,
          abstract: result.abstract,
        };
        if (!extractedText || result.text.length > extractedText.length) {
          extractedText = result.text;
        }
        ocrUsed = true;
      } catch (e) {
        console.error("[PDF Parse] Geminiマルチモーダル抽出失敗:", e);
        if (!textExtractionSucceeded) {
          return NextResponse.json(
            { error: "PDFの解析に失敗しました。ファイルが破損しているか、保護されている可能性があります。" },
            { status: 422 },
          );
        }
      }
    }

    // フォールバック: PDFメタデータから補完
    if (!metadata.title) {
      const lines = extractedText.split("\n").filter((l: string) => l.trim().length > 0);
      metadata.title = pdfInfo.Title || lines[0]?.trim() || "";
    }
    if (metadata.authors.length === 0 && pdfInfo.Author) {
      metadata.authors = pdfInfo.Author.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean);
    }

    return NextResponse.json({
      title: metadata.title,
      authors: metadata.authors,
      journal: metadata.journal,
      published_date: metadata.published_date,
      doi: metadata.doi,
      abstract: metadata.abstract,
      text: extractedText.slice(0, 12000),
      pages,
      ocr_used: ocrUsed,
    });
  } catch (error) {
    console.error("[PDF Parse Error]", error);
    const message = error instanceof Error ? error.message : "PDF解析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
