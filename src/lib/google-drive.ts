import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { Readable } from "stream";
import { getStoredAuth } from "@/lib/google-oauth";

export class DriveUploadError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "DriveUploadError";
  }
}

type AuthResult = {
  auth: InstanceType<typeof google.auth.GoogleAuth> | OAuth2Client;
  isOAuth: boolean;
};

/**
 * 認証モード優先順位:
 * 1. OAuth refresh_token が DB にある → OAuth2 クライアント
 * 2. GOOGLE_SERVICE_ACCOUNT_KEY 環境変数がある → サービスアカウント
 * 3. どちらもない → エラー
 */
async function getAuth(): Promise<AuthResult> {
  // 1. OAuth トークンを確認
  const oauthClient = await getStoredAuth();
  if (oauthClient) {
    return { auth: oauthClient, isOAuth: true };
  }

  // 2. サービスアカウントにフォールバック
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    try {
      const key = JSON.parse(keyJson);
      const googleAuth = new google.auth.GoogleAuth({
        credentials: key,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
      return { auth: googleAuth, isOAuth: false };
    } catch {
      throw new DriveUploadError(
        "GOOGLE_SERVICE_ACCOUNT_KEY の形式が不正です",
        "invalid_config",
      );
    }
  }

  // 3. どちらもない
  throw new DriveUploadError(
    "Google Drive の認証が設定されていません。設定画面からGoogle Driveに接続してください。",
    "env_not_configured",
  );
}

export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const { auth, isOAuth } = await getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log("[Google Drive] アップロード開始:", {
    fileName,
    mimeType,
    authMode: isOAuth ? "OAuth" : "ServiceAccount",
    folderId: folderId || "(未設定)",
  });

  const response = await drive.files.create({
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
    authMode: isOAuth ? "OAuth" : "ServiceAccount",
  });

  // OAuth モードでは permissions.create をスキップ
  // ユーザー自身がオーナーのため、公開共有は不要
  if (!isOAuth && response.data.id) {
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
    console.log("[Google Drive] 共有設定成功");
  }

  return (
    response.data.webViewLink ||
    `https://drive.google.com/file/d/${response.data.id}/view`
  );
}
