// 論文自動収集ロジック
import { supabase } from "@/lib/supabase";
import { searchArxiv, type ArxivPaper } from "@/lib/arxiv";
import {
  searchSemanticScholar,
  type SemanticScholarPaper,
} from "@/lib/semantic-scholar";
import { searchOpenAlex, type OpenAlexPaper } from "@/lib/openalex";
import { processAllAI } from "@/lib/ai";
import {
  scoreRelevance,
  determineReviewStatus,
  getReviewSettings,
  type ReviewSettings,
} from "@/lib/scoring";

type Keyword = {
  id: string;
  keyword: string;
  sources: string[];
  journals: string[];
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

  // スコアリング設定と関心プロファイルを事前に取得
  const settings = await getReviewSettings();
  let interests: { label: string; weight: number }[] = [];
  if (settings.scoring_enabled) {
    const { data: interestData } = await supabase
      .from("interests")
      .select("label, weight");
    interests = interestData || [];
  }

  const results: CollectResult[] = [];

  for (const kw of keywords as Keyword[]) {
    const result = await collectForKeyword(kw, settings, interests);
    results.push(result);
  }

  return results;
}

/**
 * 特定のキーワードに対して論文収集を実行する
 */
async function collectForKeyword(
  kw: Keyword,
  settings: ReviewSettings,
  interests: { label: string; weight: number }[],
): Promise<CollectResult> {
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

    // OpenAlexから収集
    if (kw.sources.includes("OpenAlex")) {
      try {
        const oaPapers = await searchOpenAlex(kw.keyword, 5);
        normalizedPapers.push(...oaPapers.map(normalizeOpenAlex));
      } catch (e) {
        console.error(
          `OpenAlex search failed for "${kw.keyword}":`,
          e,
        );
      }
    }

    // DOIベースの重複排除
    const uniquePapers = deduplicatePapers(normalizedPapers);

    // ジャーナルフィルタリング
    const journalFiltered = filterByJournals(uniquePapers, kw.journals);

    // DB内の既存論文との重複チェック（DOIベース）
    const newPapers = await filterExisting(journalFiltered);

    let savedCount = 0;

    for (const paper of newPapers) {
      try {
        // AI処理（要約・解説・タイトル翻訳）
        const aiResult = await processAllAI({
          title_original: paper.title,
          authors: paper.authors,
          abstract: paper.abstract || undefined,
        });

        // AIスコアリング
        let relevanceScore: number | null = null;
        let reviewStatus = "pending";

        if (settings.scoring_enabled && interests.length > 0) {
          try {
            relevanceScore = await scoreRelevance(
              {
                title_original: paper.title,
                title_ja: aiResult.title_ja || null,
                authors: paper.authors,
                abstract: paper.abstract,
                summary_ja: aiResult.summary_ja || null,
              },
              interests,
            );
            reviewStatus = determineReviewStatus(relevanceScore, settings);
          } catch (e) {
            console.error(`Scoring failed for "${paper.title}":`, e);
          }
        }

        // DBに保存
        const { error: insertError } = await supabase.from("papers").insert({
          title_original: paper.title,
          title_ja: aiResult.title_ja || null,
          authors: paper.authors,
          abstract: paper.abstract || null,
          published_date: paper.published_date || null,
          journal: paper.venue || null,
          doi: paper.doi || null,
          url: paper.url,
          summary_ja: aiResult.summary_ja || null,
          explanation_ja: aiResult.explanation_ja || null,
          source: "auto",
          relevance_score: relevanceScore,
          review_status: reviewStatus,
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
      message: kw.journals.length > 0
        ? `${uniquePapers.length}件中${journalFiltered.length}件がジャーナルフィルタ通過、${savedCount}件を新規登録`
        : `${uniquePapers.length}件中${savedCount}件を新規登録`,
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

function normalizeOpenAlex(paper: OpenAlexPaper): NormalizedPaper {
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
 * ジャーナル名でフィルタリングする（部分一致・大文字小文字無視）
 * journals が空配列の場合はフィルタリングしない（全て通す）
 */
function filterByJournals(
  papers: NormalizedPaper[],
  journals: string[],
): NormalizedPaper[] {
  if (!journals || journals.length === 0) {
    return papers;
  }

  const lowerJournals = journals.map((j) => j.toLowerCase().trim());

  return papers.filter((paper) => {
    if (!paper.venue) return false;
    const lowerVenue = paper.venue.toLowerCase();
    return lowerJournals.some((j) => lowerVenue.includes(j));
  });
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
 * DB内に既に存在する論文を除外する（DOIベース + タイトル原題ベース）
 */
async function filterExisting(
  papers: NormalizedPaper[],
): Promise<NormalizedPaper[]> {
  if (papers.length === 0) return papers;

  // DOIベースの重複チェック
  const dois = papers.map((p) => p.doi).filter(Boolean) as string[];
  const existingDois = new Set<string>();

  if (dois.length > 0) {
    const { data: byDoi } = await supabase
      .from("papers")
      .select("doi")
      .in("doi", dois);
    for (const p of byDoi || []) {
      existingDois.add(p.doi);
    }
  }

  // タイトル原題ベースの重複チェック
  const titles = papers.map((p) => p.title);
  const existingTitles = new Set<string>();

  if (titles.length > 0) {
    const { data: byTitle } = await supabase
      .from("papers")
      .select("title_original")
      .in("title_original", titles);
    for (const p of byTitle || []) {
      existingTitles.add(p.title_original);
    }
  }

  return papers.filter(
    (p) =>
      (!p.doi || !existingDois.has(p.doi)) &&
      !existingTitles.has(p.title),
  );
}
