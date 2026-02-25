// RSS フィード収集ロジック
import { supabase } from "@/lib/supabase";
import { fetchAndParseFeed, type RssEntry } from "@/lib/rss";
import { translateTitle } from "@/lib/ai";
import {
  scoreRelevance,
  determineReviewStatus,
  getReviewSettings,
  type ReviewSettings,
} from "@/lib/scoring";

type RssFeed = {
  id: string;
  name: string;
  feed_url: string;
  is_active: boolean;
  last_fetched_at: string | null;
};

export type RssCollectResult = {
  feed_id: string;
  feed_name: string;
  status: "success" | "error";
  papers_found: number;
  message: string | null;
};

/**
 * 有効なRSSフィードすべてに対して論文収集を実行する
 */
export async function collectAllRssFeeds(): Promise<RssCollectResult[]> {
  const { data: feeds, error } = await supabase
    .from("rss_feeds")
    .select("*")
    .eq("is_active", true);

  if (error || !feeds || feeds.length === 0) {
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

  const results: RssCollectResult[] = [];

  for (const feed of feeds as RssFeed[]) {
    const result = await collectForFeed(feed, settings, interests);
    results.push(result);
  }

  return results;
}

/**
 * 特定のRSSフィードに対して論文収集を実行する
 */
async function collectForFeed(
  feed: RssFeed,
  settings: ReviewSettings,
  interests: { label: string; weight: number }[],
): Promise<RssCollectResult> {
  try {
    // フィードを取得・パース
    const entries = await fetchAndParseFeed(feed.feed_url, feed.last_fetched_at);

    if (entries.length === 0) {
      const result: RssCollectResult = {
        feed_id: feed.id,
        feed_name: feed.name,
        status: "success",
        papers_found: 0,
        message: "新着エントリなし",
      };

      await supabase.from("collection_logs").insert({
        feed_id: feed.id,
        status: "success",
        papers_found: 0,
        message: result.message,
      });

      // last_fetched_at を更新
      await supabase
        .from("rss_feeds")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", feed.id);

      return result;
    }

    // DOIベースの重複排除（DB内の既存論文との照合）
    const newEntries = await filterExistingEntries(entries);
    const duplicateCount = entries.length - newEntries.length;

    let savedCount = 0;

    for (const entry of newEntries) {
      try {
        // AI処理: タイトル翻訳のみ
        let titleJa: string | null = null;
        try {
          const titleResult = await translateTitle(entry.title);
          titleJa = titleResult.title_ja || null;
        } catch (e) {
          console.error(`Title translation failed for "${entry.title}":`, e);
        }

        // AIスコアリング
        let relevanceScore: number | null = null;
        let reviewStatus = "pending";

        if (settings.scoring_enabled && interests.length > 0) {
          try {
            relevanceScore = await scoreRelevance(
              {
                title_original: entry.title,
                title_ja: titleJa,
                authors: entry.authors,
                abstract: entry.abstract,
              },
              interests,
            );
            reviewStatus = determineReviewStatus(relevanceScore, settings);
          } catch (e) {
            console.error(`Scoring failed for "${entry.title}":`, e);
          }
        }

        // DBに保存
        const { error: insertError } = await supabase.from("papers").insert({
          title_original: entry.title,
          title_ja: titleJa,
          authors: entry.authors,
          abstract: entry.abstract || null,
          published_date: entry.published_date || null,
          doi: entry.doi || null,
          url: entry.url,
          source: "rss",
          review_status: reviewStatus,
          relevance_score: relevanceScore,
        });

        if (!insertError) {
          savedCount++;
        }
      } catch (e) {
        console.error(`Failed to process RSS entry "${entry.title}":`, e);
      }
    }

    // last_fetched_at を現在時刻に更新
    await supabase
      .from("rss_feeds")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", feed.id);

    // 収集ログを記録
    const result: RssCollectResult = {
      feed_id: feed.id,
      feed_name: feed.name,
      status: "success",
      papers_found: savedCount,
      message: buildRssLogMessage(entries.length, duplicateCount, savedCount),
    };

    await supabase.from("collection_logs").insert({
      feed_id: feed.id,
      status: "success",
      papers_found: savedCount,
      message: result.message,
    });

    return result;
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "RSS収集処理でエラーが発生しました";

    await supabase.from("collection_logs").insert({
      feed_id: feed.id,
      status: "error",
      papers_found: 0,
      message,
    });

    return {
      feed_id: feed.id,
      feed_name: feed.name,
      status: "error",
      papers_found: 0,
      message,
    };
  }
}

/**
 * RSS収集ログメッセージを組み立てる
 */
function buildRssLogMessage(
  totalCount: number,
  duplicateCount: number,
  savedCount: number,
): string {
  const parts: string[] = [`${totalCount}件取得`];
  if (duplicateCount > 0) {
    parts.push(`${duplicateCount}件は既存`);
  }
  parts.push(`${savedCount}件を新規登録`);
  return parts.join("、");
}

/**
 * DB内に既に存在する論文を除外する（DOIベース + タイトル原題ベース）
 */
async function filterExistingEntries(
  entries: RssEntry[],
): Promise<RssEntry[]> {
  if (entries.length === 0) return entries;

  // DOIベースの重複チェック
  const dois = entries.map((e) => e.doi).filter(Boolean) as string[];
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
  const titles = entries.map((e) => e.title);
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

  return entries.filter(
    (e) =>
      (!e.doi || !existingDois.has(e.doi)) &&
      !existingTitles.has(e.title),
  );
}
