// 関心プロファイル自動学習ロジック
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";

const MODEL = "gemini-2.5-flash";

let _ai: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _ai;
}

const EXTRACT_KEYWORDS_PROMPT = `あなたは学術論文の研究テーマを分析する専門家です。
以下の論文情報から、研究テーマやキーワードを3〜5個抽出してください。

出力形式（JSON配列のみ出力、他のテキストは不要）:
["キーワード1", "キーワード2", "キーワード3"]

注意事項：
- 専門用語は日本語と英語の両方を含めてもよい
- 具体的なテーマ（例: "交通信号最適化"）を優先し、広すぎるもの（例: "研究"）は避ける
- 手法名（例: "深層強化学習"）も含めてよい`;

/**
 * 論文から関心キーワードを抽出し、interestsテーブルに学習データとして追加する
 * （「興味あり」判定時に呼び出し）
 */
export async function learnFromApproval(paper: {
  title_original: string;
  title_ja?: string | null;
  authors?: string[];
  summary_ja?: string | null;
}): Promise<string[]> {
  try {
    // AIでキーワード抽出
    const keywords = await extractKeywords(paper);
    if (keywords.length === 0) return [];

    // 既存の学習済みキーワードを取得
    const { data: existing } = await supabase
      .from("interests")
      .select("id, label, weight")
      .eq("type", "learned");

    const existingMap = new Map(
      (existing || []).map((e: { id: string; label: string; weight: number }) => [
        e.label.toLowerCase(),
        e,
      ]),
    );

    const learnedKeywords: string[] = [];

    for (const keyword of keywords) {
      const key = keyword.toLowerCase();
      const existingEntry = existingMap.get(key);

      if (existingEntry) {
        // 既存キーワード → weight を増加（最大2.0）
        const newWeight = Math.min(2.0, existingEntry.weight + 0.1);
        await supabase
          .from("interests")
          .update({ weight: newWeight })
          .eq("id", existingEntry.id);
      } else {
        // 新規キーワード → 追加
        await supabase.from("interests").insert({
          label: keyword,
          type: "learned",
          weight: 1.0,
        });
      }
      learnedKeywords.push(keyword);
    }

    return learnedKeywords;
  } catch (e) {
    console.error("Interest learning failed:", e);
    return [];
  }
}

/**
 * スキップ時に該当する学習済みキーワードのweightを微減する
 */
export async function learnFromSkip(paper: {
  title_original: string;
  title_ja?: string | null;
  summary_ja?: string | null;
}): Promise<void> {
  try {
    const keywords = await extractKeywords(paper);
    if (keywords.length === 0) return;

    // 既存の学習済みキーワードのみ対象
    const { data: existing } = await supabase
      .from("interests")
      .select("id, label, weight")
      .eq("type", "learned");

    if (!existing || existing.length === 0) return;

    const existingMap = new Map(
      existing.map((e: { id: string; label: string; weight: number }) => [
        e.label.toLowerCase(),
        e,
      ]),
    );

    for (const keyword of keywords) {
      const key = keyword.toLowerCase();
      const existingEntry = existingMap.get(key);

      if (existingEntry) {
        // weight を微減（最小0.1）
        const newWeight = Math.max(0.1, existingEntry.weight - 0.05);
        await supabase
          .from("interests")
          .update({ weight: newWeight })
          .eq("id", existingEntry.id);
      }
    }
  } catch (e) {
    console.error("Interest skip learning failed:", e);
  }
}

/**
 * 論文情報からキーワードをAIで抽出する
 */
async function extractKeywords(paper: {
  title_original: string;
  title_ja?: string | null;
  summary_ja?: string | null;
}): Promise<string[]> {
  const parts = [`タイトル: ${paper.title_original}`];
  if (paper.title_ja) parts.push(`日本語タイトル: ${paper.title_ja}`);
  if (paper.summary_ja) parts.push(`要約: ${paper.summary_ja}`);

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: parts.join("\n"),
    config: {
      systemInstruction: EXTRACT_KEYWORDS_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 300,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.text?.trim() || "[]";
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((k: unknown) => typeof k === "string" && k.trim()) : [];
  } catch {
    return [];
  }
}
