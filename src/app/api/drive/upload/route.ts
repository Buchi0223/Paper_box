import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive, DriveUploadError } from "@/lib/google-drive";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルのみアップロード可能です" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const driveUrl = await uploadToDrive(buffer, file.name, file.type);

    return NextResponse.json({ url: driveUrl });
  } catch (error) {
    if (error instanceof DriveUploadError) {
      return NextResponse.json(
        { error: error.message, error_code: error.code },
        { status: 500 },
      );
    }
    const message = error instanceof Error ? error.message : "アップロードに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
