// Semantic Scholar API クライアント
// API docs: https://api.semanticscholar.org/api-docs/

export type SemanticScholarPaper = {
  title: string;
  authors: string[];
  abstract: string | null;
  published: string | null;
  doi: string | null;
  url: string;
  venue: string | null;
};

const S2_API_BASE = "https://api.semanticscholar.org/graph/v1";

/**
 * Semantic Scholar APIで論文を検索する
 * @param query 検索クエリ（キーワード）
 * @param limit 取得件数（デフォルト10、最大100）
 */
export async function searchSemanticScholar(
  query: string,
  limit: number = 10,
): Promise<SemanticScholarPaper[]> {
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(limit, 100)),
    fields:
      "title,authors,abstract,year,externalIds,url,venue,publicationDate",
  });

  const res = await fetch(
    `${S2_API_BASE}/paper/search?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Semantic Scholar API rate limit exceeded");
    }
    throw new Error(`Semantic Scholar API error: ${res.status}`);
  }

  const data = await res.json();

  if (!data.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data
    .filter((item: S2RawPaper) => item.title)
    .map((item: S2RawPaper) => ({
      title: item.title,
      authors: (item.authors || []).map(
        (a: { name: string }) => a.name,
      ),
      abstract: item.abstract || null,
      published: item.publicationDate?.slice(0, 10) || (item.year ? `${item.year}-01-01` : null),
      doi: item.externalIds?.DOI || null,
      url: item.url || `https://www.semanticscholar.org/paper/${item.paperId}`,
      venue: item.venue || null,
    }));
}

type S2RawPaper = {
  paperId: string;
  title: string;
  authors?: { name: string }[];
  abstract?: string;
  year?: number;
  publicationDate?: string;
  externalIds?: { DOI?: string };
  url?: string;
  venue?: string;
};
