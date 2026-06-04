import { NextRequest, NextResponse } from "next/server";
import { getStoredAuth } from "@/lib/google-oauth";
import { DriveUploadError } from "@/lib/google-drive";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { fileName, mimeType } = await request.json();

    if (!fileName || !mimeType) {
      return NextResponse.json(
        { error: "fileName と mimeType は必須です" },
        { status: 400 },
      );
    }

    const auth = await getStoredAuth();
    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Google Drive に接続されていません。設定画面からGoogle Driveに接続してください。",
          error_code: "env_not_configured",
        },
        { status: 500 },
      );
    }

    const accessToken = (await auth.getAccessToken()).token;
    if (!accessToken) {
      return NextResponse.json(
        { error: "アクセストークンの取得に失敗しました" },
        { status: 500 },
      );
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const metadata: Record<string, unknown> = { name: fileName };
    if (folderId) {
      metadata.parents = [folderId];
    }

    // Resumable upload セッションを開始
    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      console.error("[Drive Upload Init] Google API error:", initRes.status, errText);
      return NextResponse.json(
        { error: "Google Drive アップロードの初期化に失敗しました" },
        { status: 500 },
      );
    }

    const uploadUri = initRes.headers.get("Location");
    if (!uploadUri) {
      return NextResponse.json(
        { error: "アップロードURIの取得に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ uploadUri });
  } catch (error) {
    console.error("[Drive Upload Init Error]", error);
    if (error instanceof DriveUploadError) {
      return NextResponse.json(
        { error: error.message, error_code: error.code },
        { status: 500 },
      );
    }
    const message =
      error instanceof Error ? error.message : "アップロード初期化に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
