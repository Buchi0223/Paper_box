"use client";

import { useState, useEffect, useCallback } from "react";

type RssFeed = {
  id: string;
  name: string;
  feed_url: string;
  is_active: boolean;
  last_fetched_at: string | null;
  created_at: string;
};

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規追加フォーム
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // 編集中のフィード
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFeedUrl, setEditFeedUrl] = useState("");

  // 削除確認
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/feeds");
      if (res.ok) {
        const data = await res.json();
        setFeeds(data.feeds);
      }
    } catch {
      setError("フィードの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  // フィード追加
  const handleAdd = async () => {
    if (!newName.trim() || !newFeedUrl.trim()) return;
    setIsAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          feed_url: newFeedUrl.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "追加に失敗しました");
        return;
      }

      setNewName("");
      setNewFeedUrl("");
      setShowForm(false);
      await fetchFeeds();
    } catch {
      setError("追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  };

  // 有効/無効トグル
  const handleToggleActive = async (feed: RssFeed) => {
    try {
      const res = await fetch(`/api/feeds/${feed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !feed.is_active }),
      });

      if (res.ok) {
        setFeeds((prev) =>
          prev.map((f) =>
            f.id === feed.id ? { ...f, is_active: !f.is_active } : f,
          ),
        );
      }
    } catch {
      setError("更新に失敗しました");
    }
  };

  // 編集開始
  const startEdit = (feed: RssFeed) => {
    setEditingId(feed.id);
    setEditName(feed.name);
    setEditFeedUrl(feed.feed_url);
  };

  // 編集保存
  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editFeedUrl.trim()) return;

    try {
      const res = await fetch(`/api/feeds/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          feed_url: editFeedUrl.trim(),
        }),
      });

      if (res.ok) {
        setEditingId(null);
        await fetchFeeds();
      } else {
        const data = await res.json();
        setError(data.error || "更新に失敗しました");
      }
    } catch {
      setError("更新に失敗しました");
    }
  };

  // 削除
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/feeds/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFeeds((prev) => prev.filter((f) => f.id !== id));
        setDeletingId(null);
      } else {
        setError("削除に失敗しました");
      }
    } catch {
      setError("削除に失敗しました");
    }
  };

  // URL省略表示
  const truncateUrl = (url: string, maxLen: number = 50) => {
    if (url.length <= maxLen) return url;
    return url.slice(0, maxLen) + "...";
  };

  // 日時フォーマット
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "未取得";
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
          RSSフィード管理
        </h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          RSSフィード管理
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "閉じる" : "フィード追加"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* 新規追加フォーム */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-800 dark:bg-blue-900/10">
          <h2 className="mb-3 text-sm font-medium text-blue-700 dark:text-blue-300">
            新しいRSSフィードを追加
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                フィード名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: Nature - Latest Research"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                Feed URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="例: https://www.nature.com/nature.rss"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={isAdding || !newName.trim() || !newFeedUrl.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isAdding ? "追加中..." : "追加"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フィード一覧 */}
      {feeds.length === 0 ? (
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
              d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            RSSフィードが登録されていません
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            「フィード追加」ボタンからRSSフィードを登録してください
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              className={`rounded-lg border p-4 ${
                feed.is_active
                  ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                  : "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/50"
              }`}
            >
              {editingId === feed.id ? (
                // 編集モード
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                      フィード名
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                      Feed URL
                    </label>
                    <input
                      type="url"
                      value={editFeedUrl}
                      onChange={(e) => setEditFeedUrl(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {feed.name}
                      </span>
                      {!feed.is_active && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          無効
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {truncateUrl(feed.feed_url)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      最終取得: {formatDate(feed.last_fetched_at)}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    {/* 有効/無効トグル */}
                    <button
                      onClick={() => handleToggleActive(feed)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        feed.is_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                      title={feed.is_active ? "無効にする" : "有効にする"}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          feed.is_active ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    {/* 編集 */}
                    <button
                      onClick={() => startEdit(feed)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      title="編集"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    {/* 削除 */}
                    {deletingId === feed.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(feed.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          削除する
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(feed.id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="削除"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 説明テキスト */}
      <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          登録したRSSフィードから定期的に新着論文を自動収集します。
          有効なフィードのみが収集対象になります。
        </p>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          代表的なFeed URL例:
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-gray-400 dark:text-gray-500">
          <li>Nature: https://www.nature.com/nature.rss</li>
          <li>arXiv CS.AI: https://rss.arxiv.org/rss/cs.AI</li>
          <li>Science: https://www.sciencemag.org/rss/current.xml</li>
        </ul>
      </div>
    </div>
  );
}
