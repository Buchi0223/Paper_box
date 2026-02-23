import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";
import { getReviewSettings } from "@/lib/scoring";

const MODEL = "gemini-2.5-flash";

/**
 * GET /api/scoring/test — スコアリング詳細診断
 * Gemini APIの生レスポンスを直接確認する
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. 関心プロファイルの確認
  const { data: interests, error: interestError } = await supabase
    .from("interests")
    .select("label, weight");

  diagnostics.interests = {
    count: interests?.length ?? 0,
    error: interestError?.message ?? null,
    items: interests?.slice(0, 10) ?? [],
  };

  // 2. スコアリング設定の確認
  const settings = await getReviewSettings();
  diagnostics.settings = settings;

  // 3. Gemini API 直接テスト（JSON mode と non-JSON mode の比較）
  if (!process.env.GEMINI_API_KEY) {
    diagnostics.api_test = "ERROR: GEMINI_API_KEY is not set";
    return NextResponse.json(diagnostics);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 関心プロファイルを構築（上位10件のみ使用）
  const topInterests = (interests || []).slice(0, 10);
  const interestsList = topInterests
    .map((i) => `- ${i.label}（重み: ${i.weight}）`)
    .join("\n");

  const SCORING_PROMPT = `あなたは研究者の関心度を判定する専門家です。

以下の「関心プロファイル」と「論文情報」を照合し、
研究者がこの論文に興味を持つ可能性を0〜100の整数で評価してください。

## 評価基準
- 90-100: 研究テーマに直接関連する
- 70-89: 関連性が高い
- 40-69: 間接的に関連する可能性がある
- 10-39: 関連性が低い
- 0-9: 全く無関係

## 出力形式（JSONのみ出力してください）
{
  "reasoning": "2-3文の評価理由",
  "matched_interests": ["マッチした関心キーワード"],
  "score": 数値
}`;

  const testPaper = `## 関心プロファイル
${interestsList}

## 論文情報
タイトル: Deep Learning for Natural Language Processing: A Comprehensive Survey
アブストラクト: This paper provides a comprehensive survey of deep learning techniques applied to natural language processing tasks including sentiment analysis, machine translation, and text generation.`;

  // テスト A: responseMimeType: "application/json" あり
  try {
    const startA = Date.now();
    const responseA = await ai.models.generateContent({
      model: MODEL,
      contents: testPaper,
      config: {
        systemInstruction: SCORING_PROMPT,
        temperature: 0.1,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
      },
    });
    const elapsedA = Date.now() - startA;
    const textA = responseA.text?.trim() || "";

    let parsedA = null;
    try {
      parsedA = JSON.parse(textA);
    } catch {
      parsedA = "JSON_PARSE_FAILED";
    }

    diagnostics.test_with_json_mode = {
      raw_text: textA.slice(0, 500),
      raw_text_length: textA.length,
      parsed: parsedA,
      elapsed_ms: elapsedA,
    };
  } catch (e) {
    diagnostics.test_with_json_mode = {
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // テスト B: responseMimeType なし（プレーンテキスト）
  try {
    const startB = Date.now();
    const responseB = await ai.models.generateContent({
      model: MODEL,
      contents: testPaper,
      config: {
        systemInstruction: SCORING_PROMPT,
        temperature: 0.1,
        maxOutputTokens: 300,
      },
    });
    const elapsedB = Date.now() - startB;
    const textB = responseB.text?.trim() || "";

    let parsedB = null;
    try {
      parsedB = JSON.parse(textB);
    } catch {
      parsedB = "JSON_PARSE_FAILED";
    }

    diagnostics.test_without_json_mode = {
      raw_text: textB.slice(0, 500),
      raw_text_length: textB.length,
      parsed: parsedB,
      elapsed_ms: elapsedB,
    };
  } catch (e) {
    diagnostics.test_without_json_mode = {
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 4. 既存論文のスコア分布を確認
  const { data: papers } = await supabase
    .from("papers")
    .select("relevance_score")
    .not("relevance_score", "is", null);

  if (papers && papers.length > 0) {
    const scores = papers.map((p) => p.relevance_score as number);
    const distribution = { "0-19": 0, "20-39": 0, "40-59": 0, "60-79": 0, "80-100": 0 };
    for (const s of scores) {
      if (s < 20) distribution["0-19"]++;
      else if (s < 40) distribution["20-39"]++;
      else if (s < 60) distribution["40-59"]++;
      else if (s < 80) distribution["60-79"]++;
      else distribution["80-100"]++;
    }
    diagnostics.score_distribution = {
      total: scores.length,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      min: Math.min(...scores),
      max: Math.max(...scores),
      distribution,
    };
  } else {
    diagnostics.score_distribution = "No scored papers found";
  }

  return NextResponse.json(diagnostics);
}
