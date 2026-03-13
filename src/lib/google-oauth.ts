import { google } from "googleapis";
import { supabase } from "@/lib/supabase";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * OAuth2 クライアントを生成
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set",
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Google 同意画面の URL を生成
 */
export function getAuthUrl(returnTo: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: returnTo,
  });
}

/**
 * 認証コードをトークンに交換し、メールアドレスも取得
 */
export async function exchangeCode(
  code: string,
): Promise<{ refreshToken: string; email: string }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received from Google");
  }

  // アクセストークンでメールアドレスを取得
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  if (!data.email) {
    throw new Error("Failed to retrieve email from Google");
  }

  return {
    refreshToken: tokens.refresh_token,
    email: data.email,
  };
}

/**
 * リフレッシュトークンとメールを review_settings に保存
 */
export async function saveTokens(
  refreshToken: string,
  email: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: tokenError } = await supabase
    .from("review_settings")
    .upsert(
      { key: "google_drive_refresh_token", value: refreshToken, updated_at: now },
      { onConflict: "key" },
    );

  if (tokenError) {
    throw new Error(`Failed to save refresh token: ${tokenError.message}`);
  }

  const { error: emailError } = await supabase
    .from("review_settings")
    .upsert(
      { key: "google_drive_email", value: email, updated_at: now },
      { onConflict: "key" },
    );

  if (emailError) {
    throw new Error(`Failed to save email: ${emailError.message}`);
  }
}

/**
 * DBからリフレッシュトークンを取得し、認証済み OAuth2 クライアントを返す
 * 未設定の場合は null を返す
 */
export async function getStoredAuth() {
  const { data, error } = await supabase
    .from("review_settings")
    .select("key, value")
    .eq("key", "google_drive_refresh_token")
    .single();

  if (error || !data?.value) {
    return null;
  }

  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: data.value });
  return client;
}

/**
 * トークンを取り消し、DBから削除
 */
export async function revokeAndClear(): Promise<void> {
  // DBからトークンを取得して Google に revoke リクエスト
  const { data } = await supabase
    .from("review_settings")
    .select("key, value")
    .eq("key", "google_drive_refresh_token")
    .single();

  if (data?.value) {
    try {
      const client = getOAuth2Client();
      await client.revokeToken(data.value);
    } catch {
      // revoke 失敗してもDB削除は続行
      console.warn("[Google OAuth] Token revocation failed, continuing cleanup");
    }
  }

  const now = new Date().toISOString();

  await supabase
    .from("review_settings")
    .upsert(
      { key: "google_drive_refresh_token", value: "", updated_at: now },
      { onConflict: "key" },
    );

  await supabase
    .from("review_settings")
    .upsert(
      { key: "google_drive_email", value: "", updated_at: now },
      { onConflict: "key" },
    );
}
