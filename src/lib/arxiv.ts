// arXiv API クライアント
// arXiv API: https://info.arxiv.org/help/api/index.html

export type ArxivPaper = {
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  doi: string | null;
  url: string;
  pdfUrl: string;
};

const ARXIV_API_BASE = "https://export.arxiv.org/api/query";

/**
 * arXiv APIで論文を検索する
 * @param query 検索クエリ（キーワード）
 * @param maxResults 取得件数（デフォルト10）
 */
export async function searchArxiv(
  query: string,
  maxResults: number = 10,
): Promise<ArxivPaper[]> {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: "0",
    max_results: String(maxResults),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  const res = await fetch(`${ARXIV_API_BASE}?${params.toString()}`, {
    headers: { Accept: "application/xml" },
  });

  if (!res.ok) {
    throw new Error(`arXiv API error: ${res.status}`);
  }

  const xml = await res.text();
  return parseArxivResponse(xml);
}

/**
 * arXiv Atom XMLレスポンスをパースする
 */
function parseArxivResponse(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];

  // <entry>...</entry> を抽出
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const title = extractTag(entry, "title")?.replace(/\s+/g, " ").trim() || "";
    const abstract =
      extractTag(entry, "summary")?.replace(/\s+/g, " ").trim() || "";
    const published = extractTag(entry, "published") || "";

    // 著者を抽出
    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>(.*?)<\/name>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    // URLを抽出（abs URL）
    const url = extractLinkHref(entry, "alternate") || "";

    // PDF URLを抽出
    const pdfUrl =
      extractLinkHref(entry, "related", "application/pdf") || "";

    // DOIを抽出
    const doi = extractDoi(entry);

    if (title) {
      papers.push({
        title,
        authors,
        abstract,
        published: published.slice(0, 10), // YYYY-MM-DD
        doi,
        url,
        pdfUrl,
      });
    }
  }

  return papers;
}

function extractTag(xml: string, tag: string): string | null {
  // arXiv uses namespaced tags, handle both with and without namespace
  const regex = new RegExp(`<(?:[a-z]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-z]+:)?${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function extractLinkHref(
  xml: string,
  rel: string,
  type?: string,
): string | null {
  const typeFilter = type ? `[^>]*type="${type}"` : "";
  const regex = new RegExp(
    `<link[^>]*rel="${rel}"${typeFilter}[^>]*href="([^"]*)"`,
    "i",
  );
  const match = regex.exec(xml);
  if (match) return match[1];

  // Try reversed attribute order
  const regex2 = new RegExp(
    `<link[^>]*href="([^"]*)"[^>]*rel="${rel}"${typeFilter}`,
    "i",
  );
  const match2 = regex2.exec(xml);
  return match2 ? match2[1] : null;
}

function extractDoi(entry: string): string | null {
  // arXiv sometimes includes DOI in <arxiv:doi> tag
  const doiMatch = /<arxiv:doi[^>]*>(.*?)<\/arxiv:doi>/i.exec(entry);
  if (doiMatch) return doiMatch[1].trim();

  // Or in <link> with doi.org
  const linkMatch = /href="https?:\/\/dx\.doi\.org\/([^"]+)"/i.exec(entry);
  if (linkMatch) return decodeURIComponent(linkMatch[1]);

  return null;
}
