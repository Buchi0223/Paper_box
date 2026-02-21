"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Keyword = {
  id: string;
  keyword: string;
  category: string | null;
};

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") || "");
  const [selectedKeyword, setSelectedKeyword] = useState(
    searchParams.get("keyword_id") || "",
  );
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  const hasActiveFilters = !!(
    searchParams.get("date_from") ||
    searchParams.get("date_to") ||
    searchParams.get("keyword_id")
  );

  // キーワード一覧を取得
  useEffect(() => {
    if (showFilters && keywords.length === 0) {
      fetch("/api/keywords")
        .then((res) => res.json())
        .then((data) => {
          if (data.keywords) setKeywords(data.keywords);
        })
        .catch(() => {});
    }
  }, [showFilters, keywords.length]);

  const applyFilters = (overrides?: {
    search?: string;
    date_from?: string;
    date_to?: string;
    keyword_id?: string;
  }) => {
    const params = new URLSearchParams();
    const s = overrides?.search ?? query;
    const df = overrides?.date_from ?? dateFrom;
    const dt = overrides?.date_to ?? dateTo;
    const kw = overrides?.keyword_id ?? selectedKeyword;

    if (s) params.set("search", s);
    if (df) params.set("date_from", df);
    if (dt) params.set("date_to", dt);
    if (kw) params.set("keyword_id", kw);

    router.push(`?${params.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleClear = () => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setSelectedKeyword("");
    router.push("?");
  };

  const handleClearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedKeyword("");
    applyFilters({ date_from: "", date_to: "", keyword_id: "" });
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・要約・メモで検索..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
          />
          {(query || hasActiveFilters) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          検索
        </button>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`rounded-lg border px-3 py-2 text-sm ${
            hasActiveFilters
              ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        </button>
      </form>

      {/* アクティブフィルタ表示 */}
      {hasActiveFilters && !showFilters && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">フィルタ:</span>
          {searchParams.get("keyword_id") && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {keywords.find((k) => k.id === searchParams.get("keyword_id"))?.keyword ||
                "キーワード"}
            </span>
          )}
          {searchParams.get("date_from") && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              {searchParams.get("date_from")}〜
            </span>
          )}
          {searchParams.get("date_to") && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              〜{searchParams.get("date_to")}
            </span>
          )}
          <button
            onClick={handleClearFilters}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
          >
            フィルタ解除
          </button>
        </div>
      )}

      {/* フィルタパネル */}
      {showFilters && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* キーワードフィルタ */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                キーワードタグ
              </label>
              <select
                value={selectedKeyword}
                onChange={(e) => setSelectedKeyword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">すべて</option>
                {keywords.map((kw) => (
                  <option key={kw.id} value={kw.id}>
                    {kw.keyword}
                    {kw.category ? ` (${kw.category})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 日付範囲 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                収集日（開始）
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                収集日（終了）
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                applyFilters();
                setShowFilters(false);
              }}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              フィルタ適用
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  handleClearFilters();
                  setShowFilters(false);
                }}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                フィルタ解除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
