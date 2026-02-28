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

const S2_FIELDS =
  "title,authors,abstract,year,externalIds,url,venue,publicationDate";

// レート制限ヘルパー（API Keyなしで1リクエスト/秒）
let lastRequestTime = 0;
async function rateLimitDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * DOIまたはタイトルからSemantic Scholar Paper IDを解決する
 * @returns paperId or null（見つからない場合）
 */
export async function resolveS2PaperId(
  doi: string | null,
  title: string,
): Promise<string | null> {
  await rateLimitDelay();

  try {
    if (doi) {
      const res = await fetch(
        `${S2_API_BASE}/paper/DOI:${encodeURIComponent(doi)}?fields=paperId`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const data = await res.json();
        return data.paperId || null;
      }
      if (res.status === 429) {
        throw new Error("Semantic Scholar API rate limit exceeded");
      }
      // 404 or other errors → fall through to title search
    }

    // タイトルで検索
    await rateLimitDelay();
    const params = new URLSearchParams({
      query: title,
      limit: "1",
      fields: "paperId",
    });
    const res = await fetch(`${S2_API_BASE}/paper/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Semantic Scholar API rate limit exceeded");
      }
      return null;
    }

    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].paperId || null;
    }
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("rate limit")) {
      throw error;
    }
    console.error("[S2] resolveS2PaperId error:", error);
    return null;
  }
}

/**
 * 指定論文を引用している論文（被引用）を取得する
 */
export async function fetchCitingPapers(
  paperId: string,
  limit: number = 10,
): Promise<SemanticScholarPaper[]> {
  await rateLimitDelay();

  try {
    const params = new URLSearchParams({
      fields: S2_FIELDS,
      limit: String(Math.min(limit, 100)),
    });
    const res = await fetch(
      `${S2_API_BASE}/paper/${paperId}/citations?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      if (res.status === 429) {
        throw new Error("Semantic Scholar API rate limit exceeded");
      }
      console.error(`[S2] fetchCitingPapers error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data
      .map((item: { citingPaper: S2RawPaper }) => item.citingPaper)
      .filter((p: S2RawPaper) => p && p.title)
      .map(normalizeS2Paper);
  } catch (error) {
    if (error instanceof Error && error.message.includes("rate limit")) {
      throw error;
    }
    console.error("[S2] fetchCitingPapers error:", error);
    return [];
  }
}

/**
 * 指定論文が引用している論文（参考文献）を取得する
 */
export async function fetchCitedPapers(
  paperId: string,
  limit: number = 10,
): Promise<SemanticScholarPaper[]> {
  await rateLimitDelay();

  try {
    const params = new URLSearchParams({
      fields: S2_FIELDS,
      limit: String(Math.min(limit, 100)),
    });
    const res = await fetch(
      `${S2_API_BASE}/paper/${paperId}/references?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      if (res.status === 429) {
        throw new Error("Semantic Scholar API rate limit exceeded");
      }
      console.error(`[S2] fetchCitedPapers error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data
      .map((item: { citedPaper: S2RawPaper }) => item.citedPaper)
      .filter((p: S2RawPaper) => p && p.title)
      .map(normalizeS2Paper);
  } catch (error) {
    if (error instanceof Error && error.message.includes("rate limit")) {
      throw error;
    }
    console.error("[S2] fetchCitedPapers error:", error);
    return [];
  }
}

/** S2RawPaperをSemanticScholarPaperに正規化する */
function normalizeS2Paper(item: S2RawPaper): SemanticScholarPaper {
  return {
    title: item.title,
    authors: (item.authors || []).map((a: { name: string }) => a.name),
    abstract: item.abstract || null,
    published:
      item.publicationDate?.slice(0, 10) ||
      (item.year ? `${item.year}-01-01` : null),
    doi: item.externalIds?.DOI || null,
    url:
      item.url ||
      `https://www.semanticscholar.org/paper/${item.paperId}`,
    venue: item.venue || null,
  };
}

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
    fields: S2_FIELDS,
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
    .map(normalizeS2Paper);
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
