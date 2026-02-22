import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-4o";

// ---------- プロンプトテンプレート ----------

const SUMMARIZE_PROMPT = `あなたは学術論文の要約を行う専門家です。
以下の論文情報をもとに、日本語で300文字程度の要約を作成してください。

重要な注意事項：
- 提供された論文テキストの内容のみに基づいて要約してください
- テキストに記載されていない情報を推測や補完しないでください
- 論文の分野・領域はテキストの内容から正確に判断してください

要約は以下の点をカバーしてください：
- 研究の目的
- 主要な手法
- 主な結果・発見

要約のみを出力してください。`;

const EXPLAIN_PROMPT = `あなたは学術論文をわかりやすく解説する専門家です。
以下の論文情報をもとに、日本語で500〜800文字の解説を作成してください。

重要な注意事項：
- 提供された論文テキストの内容のみに基づいて解説してください
- テキストに記載されていない情報を推測や補完しないでください
- 論文の分野・領域はテキストの内容から正確に判断してください

解説は以下の構成で記述してください：
- 研究の背景と動機
- 提案手法の概要
- 実験結果と意義
- 今後の展望

一般の研究者や学生が理解できる平易な表現を心がけてください。
解説のみを出力してください。`;

const TRANSLATE_PROMPT = `以下の英語の論文タイトルを、学術的に正確な日本語に翻訳してください。
翻訳結果のみを出力してください。`;

// ---------- 論文情報を構造化テキストに変換 ----------

// PDFから抽出したテキストをクリーニング
function cleanPdfText(raw: string): string {
  return raw
    // 不要なヘッダー・フッター的パターンを除去
    .replace(/\f/g, "\n") // フォームフィード除去
    .replace(/\r\n/g, "\n")
    // 単語途中の改行を結合（行末がハイフンの場合）
    .replace(/-\n(\S)/g, "$1")
    // 行末の改行を結合（文の途中の改行を空白に置換）
    .replace(/([a-zA-Z,;])\n([a-zA-Z])/g, "$1 $2")
    // 連続空白を1つに
    .replace(/[ \t]+/g, " ")
    // 3つ以上の連続改行を2つに
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractAbstract(text: string): string | null {
  const patterns = [
    /abstract[\s.:：\-]*\n?([\s\S]{100,2000}?)(?:\n\s*\n|\n(?:1[\s.]|I[\s.]|introduction|keywords|key\s*words))/i,
    /要旨[\s.:：\-]*\n?([\s\S]{100,2000}?)(?:\n\s*\n)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function buildPaperContext(paper: {
  title_original: string;
  authors?: string[];
  abstract?: string;
  text?: string;
}): string {
  const parts = [`タイトル: ${paper.title_original}`];
  if (paper.authors?.length) {
    parts.push(`著者: ${paper.authors.join(", ")}`);
  }

  // アブストラクトを抽出（明示的に指定されていればそちらを優先）
  const cleanedText = paper.text ? cleanPdfText(paper.text) : null;
  const abstract = paper.abstract || (cleanedText ? extractAbstract(cleanedText) : null);
  if (abstract) {
    parts.push(`アブストラクト:\n${abstract}`);
  }

  if (cleanedText) {
    // トークン上限を考慮してテキストを制限（約8000文字）
    const truncatedText = cleanedText.slice(0, 8000);
    parts.push(`本文（抜粋）:\n${truncatedText}`);
  }
  return parts.join("\n\n");
}

// ---------- API関数 ----------

export async function summarizePaper(paper: {
  title_original: string;
  authors?: string[];
  abstract?: string;
  text?: string;
}): Promise<{ summary: string; usage?: OpenAI.CompletionUsage }> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SUMMARIZE_PROMPT },
      { role: "user", content: buildPaperContext(paper) },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  return {
    summary: response.choices[0]?.message?.content?.trim() || "",
    usage: response.usage ?? undefined,
  };
}

export async function explainPaper(paper: {
  title_original: string;
  authors?: string[];
  abstract?: string;
  text?: string;
}): Promise<{ explanation: string; usage?: OpenAI.CompletionUsage }> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: EXPLAIN_PROMPT },
      { role: "user", content: buildPaperContext(paper) },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return {
    explanation: response.choices[0]?.message?.content?.trim() || "",
    usage: response.usage ?? undefined,
  };
}

export async function translateTitle(
  title: string,
): Promise<{ title_ja: string; usage?: OpenAI.CompletionUsage }> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: TRANSLATE_PROMPT },
      { role: "user", content: title },
    ],
    temperature: 0.1,
    max_tokens: 200,
  });

  return {
    title_ja: response.choices[0]?.message?.content?.trim() || "",
    usage: response.usage ?? undefined,
  };
}

export async function processAllAI(paper: {
  title_original: string;
  authors?: string[];
  abstract?: string;
  text?: string;
}): Promise<{
  title_ja: string;
  summary_ja: string;
  explanation_ja: string;
  total_tokens: number;
}> {
  const [titleResult, summaryResult, explanationResult] = await Promise.all([
    translateTitle(paper.title_original),
    summarizePaper(paper),
    explainPaper(paper),
  ]);

  const totalTokens =
    (titleResult.usage?.total_tokens || 0) +
    (summaryResult.usage?.total_tokens || 0) +
    (explanationResult.usage?.total_tokens || 0);

  return {
    title_ja: titleResult.title_ja,
    summary_ja: summaryResult.summary,
    explanation_ja: explanationResult.explanation,
    total_tokens: totalTokens,
  };
}
