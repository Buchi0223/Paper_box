"use client";

import { useEffect, useState, Suspense } from "react";
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

function FavoritesContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PapersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: "20",
      sort: "collected_at",
      order: "desc",
      favorite: "true",
    });
    if (search) params.set("search", search);

    fetch(`/api/papers?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, search]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">お気に入り</h1>
      </div>

      <div className="mb-6">
        <SearchBar />
      </div>

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
          <p className="text-gray-500 dark:text-gray-400">
            お気に入りの論文がありません。
            <br />
            論文一覧から星アイコンをクリックしてお気に入りに追加できます。
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {data.total}件のお気に入り
          </p>
          <div className="space-y-3">
            {data.papers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
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

export default function FavoritesPage() {
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
      <FavoritesContent />
    </Suspense>
  );
}
