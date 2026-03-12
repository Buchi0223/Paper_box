import { NextRequest, NextResponse } from "next/server";
import { uploadToDrive, DriveUploadError } from "@/lib/google-drive";

const ALLOWED_MIME_TYPES = ["application/pdf", "application/x-pdf"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません", error_code: "file_missing" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "PDFファイルのみアップロード可能です",
          error_code: "invalid_type",
        },
        { status: 400 },
      );
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
    const message =
      error instanceof Error ? error.message : "アップロードに失敗しました";
    return NextResponse.json(
      { error: message, error_code: "unknown" },
      { status: 500 },
    );
  }
}
