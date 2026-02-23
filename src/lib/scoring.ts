// AIスコアリングモジュール
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

const SCORING_PROMPT = `あなたは研究者の関心度を判定する専門家です。

以下の「関心プロファイル」と「論文情報」を照合し、
研究者がこの論文に興味を持つ可能性を0〜100の整数で評価してください。

## 評価基準
- 90-100: 研究テーマに直接関連する
- 70-89: 関連性が高い、手法や分野が近い
- 40-69: 間接的に関連する可能性がある
- 10-39: 関連性が低い
- 0-9: 全く無関係

スコア（数値のみ）を出力してください。`;

export type ReviewSettings = {
  auto_approve_threshold: number;
  auto_skip_threshold: number;
  scoring_enabled: boolean;
};

/**
 * review_settings テーブルから設定を取得する
 */
export async function getReviewSettings(): Promise<ReviewSettings> {
  const { data } = await supabase.from("review_settings").select("key, value");

  const settings: ReviewSettings = {
    auto_approve_threshold: 70,
    auto_skip_threshold: 30,
    scoring_enabled: true,
  };

  if (data) {
    for (const row of data) {
      switch (row.key) {
        case "auto_approve_threshold":
          settings.auto_approve_threshold = parseInt(row.value) || 70;
          break;
        case "auto_skip_threshold":
          settings.auto_skip_threshold = parseInt(row.value) || 30;
          break;
        case "scoring_enabled":
          settings.scoring_enabled = row.value === "true";
          break;
      }
    }
  }

  return settings;
}

/**
 * 論文の関連度スコア（0〜100）をAIで算出する
 */
export async function scoreRelevance(
  paper: {
    title_original: string;
    title_ja?: string | null;
    authors?: string[];
    summary_ja?: string | null;
  },
  interests: { label: string; weight: number }[],
): Promise<number> {
  if (interests.length === 0) {
    return 50; // 関心プロファイルが空の場合はデフォルト
  }

  // 関心プロファイルを構築
  const interestsList = interests
    .map((i) => `- ${i.label}（重み: ${i.weight}）`)
    .join("\n");

  // 論文情報を構築
  const paperParts = [`タイトル: ${paper.title_original}`];
  if (paper.title_ja) paperParts.push(`日本語タイトル: ${paper.title_ja}`);
  if (paper.authors?.length) paperParts.push(`著者: ${paper.authors.join(", ")}`);
  if (paper.summary_ja) paperParts.push(`要約: ${paper.summary_ja}`);

  const contents = `## 関心プロファイル\n${interestsList}\n\n## 論文情報\n${paperParts.join("\n")}`;

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: SCORING_PROMPT,
      temperature: 0.1,
      maxOutputTokens: 10,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.text?.trim() || "";
  const score = parseInt(text);

  if (isNaN(score) || score < 0 || score > 100) {
    return 50; // パース失敗時はデフォルト
  }

  return score;
}

/**
 * スコアから review_status を決定する
 */
export function determineReviewStatus(
  score: number,
  settings: ReviewSettings,
): string {
  if (score >= settings.auto_approve_threshold) {
    return "auto_approved";
  }
  if (score <= settings.auto_skip_threshold) {
    return "auto_skipped";
  }
  return "pending";
}
