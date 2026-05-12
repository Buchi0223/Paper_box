import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getStoredAuth } from "@/lib/google-oauth";

export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    steps.step1_env = {
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "(未設定)",
      hasOAuthClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
      hasOAuthClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    };

    const oauthClient = await getStoredAuth();
    steps.step2_auth = oauthClient ? "OAuth接続済み" : "未接続";

    if (!oauthClient) {
      return NextResponse.json({ steps, error: "OAuth未接続" });
    }

    const drive = google.drive({ version: "v3", auth: oauthClient });

    const about = await drive.about.get({ fields: "user" });
    steps.step3_user = about.data.user?.emailAddress;

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (folderId) {
      try {
        const folder = await drive.files.get({
          fileId: folderId,
          fields: "id, name, mimeType",
          supportsAllDrives: true,
        });
        steps.step4_folder = {
          accessible: true,
          name: folder.data.name,
          mimeType: folder.data.mimeType,
        };
      } catch (e) {
        steps.step4_folder = {
          accessible: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    try {
      const testFile = await drive.files.create({
        requestBody: {
          name: "_paperbox_test.txt",
          parents: folderId ? [folderId] : undefined,
        },
        media: {
          mimeType: "text/plain",
          body: "test",
        },
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });
      steps.step5_upload = {
        success: true,
        fileId: testFile.data.id,
      };
      if (testFile.data.id) {
        await drive.files.delete({
          fileId: testFile.data.id,
          supportsAllDrives: true,
        });
        steps.step5_cleanup = "テストファイル削除済み";
      }
    } catch (e) {
      steps.step5_upload = {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    return NextResponse.json({ steps, ok: true });
  } catch (e) {
    steps.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ steps, ok: false }, { status: 500 });
  }
}
