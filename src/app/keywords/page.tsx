"use client";

import { useState, useEffect, useCallback } from "react";

type Keyword = {
  id: string;
  keyword: string;
  category: string | null;
  sources: string[];
  journals: string[];
  is_active: boolean;
  created_at: string;
};

const AVAILABLE_SOURCES = ["arXiv", "Semantic Scholar", "OpenAlex"];

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規追加フォーム
  const [showForm, setShowForm] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSources, setNewSources] = useState<string[]>(["arXiv"]);
  const [newJournals, setNewJournals] = useState<string[]>([]);
  const [newJournalInput, setNewJournalInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // 編集中のキーワード
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSources, setEditSources] = useState<string[]>([]);
  const [editJournals, setEditJournals] = useState<string[]>([]);
  const [editJournalInput, setEditJournalInput] = useState("");

  // 削除確認
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch("/api/keywords");
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords);
      }
    } catch {
      setError("キーワードの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  // キーワード追加
  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    setIsAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          category: newCategory.trim() || null,
          sources: newSources,
          journals: newJournals,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "追加に失敗しました");
        return;
      }

      setNewKeyword("");
      setNewCategory("");
      setNewSources(["arXiv"]);
      setNewJournals([]);
      setNewJournalInput("");
      setShowForm(false);
      await fetchKeywords();
    } catch {
      setError("追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  };

  // 有効/無効トグル
  const handleToggleActive = async (kw: Keyword) => {
    try {
      const res = await fetch(`/api/keywords/${kw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !kw.is_active }),
      });

      if (res.ok) {
        setKeywords((prev) =>
          prev.map((k) =>
            k.id === kw.id ? { ...k, is_active: !k.is_active } : k,
          ),
        );
      }
    } catch {
      setError("更新に失敗しました");
    }
  };

  // 編集開始
  const startEdit = (kw: Keyword) => {
    setEditingId(kw.id);
    setEditKeyword(kw.keyword);
    setEditCategory(kw.category || "");
    setEditSources([...kw.sources]);
    setEditJournals([...(kw.journals || [])]);
    setEditJournalInput("");
  };

  // 編集保存
  const handleSaveEdit = async () => {
    if (!editingId || !editKeyword.trim()) return;

    try {
      const res = await fetch(`/api/keywords/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: editKeyword.trim(),
          category: editCategory.trim() || null,
          sources: editSources,
          journals: editJournals,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        await fetchKeywords();
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
      const res = await fetch(`/api/keywords/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeywords((prev) => prev.filter((k) => k.id !== id));
        setDeletingId(null);
      } else {
        setError("削除に失敗しました");
      }
    } catch {
      setError("削除に失敗しました");
    }
  };

  // ソース選択のトグル
  const toggleSource = (
    sources: string[],
    setSources: (s: string[]) => void,
    source: string,
  ) => {
    if (sources.includes(source)) {
      if (sources.length > 1) {
        setSources(sources.filter((s) => s !== source));
      }
    } else {
      setSources([...sources, source]);
    }
  };

  // ジャーナル追加
  const handleAddJournal = (
    input: string,
    journals: string[],
    setJournals: (j: string[]) => void,
    setInput: (s: string) => void,
  ) => {
    const trimmed = input.trim();
    if (trimmed && !journals.includes(trimmed)) {
      setJournals([...journals, trimmed]);
    }
    setInput("");
  };

  // ジャーナル削除
  const handleRemoveJournal = (
    journal: string,
    journals: string[],
    setJournals: (j: string[]) => void,
  ) => {
    setJournals(journals.filter((j) => j !== journal));
  };

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
          キーワード管理
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
          キーワード管理
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "閉じる" : "キーワード追加"}
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
            新しいキーワードを追加
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                キーワード <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="例: transformer, attention mechanism"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                カテゴリ（任意）
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="例: 機械学習, 自然言語処理"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                検索対象ソース
              </label>
              <div className="flex gap-2">
                {AVAILABLE_SOURCES.map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() =>
                      toggleSource(newSources, setNewSources, source)
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      newSources.includes(source)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                対象ジャーナル（任意・部分一致）
              </label>
              {newJournals.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {newJournals.map((journal) => (
                    <span
                      key={journal}
                      className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >
                      {journal}
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveJournal(journal, newJournals, setNewJournals)
                        }
                        className="hover:text-green-900 dark:hover:text-green-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={newJournalInput}
                onChange={(e) => setNewJournalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddJournal(
                      newJournalInput,
                      newJournals,
                      setNewJournals,
                      setNewJournalInput,
                    );
                  }
                }}
                placeholder="ジャーナル名を入力してEnterで追加（例: Nature, Science）"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                空欄の場合は全てのジャーナルから収集します
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={isAdding || !newKeyword.trim()}
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

      {/* キーワード一覧 */}
      {keywords.length === 0 ? (
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
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            キーワードが登録されていません
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            「キーワード追加」ボタンから論文収集用のキーワードを登録してください
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keywords.map((kw) => (
            <div
              key={kw.id}
              className={`rounded-lg border p-4 ${
                kw.is_active
                  ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                  : "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/50"
              }`}
            >
              {editingId === kw.id ? (
                // 編集モード
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editKeyword}
                    onChange={(e) => setEditKeyword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="カテゴリ（任意）"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <div className="flex gap-2">
                    {AVAILABLE_SOURCES.map((source) => (
                      <button
                        key={source}
                        type="button"
                        onClick={() =>
                          toggleSource(editSources, setEditSources, source)
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          editSources.includes(source)
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {source}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                      対象ジャーナル（部分一致）
                    </label>
                    {editJournals.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {editJournals.map((journal) => (
                          <span
                            key={journal}
                            className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          >
                            {journal}
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveJournal(journal, editJournals, setEditJournals)
                              }
                              className="hover:text-green-900 dark:hover:text-green-200"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={editJournalInput}
                      onChange={(e) => setEditJournalInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddJournal(
                            editJournalInput,
                            editJournals,
                            setEditJournals,
                            setEditJournalInput,
                          );
                        }
                      }}
                      placeholder="ジャーナル名を入力してEnterで追加"
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
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {kw.keyword}
                      </span>
                      {kw.category && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {kw.category}
                        </span>
                      )}
                      {!kw.is_active && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          無効
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {kw.sources.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {s}
                        </span>
                      ))}
                      {kw.journals && kw.journals.length > 0 && kw.journals.map((j) => (
                        <span
                          key={j}
                          className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        >
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 有効/無効トグル */}
                    <button
                      onClick={() => handleToggleActive(kw)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        kw.is_active ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                      title={kw.is_active ? "無効にする" : "有効にする"}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          kw.is_active ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    {/* 編集 */}
                    <button
                      onClick={() => startEdit(kw)}
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
                    {deletingId === kw.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(kw.id)}
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
                        onClick={() => setDeletingId(kw.id)}
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
          登録したキーワードで定期的に論文を自動収集します。
          有効なキーワードのみが収集対象になります。
          検索対象ソースはarXiv、Semantic Scholar、OpenAlexから選択できます。
          対象ジャーナルを指定すると、そのジャーナルの論文のみ収集します（部分一致）。
        </p>
      </div>
    </div>
  );
}
