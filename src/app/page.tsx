"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Paper } from "@/types/database";
import PaperCard from "@/components/PaperCard";
import SearchBar from "@/components/SearchBar";
import Pagination from "@/components/Pagination";

type PapersResponse = {
  papers: Paper[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function PaperListContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PapersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const keywordId = searchParams.get("keyword_id") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const fetchPapers = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
      sort: "collected_at",
      order: sortOrder,
    });
    if (search) params.set("search", search);
    if (keywordId) params.set("keyword_id", keywordId);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);

    const res = await fetch(`/api/papers?${params}`);
    const json = await res.json();
    setData(json);
    setIsLoading(false);
  }, [page, search, sortOrder, keywordId, dateFrom, dateTo]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // 日付ごとにグルーピング
  const groupByDate = (papers: Paper[]) => {
    const groups: Record<string, Paper[]> = {};
    for (const paper of papers) {
      const date = paper.collected_at.split("T")[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(paper);
    }
    return groups;
  };

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);

    const diff = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (diff === 0) return `${formatted}（今日）`;
    if (diff === 1) return `${formatted}（昨日）`;
    return formatted;
  };

  const hasFilters = !!(search || keywordId || dateFrom || dateTo);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">論文一覧</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {sortOrder === "desc" ? "新しい順" : "古い順"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <SearchBar />
      </div>

      {hasFilters && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {search ? `「${search}」の` : ""}検索結果: {data?.total ?? 0}件
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
            />
          ))}
        </div>
      ) : !data || data.papers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {hasFilters ? "条件に一致する論文がありません。" : "論文がまだ登録されていません。"}
          </p>
          {!hasFilters && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              キーワードを登録して自動収集するか、手動で論文を登録してください。
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {Object.entries(groupByDate(data.papers)).map(([date, papers]) => (
              <section key={date}>
                <h2 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {formatDateLabel(date)}
                </h2>
                <div className="space-y-3">
                  {papers.map((paper) => (
                    <PaperCard key={paper.id} paper={paper} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8">
            <Pagination currentPage={data.page} totalPages={data.totalPages} />
          </div>
        </>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
            />
          ))}
        </div>
      }
    >
      <PaperListContent />
    </Suspense>
  );
}
