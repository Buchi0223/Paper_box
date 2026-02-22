// 論文自動収集ロジック
import { supabase } from "@/lib/supabase";
import { searchArxiv, type ArxivPaper } from "@/lib/arxiv";
import {
  searchSemanticScholar,
  type SemanticScholarPaper,
} from "@/lib/semantic-scholar";
import { processAllAI } from "@/lib/ai";

type Keyword = {
  id: string;
  keyword: string;
  sources: string[];
  is_active: boolean;
};

type CollectResult = {
  keyword_id: string;
  keyword: string;
  status: "success" | "error";
  papers_found: number;
  message: string | null;
};

// 統一された論文データ構造
type NormalizedPaper = {
  title: string;
  authors: string[];
  abstract: string | null;
  published_date: string | null;
  doi: string | null;
  url: string;
  venue: string | null;
};

/**
 * 有効なキーワードすべてに対して論文収集を実行する
 */
export async function collectAllPapers(): Promise<CollectResult[]> {
  // 有効なキーワードを取得
  const { data: keywords, error } = await supabase
    .from("keywords")
    .select("*")
    .eq("is_active", true);

  if (error || !keywords || keywords.length === 0) {
    return [];
  }

  const results: CollectResult[] = [];

  for (const kw of keywords as Keyword[]) {
    const result = await collectForKeyword(kw);
    results.push(result);
  }

  return results;
}

/**
 * 特定のキーワードに対して論文収集を実行する
 */
async function collectForKeyword(kw: Keyword): Promise<CollectResult> {
  try {
    const normalizedPapers: NormalizedPaper[] = [];

    // arXivから収集
    if (kw.sources.includes("arXiv")) {
      try {
        const arxivPapers = await searchArxiv(kw.keyword, 5);
        normalizedPapers.push(...arxivPapers.map(normalizeArxiv));
      } catch (e) {
        console.error(`arXiv search failed for "${kw.keyword}":`, e);
      }
    }

    // Semantic Scholarから収集
    if (kw.sources.includes("Semantic Scholar")) {
      try {
        const s2Papers = await searchSemanticScholar(kw.keyword, 5);
        normalizedPapers.push(...s2Papers.map(normalizeS2));
      } catch (e) {
        console.error(
          `Semantic Scholar search failed for "${kw.keyword}":`,
          e,
        );
      }
    }

    // DOIベースの重複排除
    const uniquePapers = deduplicatePapers(normalizedPapers);

    // DB内の既存論文との重複チェック（DOIベース）
    const newPapers = await filterExisting(uniquePapers);

    let savedCount = 0;

    for (const paper of newPapers) {
      try {
        // AI処理（要約・解説・タイトル翻訳）
        const aiResult = await processAllAI({
          title_original: paper.title,
          authors: paper.authors,
          abstract: paper.abstract || undefined,
        });

        // DBに保存
        const { error: insertError } = await supabase.from("papers").insert({
          title_original: paper.title,
          title_ja: aiResult.title_ja || null,
          authors: paper.authors,
          published_date: paper.published_date || null,
          journal: paper.venue || null,
          doi: paper.doi || null,
          url: paper.url,
          summary_ja: aiResult.summary_ja || null,
          explanation_ja: aiResult.explanation_ja || null,
          source: "auto",
        });

        if (!insertError) {
          savedCount++;

          // paper_keywordsに関連付け
          const { data: savedPaper } = await supabase
            .from("papers")
            .select("id")
            .eq("title_original", paper.title)
            .single();

          if (savedPaper) {
            await supabase.from("paper_keywords").insert({
              paper_id: savedPaper.id,
              keyword_id: kw.id,
            });
          }
        }
      } catch (e) {
        console.error(`Failed to process paper "${paper.title}":`, e);
      }
    }

    // 収集ログを記録
    const logResult: CollectResult = {
      keyword_id: kw.id,
      keyword: kw.keyword,
      status: "success",
      papers_found: savedCount,
      message: `${uniquePapers.length}件中${savedCount}件を新規登録`,
    };

    await supabase.from("collection_logs").insert({
      keyword_id: kw.id,
      status: "success",
      papers_found: savedCount,
      message: logResult.message,
    });

    return logResult;
  } catch (e) {
    const message = e instanceof Error ? e.message : "収集処理でエラーが発生しました";

    await supabase.from("collection_logs").insert({
      keyword_id: kw.id,
      status: "error",
      papers_found: 0,
      message,
    });

    return {
      keyword_id: kw.id,
      keyword: kw.keyword,
      status: "error",
      papers_found: 0,
      message,
    };
  }
}

function normalizeArxiv(paper: ArxivPaper): NormalizedPaper {
  return {
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    published_date: paper.published,
    doi: paper.doi,
    url: paper.url,
    venue: null,
  };
}

function normalizeS2(paper: SemanticScholarPaper): NormalizedPaper {
  return {
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    published_date: paper.published,
    doi: paper.doi,
    url: paper.url,
    venue: paper.venue,
  };
}

/**
 * DOIベースで重複排除する（DOIがない場合はタイトルで比較）
 */
function deduplicatePapers(papers: NormalizedPaper[]): NormalizedPaper[] {
  const seen = new Map<string, boolean>();
  return papers.filter((p) => {
    const key = p.doi || p.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

/**
 * DB内に既に存在する論文を除外する
 */
async function filterExisting(
  papers: NormalizedPaper[],
): Promise<NormalizedPaper[]> {
  const dois = papers.map((p) => p.doi).filter(Boolean) as string[];

  if (dois.length === 0) return papers;

  const { data: existing } = await supabase
    .from("papers")
    .select("doi")
    .in("doi", dois);

  const existingDois = new Set((existing || []).map((p: { doi: string }) => p.doi));

  return papers.filter((p) => !p.doi || !existingDois.has(p.doi));
}
