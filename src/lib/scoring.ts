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

## 評価手順（必ずこの順序で考えてください）
1. 論文の主要研究テーマ・手法を特定する
2. 各関心キーワードとの関連性を個別に評価する（重みを考慮）
3. 直接的関連（キーワードが論文の中心テーマ）と間接的関連（周辺分野）を区別する
4. 総合スコアを決定する

## 評価基準
- 90-100: 研究テーマに直接関連する（キーワードが論文の中心テーマ）
- 70-89: 関連性が高い（手法・分野が共通、応用先が近い）
- 40-69: 間接的に関連する可能性がある（関連分野だが直接的ではない）
- 10-39: 関連性が低い（ごく一部が関連）
- 0-9: 全く無関係

## 出力形式（JSONのみ出力してください）
{
  "reasoning": "2-3文の評価理由",
  "matched_interests": ["マッチした関心キーワード"],
  "score": 数値
}`;

export type ReviewSettings = {
  auto_approve_threshold: number;
  auto_skip_threshold: number;
  scoring_enabled: boolean;
  auto_collect_enabled: boolean;
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
    auto_collect_enabled: true,
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
        case "auto_collect_enabled":
          settings.auto_collect_enabled = row.value === "true";
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
    abstract?: string | null;
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
  if (paper.abstract) paperParts.push(`アブストラクト: ${paper.abstract.slice(0, 500)}`);
  if (paper.summary_ja) paperParts.push(`要約: ${paper.summary_ja}`);

  const contents = `## 関心プロファイル\n${interestsList}\n\n## 論文情報\n${paperParts.join("\n")}`;

  let text = "";
  try {
    const response = await getClient().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SCORING_PROMPT,
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    text = response.text?.trim() || "";
  } catch (apiError) {
    console.error("[Scoring] Gemini API error:", apiError);
    return 50;
  }

  if (!text) {
    console.warn("[Scoring] Empty response from Gemini API");
    return 50;
  }

  // JSON出力をパース
  try {
    const result = JSON.parse(text);
    const score = typeof result.score === "number" ? result.score : parseInt(result.score);
    if (isNaN(score) || score < 0 || score > 100) {
      console.warn("[Scoring] Invalid score value:", result.score, "raw:", text);
      return 50;
    }
    console.log(`[Scoring] score=${score}, matched=${result.matched_interests?.join(", ") || "none"}`);
    return score;
  } catch {
    // JSONパース失敗時：数値のみの出力にも対応（フォールバック）
    console.warn("[Scoring] JSON parse failed, raw text:", text.slice(0, 200));
    const score = parseInt(text);
    if (isNaN(score) || score < 0 || score > 100) {
      return 50;
    }
    return score;
  }
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

/**
 * スコアリング精度を記録する（レビュー実行時に呼び出す）
 */
export async function trackScoringAccuracy(
  paperId: string,
  aiScore: number | null,
  userAction: "approve" | "skip",
): Promise<void> {
  if (aiScore === null) return;

  const settings = await getReviewSettings();
  const expectedAction =
    aiScore >= settings.auto_approve_threshold
      ? "approve"
      : aiScore <= settings.auto_skip_threshold
        ? "skip"
        : "uncertain";
  const isCorrect =
    expectedAction === userAction || expectedAction === "uncertain";

  await supabase.from("scoring_feedback").insert({
    paper_id: paperId,
    ai_score: aiScore,
    user_action: userAction,
    scoring_method: "v2",
    is_correct: isCorrect,
  });
}
