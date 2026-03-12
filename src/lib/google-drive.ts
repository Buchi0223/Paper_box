import { google } from "googleapis";
import { Readable } from "stream";

export class DriveUploadError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "DriveUploadError";
  }
}

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    console.error("[Google Drive] GOOGLE_SERVICE_ACCOUNT_KEY が未設定です");
    throw new DriveUploadError(
      "Google Drive設定が未完了です（GOOGLE_SERVICE_ACCOUNT_KEY 未設定）",
      "env_not_configured",
    );
  }

  try {
    const key = JSON.parse(keyJson);
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
  } catch (error) {
    console.error("[Google Drive] 認証情報のJSON解析に失敗:", error);
    throw new DriveUploadError(
      "Google Drive認証に失敗しました（JSON解析エラー）",
      "auth_failed",
    );
  }
}

export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log("[Google Drive] ファイルアップロード開始:", {
    fileName,
    mimeType,
    folderId: folderId || "(未設定)",
  });

  // 認証フェーズ
  let auth;
  try {
    auth = getAuth();
  } catch (error) {
    if (error instanceof DriveUploadError) throw error;
    console.error("[Google Drive] 認証フェーズで予期しないエラー:", error);
    throw new DriveUploadError(
      "Google Drive認証に失敗しました",
      "auth_failed",
    );
  }

  const drive = google.drive({ version: "v3", auth });

  // ファイル作成フェーズ
  let response;
  try {
    response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType,
        body: Readable.from(fileBuffer),
      },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    console.log("[Google Drive] ファイル作成成功:", {
      fileId: response.data.id,
    });
  } catch (error) {
    console.error("[Google Drive] ファイル作成失敗:", error);
    throw new DriveUploadError(
      `ファイルのアップロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      "upload_failed",
    );
  }

  // 共有設定フェーズ
  if (response.data.id) {
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
        supportsAllDrives: true,
      });
      console.log("[Google Drive] 共有設定成功:", {
        fileId: response.data.id,
      });
    } catch (error) {
      console.error("[Google Drive] 共有設定失敗:", error);
      throw new DriveUploadError(
        `ファイルの共有設定に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        "permission_failed",
      );
    }
  }

  const url =
    response.data.webViewLink ||
    `https://drive.google.com/file/d/${response.data.id}/view`;
  console.log("[Google Drive] アップロード完了:", { url });

  return url;
}
