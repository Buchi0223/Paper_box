// RSSフィード取得・パースモジュール
import Parser from "rss-parser";

// rss-parser のカスタムフィールド定義
type CustomFeed = Record<string, never>;
type CustomItem = {
  "dc:creator"?: string;
};

const parser = new Parser<CustomFeed, CustomItem>({
  customFields: {
    item: ["dc:creator"],
  },
  timeout: 15000,
});

// 正規化された論文エントリ
export type RssEntry = {
  title: string;
  authors: string[];
  abstract: string | null;
  published_date: string | null;
  doi: string | null;
  url: string;
};

/**
 * RSSフィードを取得してパースし、正規化されたエントリの配列を返す
 */
export async function fetchAndParseFeed(
  feedUrl: string,
  lastFetchedAt: string | null,
): Promise<RssEntry[]> {
  const feed = await parser.parseURL(feedUrl);

  if (!feed.items || feed.items.length === 0) {
    return [];
  }

  // last_fetched_at 以降のエントリのみ抽出
  const cutoff = lastFetchedAt ? new Date(lastFetchedAt) : null;

  const entries: RssEntry[] = [];

  for (const item of feed.items) {
    if (!item.title || !item.link) continue;

    // 日付フィルタリング（差分取得）
    if (cutoff && item.pubDate) {
      const pubDate = new Date(item.pubDate);
      if (pubDate <= cutoff) continue;
    }

    entries.push(normalizeEntry(item));
  }

  return entries;
}

/**
 * フィードエントリを正規化する
 */
function normalizeEntry(item: Parser.Item & CustomItem): RssEntry {
  return {
    title: cleanText(item.title || ""),
    authors: extractAuthors(item),
    abstract: extractAbstract(item),
    published_date: normalizeDate(item.pubDate || item.isoDate || null),
    doi: extractDoi(item.link || ""),
    url: item.link || "",
  };
}

/**
 * 著者を抽出する（dc:creator または author フィールド）
 */
function extractAuthors(item: Parser.Item & CustomItem): string[] {
  // dc:creator フィールド
  const dcCreator = item["dc:creator"];
  if (dcCreator) {
    return dcCreator
      .split(/[,;]/)
      .map((a) => a.trim())
      .filter(Boolean);
  }

  // author フィールド
  if (item.creator) {
    return item.creator
      .split(/[,;]/)
      .map((a) => a.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * アブストラクトを抽出する（description or summary、HTMLタグ除去）
 */
function extractAbstract(item: Parser.Item): string | null {
  const raw = item.contentSnippet || item.content || item.summary || null;
  if (!raw) return null;

  const cleaned = stripHtml(raw).trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * HTMLタグを除去する
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * テキストをクリーニングする
 */
function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * URLからDOIを抽出する
 */
function extractDoi(url: string): string | null {
  // doi.org/10.xxxx/yyyy パターン
  const doiMatch = url.match(/doi\.org\/(10\.\d{4,}[^\s]*)/i);
  if (doiMatch) return doiMatch[1];

  // dx.doi.org パターン
  const dxMatch = url.match(/dx\.doi\.org\/(10\.\d{4,}[^\s]*)/i);
  if (dxMatch) return dxMatch[1];

  return null;
}

/**
 * 日付をISO形式に正規化する
 */
function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}
