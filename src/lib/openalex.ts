// OpenAlex API クライアント
// API docs: https://docs.openalex.org/

export type OpenAlexPaper = {
  title: string;
  authors: string[];
  abstract: string | null;
  published: string | null;
  doi: string | null;
  url: string;
  venue: string | null;
};

const OPENALEX_API_BASE = "https://api.openalex.org";

// Polite poolに入るためにメールアドレスを設定（環境変数、任意）
function getMailto(): string | null {
  return process.env.OPENALEX_EMAIL || null;
}

/**
 * OpenAlex APIで論文を検索する
 * @param query 検索クエリ（キーワード）
 * @param limit 取得件数（デフォルト10、最大200）
 */
export async function searchOpenAlex(
  query: string,
  limit: number = 10,
): Promise<OpenAlexPaper[]> {
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.min(limit, 200)),
    sort: "publication_date:desc",
    select:
      "id,title,authorships,abstract_inverted_index,publication_date,doi,primary_location,type",
  });

  const mailto = getMailto();
  if (mailto) {
    params.set("mailto", mailto);
  }

  const res = await fetch(
    `${OPENALEX_API_BASE}/works?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("OpenAlex API rate limit exceeded");
    }
    throw new Error(`OpenAlex API error: ${res.status}`);
  }

  const data = await res.json();

  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results
    .filter((item: OpenAlexRawWork) => item.title)
    .map((item: OpenAlexRawWork): OpenAlexPaper => ({
      title: item.title,
      authors: (item.authorships || [])
        .map((a) => a.author?.display_name)
        .filter((name): name is string => !!name),
      abstract: reconstructAbstract(item.abstract_inverted_index),
      published: item.publication_date || null,
      doi: item.doi ? item.doi.replace("https://doi.org/", "") : null,
      url:
        item.primary_location?.landing_page_url ||
        item.id ||
        "",
      venue:
        item.primary_location?.source?.display_name || null,
    }));
}

/**
 * OpenAlexの inverted index形式のアブストラクトを復元する
 */
function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) {
    return null;
  }

  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }

  words.sort((a, b) => a[0] - b[0]);
  return words.map(([, word]) => word).join(" ") || null;
}

type OpenAlexRawWork = {
  id: string;
  title: string;
  authorships?: {
    author?: { display_name?: string };
  }[];
  abstract_inverted_index?: Record<string, number[]>;
  publication_date?: string;
  doi?: string;
  primary_location?: {
    landing_page_url?: string;
    source?: { display_name?: string };
  };
  type?: string;
};
