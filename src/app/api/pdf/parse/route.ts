import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルを指定してください" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // pdf-parseはESM default exportがないためrequireで読み込む
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(buffer);

    // PDFメタデータから情報を抽出
    const info = pdfData.info || {};
    const text = pdfData.text || "";

    // テキストの先頭部分からタイトルを推定（最初の改行まで）
    const lines = text.split("\n").filter((l: string) => l.trim().length > 0);
    const estimatedTitle = lines[0]?.trim() || "";

    return NextResponse.json({
      title: info.Title || estimatedTitle,
      author: info.Author || "",
      text: text.slice(0, 3000),
      pages: pdfData.numpages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF解析に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
