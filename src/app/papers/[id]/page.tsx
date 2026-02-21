"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Paper } from "@/types/database";
import FavoriteButton from "@/components/FavoriteButton";
import { useToast } from "@/components/Toast";

export default function PaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memo, setMemo] = useState("");
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchPaper = async () => {
      const res = await fetch(`/api/papers/${id}`);
      if (!res.ok) {
        setError("論文が見つかりません");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setPaper(data);
      setMemo(data.memo || "");
      setIsLoading(false);
    };
    fetchPaper();
  }, [id]);

  const saveMemo = async () => {
    setIsSavingMemo(true);
    const res = await fetch(`/api/papers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPaper(updated);
      showToast("メモを保存しました", "success");
    } else {
      showToast("メモの保存に失敗しました", "error");
    }
    setIsSavingMemo(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/papers/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("論文を削除しました", "success");
        router.push("/");
      } else {
        showToast("削除に失敗しました", "error");
        setShowDeleteConfirm(false);
      }
    } catch {
      showToast("削除に失敗しました", "error");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (error || !paper) {
    return (
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
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="mb-4 text-gray-500 dark:text-gray-400">{error || "論文が見つかりません"}</p>
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
          一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
            {paper.title_ja || paper.title_original}
          </h1>
          {paper.title_ja && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{paper.title_original}</p>
          )}
        </div>
        <FavoriteButton paperId={paper.id} initialFavorite={paper.is_favorite} />
      </div>

      {/* メタ情報 */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
        {paper.authors.length > 0 && <span>{paper.authors.join(", ")}</span>}
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
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs dark:bg-gray-800">
          {paper.source}
        </span>
      </div>

      {/* 元論文リンク */}
      {paper.url && (
        <div className="mb-6 flex flex-wrap gap-3">
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            元論文を読む
          </a>
          {paper.google_drive_url && (
            <a
              href={paper.google_drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Google Driveで開く
            </a>
          )}
        </div>
      )}

      {/* 要約 */}
      {paper.summary_ja && (
        <section className="mb-6 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">要約</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
            {paper.summary_ja}
          </p>
        </section>
      )}

      {/* 解説 */}
      {paper.explanation_ja && (
        <section className="mb-6 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">解説</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
            {paper.explanation_ja}
          </p>
        </section>
      )}

      {/* メモ */}
      <section className="mb-6 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">メモ</h2>
          <button
            onClick={saveMemo}
            disabled={isSavingMemo}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {isSavingMemo ? "保存中..." : "保存"}
          </button>
        </div>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="この論文に関するメモを入力..."
          rows={4}
          className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
        />
      </section>

      {/* DOI + 削除 */}
      <div className="flex items-center justify-between">
        {paper.doi ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">DOI: {paper.doi}</p>
        ) : (
          <div />
        )}

        {/* 削除ボタン */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            この論文を削除
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-900/20">
            <span className="text-sm text-red-700 dark:text-red-400">
              本当に削除しますか？
            </span>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "削除中..." : "削除する"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
