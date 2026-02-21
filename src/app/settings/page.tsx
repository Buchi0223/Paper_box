"use client";

import { useState, useEffect, useCallback } from "react";

type CollectionLog = {
  id: string;
  keyword_id: string;
  status: string;
  papers_found: number;
  message: string | null;
  executed_at: string;
  keywords: { keyword: string } | null;
};

type CollectSummary = {
  keywords_processed: number;
  total_papers_found: number;
  errors: number;
};

export default function SettingsPage() {
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<CollectSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/collect/logs?limit=30");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ログ取得失敗は無視
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 手動収集実行
  const handleCollect = async () => {
    setIsCollecting(true);
    setError(null);
    setCollectResult(null);

    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "収集に失敗しました");
        return;
      }

      setCollectResult(data.summary);
      await fetchLogs();
    } catch {
      setError("収集処理に失敗しました");
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        設定
      </h1>

      {/* 手動収集セクション */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          論文収集
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          登録済みのキーワードで論文を検索し、AI処理後にデータベースに保存します。
          Vercel Cron Jobにより毎日6:00（UTC）に自動実行されます。
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {collectResult && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              収集完了
            </p>
            <p className="text-xs text-green-600 dark:text-green-500">
              {collectResult.keywords_processed}件のキーワードを処理 /{" "}
              {collectResult.total_papers_found}件の論文を新規登録
              {collectResult.errors > 0 &&
                ` / ${collectResult.errors}件のエラー`}
            </p>
          </div>
        )}

        <button
          onClick={handleCollect}
          disabled={isCollecting}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isCollecting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              収集中...（時間がかかる場合があります）
            </span>
          ) : (
            "今すぐ収集を実行"
          )}
        </button>
      </section>

      {/* Cronスケジュール */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          自動収集スケジュール
        </h2>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <svg
                className="h-4 w-4 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                毎日 6:00 UTC（15:00 JST）
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vercel Cron Jobで自動実行
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 収集ログ */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          収集ログ
        </h2>

        {isLoadingLogs ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
              />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            収集ログはまだありません
          </p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      log.status === "success"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <div>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {log.keywords?.keyword || "不明"}
                    </span>
                    {log.message && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {log.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(log.executed_at).toLocaleString("ja-JP")}
                  </span>
                  {log.papers_found > 0 && (
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {log.papers_found}件
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 環境変数情報 */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          API設定
        </h2>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          API キーは環境変数（.env.local / Vercel Dashboard）で管理しています。
        </p>
        <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-1 font-mono dark:bg-gray-800">
              OPENAI_API_KEY
            </span>
            <span>— OpenAI API（要約・解説・翻訳生成）</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-1 font-mono dark:bg-gray-800">
              GOOGLE_SERVICE_ACCOUNT_KEY
            </span>
            <span>— Google Drive PDF保存</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-1 font-mono dark:bg-gray-800">
              CRON_SECRET
            </span>
            <span>— Cron Job認証トークン</span>
          </div>
        </div>
      </section>
    </div>
  );
}
