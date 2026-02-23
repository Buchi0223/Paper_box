"use client";

import { useState, useEffect, useCallback } from "react";
import type { Interest } from "@/types/database";

type TabType = "manual" | "learned";

export default function InterestsPage() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("manual");

  // 新規追加フォーム
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newWeight, setNewWeight] = useState(1.0);
  const [isAdding, setIsAdding] = useState(false);

  // 編集中
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editWeight, setEditWeight] = useState(1.0);

  // 削除確認
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch("/api/interests");
      if (res.ok) {
        const data = await res.json();
        setInterests(data.interests);
      }
    } catch {
      setError("関心プロファイルの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  const filteredInterests = interests.filter((i) => i.type === activeTab);

  // 追加
  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setIsAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim(),
          weight: newWeight,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "追加に失敗しました");
        return;
      }

      setNewLabel("");
      setNewWeight(1.0);
      setShowForm(false);
      await fetchInterests();
    } catch {
      setError("追加に失敗しました");
    } finally {
      setIsAdding(false);
    }
  };

  // 編集開始
  const startEdit = (interest: Interest) => {
    setEditingId(interest.id);
    setEditLabel(interest.label);
    setEditWeight(interest.weight);
  };

  // 編集保存
  const handleSaveEdit = async () => {
    if (!editingId || !editLabel.trim()) return;

    try {
      const res = await fetch(`/api/interests/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim(),
          weight: editWeight,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        await fetchInterests();
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
      const res = await fetch(`/api/interests/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInterests((prev) => prev.filter((i) => i.id !== id));
        setDeletingId(null);
      } else {
        setError("削除に失敗しました");
      }
    } catch {
      setError("削除に失敗しました");
    }
  };

  // weight のバー表示（0.1〜2.0 を 0%〜100% にマッピング）
  const weightToPercent = (w: number) =>
    Math.min(100, Math.max(0, ((w - 0.1) / 1.9) * 100));

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
          関心プロファイル
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
          関心プロファイル
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
            関心キーワードを追加
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                キーワード / 分野名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="例: 交通工学, deep learning, 強化学習"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                重み: {newWeight.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>0.1（低い）</span>
                <span>1.0（標準）</span>
                <span>2.0（高い）</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={isAdding || !newLabel.trim()}
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

      {/* タブ切り替え */}
      <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("manual")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "manual"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          手動追加
          <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
            {interests.filter((i) => i.type === "manual").length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("learned")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "learned"
              ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          自動学習
          <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
            {interests.filter((i) => i.type === "learned").length}
          </span>
        </button>
      </div>

      {/* 一覧 */}
      {filteredInterests.length === 0 ? (
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
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {activeTab === "manual"
              ? "関心キーワードが登録されていません"
              : "自動学習されたキーワードはまだありません"}
          </p>
          {activeTab === "manual" && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              「キーワード追加」ボタンから関心のある分野やキーワードを登録してください
            </p>
          )}
          {activeTab === "learned" && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              レビューで「興味あり」を選択すると、AIが自動的にキーワードを学習します
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInterests.map((interest) => (
            <div
              key={interest.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              {editingId === interest.id ? (
                // 編集モード
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <div>
                    <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
                      重み: {editWeight.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={editWeight}
                      onChange={(e) =>
                        setEditWeight(parseFloat(e.target.value))
                      }
                      className="w-full accent-blue-600"
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
                        {interest.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          interest.type === "manual"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {interest.type === "manual" ? "手動" : "学習"}
                      </span>
                    </div>
                    {/* weight バー */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{
                            width: `${weightToPercent(interest.weight)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {interest.weight.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    {/* 編集 */}
                    <button
                      onClick={() => startEdit(interest)}
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
                    {deletingId === interest.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(interest.id)}
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
                        onClick={() => setDeletingId(interest.id)}
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
          関心プロファイルはAIスコアリングの基準として使用されます。
          手動でキーワードを追加するか、レビューの「興味あり」判定から自動学習されます。
          重みが高いほどスコアリング時に重視されます。
        </p>
      </div>
    </div>
  );
}
