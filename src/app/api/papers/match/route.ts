import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SELECT_FIELDS =
  "id, title_original, title_ja, doi, source, authors, published_date, journal, summary_ja, explanation_ja, google_drive_url";

function normalizeTitle(title: string): string {
  return (
    title
      // 合字の展開
      .replace(/ﬁ/g, "fi")
      .replace(/ﬂ/g, "fl")
      .replace(/ﬀ/g, "ff")
      .replace(/ﬃ/g, "ffi")
      .replace(/ﬄ/g, "ffl")
      // ハイフン・ダッシュ系を統一
      .replace(/[‐-―−﹘﹣－]/g, "-")
      // スマートクォートを統一
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      // 空白の統合
      .replace(/\s+/g, " ")
      // 末尾の記号除去
      .replace(/[.,;:!?]+$/, "")
      .trim()
      .toLowerCase()
  );
}

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or",
  "is", "are", "was", "were", "by", "with", "from", "as", "its",
  "this", "that", "be", "has", "have", "not", "but", "can", "do",
  "using", "based", "via", "new", "novel", "study", "analysis",
]);

function extractKeyWords(normalized: string, count: number): string[] {
  return normalized
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .sort((a, b) => b.length - a.length)
    .slice(0, count);
}

function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 1));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 1));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.4;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, doi } = body as { title?: string; doi?: string };

  if (!title && !doi) {
    return NextResponse.json({ matches: [] });
  }

  // DOI完全一致を優先
  if (doi) {
    const normalizedDoi = doi.trim();
    if (normalizedDoi) {
      const { data } = await supabase
        .from("papers")
        .select(SELECT_FIELDS)
        .eq("doi", normalizedDoi)
        .limit(5);
      if (data && data.length > 0) {
        const matches = data.map((p) => ({
          ...p,
          similarity: 1.0,
          matched_by: "doi" as const,
        }));
        return NextResponse.json({ matches });
      }
    }
  }

  // タイトルあいまい検索
  if (title) {
    const normalizedSearch = normalizeTitle(title);
    const keyWords = extractKeyWords(normalizedSearch, 4);

    if (keyWords.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // キーワードのいずれかを含む論文を候補として取得
    const orFilters = keyWords
      .map((w) => `title_original.ilike.%${w}%`)
      .join(",");

    const { data } = await supabase
      .from("papers")
      .select(SELECT_FIELDS)
      .or(orFilters)
      .limit(50);

    if (!data || data.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // 類似度スコアリング
    const scored = data
      .map((p) => {
        const normalizedDb = normalizeTitle(p.title_original);
        const similarity =
          normalizedSearch === normalizedDb
            ? 1.0
            : wordSimilarity(normalizedSearch, normalizedDb);
        return { ...p, similarity, matched_by: "title" as const };
      })
      .filter((p) => p.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    return NextResponse.json({ matches: scored });
  }

  return NextResponse.json({ matches: [] });
}
