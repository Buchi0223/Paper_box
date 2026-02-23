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

type ScoringSettings = {
  auto_approve_threshold: number;
  auto_skip_threshold: number;
  scoring_enabled: boolean;
  auto_collect_enabled: boolean;
};

type ScoringMetrics = {
  total_reviews: number;
  score_gap: number | null;
  accuracy: number | null;
  precision_at_10: number | null;
  avg_approved_score: number | null;
  avg_skipped_score: number | null;
};

export default function SettingsPage() {
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<CollectSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // スコアリング設定
  const [scoringSettings, setScoringSettings] = useState<ScoringSettings>({
    auto_approve_threshold: 70,
    auto_skip_threshold: 30,
    scoring_enabled: true,
    auto_collect_enabled: true,
  });
  const [isLoadingScoring, setIsLoadingScoring] = useState(true);
  const [isSavingScoring, setIsSavingScoring] = useState(false);
  const [scoringMessage, setScoringMessage] = useState<string | null>(null);

  // スコアリング精度メトリクス
  const [metrics, setMetrics] = useState<ScoringMetrics | null>(null);

  const fetchScoringSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/review");
      if (res.ok) {
        const data = await res.json();
        setScoringSettings({
          auto_approve_threshold: data.auto_approve_threshold ?? 70,
          auto_skip_threshold: data.auto_skip_threshold ?? 30,
          scoring_enabled: data.scoring_enabled ?? true,
          auto_collect_enabled: data.auto_collect_enabled ?? true,
        });
      }
    } catch {
      // 設定取得失敗は無視（デフォルト値を使用）
    } finally {
      setIsLoadingScoring(false);
    }
  }, []);

  const handleSaveScoring = async () => {
    setIsSavingScoring(true);
    setScoringMessage(null);
    try {
      const res = await fetch("/api/settings/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scoringSettings),
      });
      if (res.ok) {
        setScoringMessage("設定を保存しました");
        setTimeout(() => setScoringMessage(null), 3000);
      } else {
        setScoringMessage("設定の保存に失敗しました");
      }
    } catch {
      setScoringMessage("設定の保存に失敗しました");
    } finally {
      setIsSavingScoring(false);
    }
  };

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

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/review/metrics");
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch {
      // メトリクス取得失敗は無視
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchScoringSettings();
    fetchMetrics();
  }, [fetchLogs, fetchScoringSettings, fetchMetrics]);

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

      {/* AIスコアリング設定 */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          AIスコアリング設定
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          RSS収集時にAIが論文の関連度をスコアリングし、自動で承認/スキップします。
        </p>

        {isLoadingScoring ? (
          <div className="h-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ) : (
          <div className="space-y-5">
            {/* 有効/無効トグル */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                スコアリング
              </span>
              <button
                onClick={() =>
                  setScoringSettings((prev) => ({
                    ...prev,
                    scoring_enabled: !prev.scoring_enabled,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  scoringSettings.scoring_enabled
                    ? "bg-blue-600"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    scoringSettings.scoring_enabled
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* 自動承認しきい値 */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  自動承認しきい値
                </label>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  {scoringSettings.auto_approve_threshold}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={scoringSettings.auto_approve_threshold}
                onChange={(e) =>
                  setScoringSettings((prev) => ({
                    ...prev,
                    auto_approve_threshold: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-green-600"
              />
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                このスコア以上の論文を自動承認します
              </p>
            </div>

            {/* 自動スキップしきい値 */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  自動スキップしきい値
                </label>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  {scoringSettings.auto_skip_threshold}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={scoringSettings.auto_skip_threshold}
                onChange={(e) =>
                  setScoringSettings((prev) => ({
                    ...prev,
                    auto_skip_threshold: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-red-600"
              />
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                このスコア以下の論文を自動スキップします
              </p>
            </div>

            {/* 説明テキスト */}
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                スコア {scoringSettings.auto_approve_threshold} 以上 → 自動承認（論文一覧に表示）
                <br />
                スコア {scoringSettings.auto_skip_threshold + 1}〜{scoringSettings.auto_approve_threshold - 1} → 手動レビュー対象
                <br />
                スコア {scoringSettings.auto_skip_threshold} 以下 → 自動スキップ
              </p>
            </div>

            {/* 保存ボタン */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveScoring}
                disabled={isSavingScoring}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingScoring ? "保存中..." : "設定を保存"}
              </button>
              {scoringMessage && (
                <span
                  className={`text-sm ${
                    scoringMessage.includes("失敗")
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {scoringMessage}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* スコアリング精度 */}
      {metrics && metrics.total_reviews > 0 && (
        <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            スコアリング精度
          </h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            手動レビュー {metrics.total_reviews} 件のフィードバックに基づく精度指標
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                scoreGap
              </p>
              <p className={`text-xl font-bold ${
                metrics.score_gap !== null && metrics.score_gap >= 30
                  ? "text-green-600 dark:text-green-400"
                  : metrics.score_gap !== null && metrics.score_gap >= 15
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}>
                {metrics.score_gap ?? "—"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                目標: 30以上
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                正解率
              </p>
              <p className={`text-xl font-bold ${
                metrics.accuracy !== null && metrics.accuracy >= 85
                  ? "text-green-600 dark:text-green-400"
                  : metrics.accuracy !== null && metrics.accuracy >= 70
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}>
                {metrics.accuracy !== null ? `${metrics.accuracy}%` : "—"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                目標: 85%以上
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Precision@10
              </p>
              <p className={`text-xl font-bold ${
                metrics.precision_at_10 !== null && metrics.precision_at_10 >= 80
                  ? "text-green-600 dark:text-green-400"
                  : metrics.precision_at_10 !== null && metrics.precision_at_10 >= 60
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}>
                {metrics.precision_at_10 !== null
                  ? `${metrics.precision_at_10}%`
                  : "—"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                目標: 80%以上
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                平均スコア
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  承認{metrics.avg_approved_score ?? "—"}
                </span>
                <span className="text-xs text-gray-400">/</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                  棄却{metrics.avg_skipped_score ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 手動収集セクション */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          論文収集
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          登録済みのキーワードで論文を検索し、AI処理後にデータベースに保存します。
        </p>

        {/* 自動収集 ON/OFF */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Cron自動収集
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {scoringSettings.auto_collect_enabled
                ? "毎日 6:00 UTC に自動実行されます"
                : "自動収集は停止中です（手動実行は可能）"}
            </p>
          </div>
          <button
            onClick={() => {
              const next = !scoringSettings.auto_collect_enabled;
              setScoringSettings((prev) => ({
                ...prev,
                auto_collect_enabled: next,
              }));
              // 即座に保存
              fetch("/api/settings/review", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ auto_collect_enabled: next }),
              });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              scoringSettings.auto_collect_enabled
                ? "bg-blue-600"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                scoringSettings.auto_collect_enabled
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

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
