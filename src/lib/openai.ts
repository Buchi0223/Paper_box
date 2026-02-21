import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-4o";

// ---------- プロンプトテンプレート ----------

const SUMMARIZE_PROMPT = `あなたは学術論文の要約を行う専門家です。
以下の論文情報をもとに、日本語で300文字程度の要約を作成してください。
要約は以下の点をカバーしてください：
- 研究の目的
- 主要な手法
- 主な結果・発見

要約のみを出力してください。`;

const EXPLAIN_PROMPT = `あなたは学術論文をわかりやすく解説する専門家です。
以下の論文情報をもとに、日本語で500〜800文字の解説を作成してください。
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
  if (paper.abstract) {
    parts.push(`アブストラクト:\n${paper.abstract}`);
  }
  if (paper.text) {
    parts.push(`本文（抜粋）:\n${paper.text}`);
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
