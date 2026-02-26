"use client";

import { useState, useEffect, useCallback } from "react";
import type { Paper } from "@/types/database";

type ReviewResponse = {
  papers: Paper[];
  total_pending: number;
  total_auto_skipped: number;
};

type TabType = "pending" | "auto_skipped";

export default function ReviewPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [totalAutoSkipped, setTotalAutoSkipped] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [sortOrder, setSortOrder] = useState<"score_desc" | "date_desc">(
    "score_desc",
  );
  const [error, setError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [isBulkActioning, setIsBulkActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("pending");

  const handleBulkApprove = async () => {
    if (isBulkActioning) return;
    setIsBulkActioning(true);
    setBulkMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/papers/review/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_all_auto", min_score: 70 }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkMessage(`${data.affected_count}件を一括承認しました`);
        await fetchPapers();
      } else {
        setError(data.error || "一括操作に失敗しました");
      }
    } catch {
      setError("一括操作に失敗しました");
    } finally {
      setIsBulkActioning(false);
    }
  };

  const fetchPapers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/papers/review?status=${activeTab}&sort=${sortOrder}&limit=50`,
      );
      if (res.ok) {
        const data: ReviewResponse = await res.json();
        setPapers(data.papers);
        setTotalPending(data.total_pending);
        setTotalAutoSkipped(data.total_auto_skipped);
        setCurrentIndex(0);
      } else {
        setError("論文の取得に失敗しました");
      }
    } catch {
      setError("論文の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [sortOrder, activeTab]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // キーボードショートカット（レビュー待ちタブでのみ有効）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        activeTab !== "pending" ||
        isActioning ||
        papers.length === 0 ||
        currentIndex >= papers.length
      )
        return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleReview("approve");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleReview("skip");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleReview = async (action: "approve" | "skip") => {
    if (isActioning || currentIndex >= papers.length) return;

    const paper = papers[currentIndex];
    setIsActioning(true);
    setError(null);

    try {
      const res = await fetch("/api/papers/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_id: paper.id, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "レビュー処理に失敗しました");
        return;
      }

      setTotalPending((prev) => prev - 1);
      setCurrentIndex((prev) => prev + 1);
    } catch {
      setError("レビュー処理に失敗しました");
    } finally {
      setIsActioning(false);
    }
  };

  const handleAutoSkippedAction = async (
    action: "restore" | "skip",
    paperId: string,
  ) => {
    if (isActioning) return;
    setIsActioning(true);
    setError(null);

    try {
      const res = await fetch("/api/papers/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_id: paperId, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "処理に失敗しました");
        return;
      }

      // リストから除去して件数を更新
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
      setTotalAutoSkipped((prev) => prev - 1);
      if (action === "restore") {
        setTotalPending((prev) => prev + 1);
      }
    } catch {
      setError("処理に失敗しました");
    } finally {
      setIsActioning(false);
    }
  };

  const currentPaper = papers[currentIndex];
  const reviewed = currentIndex;
  const remaining = totalPending - reviewed;

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
          論文レビュー
        </h1>
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          論文レビュー
        </h1>
        <div className="flex items-center gap-2">
          {activeTab === "pending" && (
            <button
              onClick={handleBulkApprove}
              disabled={isBulkActioning || totalPending === 0}
              className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
            >
              {isBulkActioning ? "処理中..." : "スコア70以上を全て承認"}
            </button>
          )}
          <select
            value={sortOrder}
            onChange={(e) =>
              setSortOrder(e.target.value as "score_desc" | "date_desc")
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="score_desc">スコア順</option>
            <option value="date_desc">新着順</option>
          </select>
        </div>
      </div>

      {/* タブ */}
      <div className="mb-6 flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "pending"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          レビュー待ち
          <span
            className={`ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              activeTab === "pending"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {totalPending}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("auto_skipped")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "auto_skipped"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          自動スキップ済み
          <span
            className={`ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              activeTab === "auto_skipped"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {totalAutoSkipped}
          </span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {bulkMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          {bulkMessage}
        </div>
      )}

      {/* レビュー待ちタブ */}
      {activeTab === "pending" && (
        <>
          {!currentPaper || currentIndex >= papers.length ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center dark:border-gray-700">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                {totalPending === 0
                  ? "未レビューの論文はありません"
                  : "現在のバッチをすべてレビューしました"}
              </p>
              {totalPending > 0 && currentIndex >= papers.length && (
                <button
                  onClick={fetchPapers}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  次のバッチを読み込む
                </button>
              )}
            </div>
          ) : (
            <PaperReviewCard
              paper={currentPaper}
              currentIndex={currentIndex}
              totalInBatch={papers.length}
              isActioning={isActioning}
              onApprove={() => handleReview("approve")}
              onSkip={() => handleReview("skip")}
            />
          )}
        </>
      )}

      {/* 自動スキップ済みタブ */}
      {activeTab === "auto_skipped" && (
        <>
          {papers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center dark:border-gray-700">
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                自動スキップされた論文はありません
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {papers.map((paper) => (
                <AutoSkippedCard
                  key={paper.id}
                  paper={paper}
                  isActioning={isActioning}
                  onRestore={() =>
                    handleAutoSkippedAction("restore", paper.id)
                  }
                  onConfirmSkip={() =>
                    handleAutoSkippedAction("skip", paper.id)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** レビュー待ちタブ用の論文カード（スワイプ式） */
function PaperReviewCard({
  paper,
  currentIndex,
  totalInBatch,
  isActioning,
  onApprove,
  onSkip,
}: {
  paper: Paper;
  currentIndex: number;
  totalInBatch: number;
  isActioning: boolean;
  onApprove: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <PaperCardContent paper={paper} />
      </div>

      {/* アクションボタン */}
      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          onClick={onSkip}
          disabled={isActioning}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-gray-500 shadow-md transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="スキップ（← キー）"
        >
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <span className="text-sm text-gray-400 dark:text-gray-500">
          {currentIndex + 1} / {totalInBatch}
        </span>

        <button
          onClick={onApprove}
          disabled={isActioning}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-300 bg-white text-gray-500 shadow-md transition-all hover:border-green-400 hover:bg-green-50 hover:text-green-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-green-400 dark:hover:bg-green-900/20 dark:hover:text-green-400"
          title="興味あり（→ キー）"
        >
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      </div>

      {/* ショートカットヒント */}
      <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
        キーボード: ← スキップ / → 興味あり
      </p>
    </div>
  );
}

/** 自動スキップ済みタブ用のカード（リスト表示） */
function AutoSkippedCard({
  paper,
  isActioning,
  onRestore,
  onConfirmSkip,
}: {
  paper: Paper;
  isActioning: boolean;
  onRestore: () => void;
  onConfirmSkip: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <PaperCardContent paper={paper} />

      {/* アクションボタン */}
      <div className="mt-4 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button
          onClick={onConfirmSkip}
          disabled={isActioning}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          スキップ確定
        </button>
        <button
          onClick={onRestore}
          disabled={isActioning}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          レビュー対象に戻す
        </button>
      </div>
    </div>
  );
}

/** 論文カードの共通コンテンツ */
function PaperCardContent({ paper }: { paper: Paper }) {
  return (
    <>
      {/* スコア表示 */}
      {paper.relevance_score !== null &&
        paper.relevance_score !== undefined && (
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                paper.relevance_score >= 70
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : paper.relevance_score >= 40
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              スコア: {paper.relevance_score}
            </span>
          </div>
        )}

      {/* タイトル */}
      <h2 className="mb-2 text-xl font-bold leading-snug text-gray-900 dark:text-white">
        {paper.title_ja || paper.title_original}
      </h2>
      {paper.title_ja && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {paper.title_original}
        </p>
      )}

      {/* メタ情報 */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
        {paper.authors.length > 0 && (
          <span>
            {paper.authors.length <= 3
              ? paper.authors.join(", ")
              : `${paper.authors.slice(0, 3).join(", ")} et al.`}
          </span>
        )}
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

      {/* 出典 */}
      <div className="mb-4">
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {paper.source}
        </span>
      </div>

      {/* 要約 */}
      {paper.summary_ja && (
        <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            要約
          </p>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {paper.summary_ja}
          </p>
        </div>
      )}

      {/* 論文リンク */}
      {paper.url && (
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          論文を開く
        </a>
      )}
    </>
  );
}
