import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SELECT_FIELDS =
  "id, title_original, title_ja, doi, source, authors, published_date, journal, summary_ja, explanation_ja, google_drive_url";

function normalizeTitle(title: string): string {
  return (
    title
      .replace(/ﬁ/g, "fi")
      .replace(/ﬂ/g, "fl")
      .replace(/ﬀ/g, "ff")
      .replace(/ﬃ/g, "ffi")
      .replace(/ﬄ/g, "ffl")
      .replace(/[‐-―−﹘﹣－]/g, "-")
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/\s+/g, " ")
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

function extractSearchTerms(normalized: string, count: number): string[] {
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const word of words) {
    const sanitized = word.replace(/[,().\\%_'"]/g, "");
    if (sanitized.length > 2 && !STOP_WORDS.has(sanitized) && !seen.has(sanitized)) {
      seen.add(sanitized);
      terms.push(sanitized);
    }
    if (sanitized.includes("-")) {
      for (const part of sanitized.split("-")) {
        if (part.length > 2 && !STOP_WORDS.has(part) && !seen.has(part)) {
          seen.add(part);
          terms.push(part);
        }
      }
    }
  }

  return terms.sort((a, b) => b.length - a.length).slice(0, count);
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const word of text.split(/\s+/)) {
    if (word.length <= 1) continue;
    tokens.add(word);
    if (word.includes("-")) {
      for (const part of word.split("-")) {
        if (part.length > 1) tokens.add(part);
      }
    }
  }
  return tokens;
}

function wordSimilarity(a: string, b: string): number {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.4;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, doi } = body as { title?: string; doi?: string };

    console.log("[Match API] input:", { title: title?.slice(0, 80), doi });

    if (!title && !doi) {
      return NextResponse.json({ matches: [] });
    }

    // DOI完全一致を優先
    if (doi) {
      const normalizedDoi = doi.trim();
      if (normalizedDoi) {
        const { data, error } = await supabase
          .from("papers")
          .select(SELECT_FIELDS)
          .eq("doi", normalizedDoi)
          .limit(5);
        if (error) {
          console.error("[Match API] DOI search error:", error);
        }
        if (data && data.length > 0) {
          console.log("[Match API] DOI match found:", data.length);
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
      const searchTerms = extractSearchTerms(normalizedSearch, 5);

      console.log("[Match API] normalized:", normalizedSearch.slice(0, 80));
      console.log("[Match API] searchTerms:", searchTerms);

      if (searchTerms.length === 0) {
        console.log("[Match API] no search terms extracted");
        return NextResponse.json({ matches: [] });
      }

      // 各検索語で個別にilike検索（.or()のエンコード問題を回避）
      const queries = searchTerms.map((term) =>
        supabase
          .from("papers")
          .select(SELECT_FIELDS)
          .ilike("title_original", `%${term}%`)
          .limit(20),
      );

      const results = await Promise.all(queries);

      type PaperRow = { id: string; title_original: string; [key: string]: unknown };
      const candidateMap = new Map<string, PaperRow>();

      for (let i = 0; i < results.length; i++) {
        const { data, error } = results[i];
        if (error) {
          console.error(`[Match API] ilike search error for "${searchTerms[i]}":`, error);
          continue;
        }
        if (data) {
          for (const p of data as PaperRow[]) {
            if (!candidateMap.has(p.id)) {
              candidateMap.set(p.id, p);
            }
          }
        }
      }

      const candidates = [...candidateMap.values()];
      console.log("[Match API] candidates found:", candidates.length);

      if (candidates.length === 0) {
        return NextResponse.json({ matches: [] });
      }

      // 類似度スコアリング
      const scored = candidates
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

      console.log(
        "[Match API] scored matches:",
        scored.map((s) => ({
          title: s.title_original.slice(0, 50),
          similarity: s.similarity,
        })),
      );

      return NextResponse.json({ matches: scored });
    }

    return NextResponse.json({ matches: [] });
  } catch (error) {
    console.error("[Match API] Unexpected error:", error);
    return NextResponse.json({ matches: [] });
  }
}
