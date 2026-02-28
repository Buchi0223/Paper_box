// 引用ネットワーク探索ロジック
import { supabase } from "@/lib/supabase";
import {
  resolveS2PaperId,
  fetchCitingPapers,
  fetchCitedPapers,
  type SemanticScholarPaper,
} from "@/lib/semantic-scholar";
import { processLightAI } from "@/lib/ai";
import {
  scoreRelevance,
  determineReviewStatus,
  getReviewSettings,
  type ReviewSettings,
} from "@/lib/scoring";

type ReviewBreakdown = {
  auto_approved: number;
  pending: number;
  auto_skipped: number;
};

export type CitationCollectResult = {
  seed_paper_id: string;
  seed_paper_title: string;
  status: "success" | "error";
  papers_found: number;
  message: string | null;
  review_breakdown: ReviewBreakdown | null;
};

type SeedPaper = {
  id: string;
  title_original: string;
  doi: string | null;
};

/**
 * お気に入り・承認済み論文をシードとして引用ネットワーク探索を実行する
 * @param maxSeeds cron: 5, 手動: 20
 */
export async function collectAllCitations(
  maxSeeds: number = 5,
): Promise<CitationCollectResult[]> {
  // シード論文を取得（お気に入りまたは承認済み、かつ未探索）
  const { data: seeds, error } = await supabase
    .from("papers")
    .select("id, title_original, doi")
    .or(
      "is_favorite.eq.true,review_status.in.(approved,auto_approved)",
    )
    .is("citation_explored_at", null)
    .order("collected_at", { ascending: false })
    .limit(maxSeeds);

  if (error || !seeds || seeds.length === 0) {
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

  // クロスシード重複排除用Set
  const seenKeys = new Set<string>();

  const results: CitationCollectResult[] = [];

  for (const seed of seeds as SeedPaper[]) {
    const result = await collectForSeedPaper(
      seed,
      settings,
      interests,
      seenKeys,
    );
    results.push(result);
  }

  return results;
}

/**
 * 個別シード論文の引用/被引用論文を取得してDBに登録する
 */
async function collectForSeedPaper(
  seed: SeedPaper,
  settings: ReviewSettings,
  interests: { label: string; weight: number }[],
  seenKeys: Set<string>,
): Promise<CitationCollectResult> {
  try {
    // S2 Paper IDを解決
    const s2Id = await resolveS2PaperId(seed.doi, seed.title_original);

    if (!s2Id) {
      // S2に未登録 → 再試行しない
      await supabase
        .from("papers")
        .update({ citation_explored_at: new Date().toISOString() })
        .eq("id", seed.id);

      const result: CitationCollectResult = {
        seed_paper_id: seed.id,
        seed_paper_title: seed.title_original,
        status: "error",
        papers_found: 0,
        message: "Semantic Scholar でこの論文が見つかりませんでした",
        review_breakdown: null,
      };

      await supabase.from("collection_logs").insert({
        seed_paper_id: seed.id,
        status: "error",
        papers_found: 0,
        message: result.message,
      });

      return result;
    }

    // 引用論文と被引用論文を逐次取得（レート制限対応）
    const citingPapers = await fetchCitingPapers(s2Id, 10);
    const citedPapers = await fetchCitedPapers(s2Id, 10);

    const allPapers = [...citingPapers, ...citedPapers];

    // API内重複除外（DOI/タイトル）
    const uniquePapers = deduplicatePapers(allPapers);
    const apiDuplicateCount = allPapers.length - uniquePapers.length;

    // クロスシード重複除外
    const crossFiltered = filterBySeenKeys(uniquePapers, seenKeys);
    const crossDuplicateCount = uniquePapers.length - crossFiltered.length;

    // DB重複除外
    const newPapers = await filterExisting(crossFiltered);
    const dbDuplicateCount = crossFiltered.length - newPapers.length;

    let savedCount = 0;
    const reviewBreakdown: ReviewBreakdown = {
      auto_approved: 0,
      pending: 0,
      auto_skipped: 0,
    };

    for (const paper of newPapers) {
      try {
        // 軽量AI処理（タイトル翻訳 + 要約のみ、解説なし）
        const aiResult = await processLightAI({
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
            console.error(
              `Scoring failed for "${paper.title}":`,
              e,
            );
          }
        }

        // DBに保存（source: "citation"）
        const { error: insertError } = await supabase
          .from("papers")
          .insert({
            title_original: paper.title,
            title_ja: aiResult.title_ja || null,
            authors: paper.authors,
            abstract: paper.abstract || null,
            published_date: paper.published || null,
            journal: paper.venue || null,
            doi: paper.doi || null,
            url: paper.url,
            summary_ja: aiResult.summary_ja || null,
            explanation_ja: null,
            source: "citation",
            relevance_score: relevanceScore,
            review_status: reviewStatus,
          });

        if (!insertError) {
          savedCount++;
          if (reviewStatus === "auto_approved")
            reviewBreakdown.auto_approved++;
          else if (reviewStatus === "auto_skipped")
            reviewBreakdown.auto_skipped++;
          else reviewBreakdown.pending++;
        }
      } catch (e) {
        console.error(`Failed to process paper "${paper.title}":`, e);
      }
    }

    // シード論文の探索済みフラグを更新
    await supabase
      .from("papers")
      .update({ citation_explored_at: new Date().toISOString() })
      .eq("id", seed.id);

    // 収集ログを記録
    const hasBreakdown = savedCount > 0 && settings.scoring_enabled;
    const message = buildCitationLogMessage(
      allPapers.length,
      apiDuplicateCount,
      crossDuplicateCount,
      dbDuplicateCount,
      savedCount,
      hasBreakdown ? reviewBreakdown : null,
    );

    await supabase.from("collection_logs").insert({
      seed_paper_id: seed.id,
      status: "success",
      papers_found: savedCount,
      message,
    });

    return {
      seed_paper_id: seed.id,
      seed_paper_title: seed.title_original,
      status: "success",
      papers_found: savedCount,
      message,
      review_breakdown: hasBreakdown ? reviewBreakdown : null,
    };
  } catch (e) {
    // レート制限（429）の場合は citation_explored_at をセットしない（次回再試行）
    const isRateLimited =
      e instanceof Error && e.message.includes("rate limit");

    if (!isRateLimited) {
      await supabase
        .from("papers")
        .update({ citation_explored_at: new Date().toISOString() })
        .eq("id", seed.id);
    }

    const message =
      e instanceof Error
        ? e.message
        : "引用探索処理でエラーが発生しました";

    await supabase.from("collection_logs").insert({
      seed_paper_id: seed.id,
      status: "error",
      papers_found: 0,
      message,
    });

    return {
      seed_paper_id: seed.id,
      seed_paper_title: seed.title_original,
      status: "error",
      papers_found: 0,
      message,
      review_breakdown: null,
    };
  }
}

/**
 * 引用探索ログメッセージを組み立てる
 */
function buildCitationLogMessage(
  totalCount: number,
  apiDuplicateCount: number,
  crossDuplicateCount: number,
  dbDuplicateCount: number,
  savedCount: number,
  reviewBreakdown: ReviewBreakdown | null,
): string {
  const parts: string[] = [`引用/被引用${totalCount}件取得`];
  if (apiDuplicateCount > 0) {
    parts.push(`引用・被引用間重複${apiDuplicateCount}件`);
  }
  if (crossDuplicateCount > 0) {
    parts.push(`シード間重複${crossDuplicateCount}件`);
  }
  if (dbDuplicateCount > 0) {
    parts.push(`DB既存${dbDuplicateCount}件`);
  }
  parts.push(`${savedCount}件を新規登録`);
  if (reviewBreakdown && savedCount > 0) {
    parts.push(
      `（自動承認: ${reviewBreakdown.auto_approved}, レビュー待ち: ${reviewBreakdown.pending}, 自動スキップ: ${reviewBreakdown.auto_skipped}）`,
    );
  }
  return parts.join("、");
}

/**
 * DOI/タイトルベースで重複排除する（API内）
 */
function deduplicatePapers(
  papers: SemanticScholarPaper[],
): SemanticScholarPaper[] {
  const seen = new Map<string, boolean>();
  return papers.filter((p) => {
    const key = p.doi || p.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

/**
 * クロスシード重複排除（共有seenKeysで複数シード間の重複を防ぐ）
 */
function filterBySeenKeys(
  papers: SemanticScholarPaper[],
  seenKeys: Set<string>,
): SemanticScholarPaper[] {
  return papers.filter((p) => {
    const key = p.doi || p.title.toLowerCase().trim();
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}

/**
 * DB内に既に存在する論文を除外する（DOI + タイトル原題ベース）
 */
async function filterExisting(
  papers: SemanticScholarPaper[],
): Promise<SemanticScholarPaper[]> {
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
