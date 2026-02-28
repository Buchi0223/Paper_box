import Link from "next/link";
import type { Paper } from "@/types/database";
import FavoriteButton from "./FavoriteButton";

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "著者不明";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

function truncate(text: string | null, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

const sourceBadge: Record<string, { label: string; className: string }> = {
  arxiv: { label: "arXiv", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  semantic_scholar: { label: "Semantic Scholar", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  openalex: { label: "OpenAlex", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rss: { label: "RSS", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  manual: { label: "手動", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  citation: { label: "引用発見", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
};

function getSourceBadge(source: string) {
  return sourceBadge[source] ?? { label: source, className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
}

export default function PaperCard({ paper }: { paper: Paper }) {
  return (
    <Link href={`/papers/${paper.id}`} className="block">
      <article className="group rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold leading-snug text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            {paper.title_ja || paper.title_original}
          </h3>
          <FavoriteButton paperId={paper.id} initialFavorite={paper.is_favorite} />
        </div>

        {paper.title_ja && (
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">{paper.title_original}</p>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatAuthors(paper.authors)}</span>
          {paper.published_date && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{paper.published_date}</span>
            </>
          )}
          {paper.journal && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{paper.journal}</span>
            </>
          )}
        </div>

        {paper.summary_ja && (
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {truncate(paper.summary_ja, 150)}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getSourceBadge(paper.source).className}`}>
            {getSourceBadge(paper.source).label}
          </span>
          {paper.review_status === "auto_approved" && (
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              AI推薦
            </span>
          )}
          {paper.memo && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              メモあり
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
