import { google } from "googleapis";
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

async function getAuth() {
  const oauthClient = await getStoredAuth();
  if (oauthClient) {
    return oauthClient;
  }

  throw new DriveUploadError(
    "Google Drive に接続されていません。設定画面からGoogle Driveに接続してください。",
    "env_not_configured",
  );
}

export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const auth = await getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log("[Google Drive] アップロード開始:", {
    fileName,
    mimeType,
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
  });

  return (
    response.data.webViewLink ||
    `https://drive.google.com/file/d/${response.data.id}/view`
  );
}
