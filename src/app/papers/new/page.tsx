"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AiResult = {
  title_ja: string;
  summary_ja: string;
  explanation_ja: string;
  total_tokens: number;
} | null;

export default function NewPaperPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfText, setPdfText] = useState<string>("");

  // AI処理関連
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult>(null);
  const [aiEdited, setAiEdited] = useState({
    title_ja: "",
    summary_ja: "",
    explanation_ja: "",
  });

  const [form, setForm] = useState({
    title_original: "",
    title_ja: "",
    authors: "",
    published_date: "",
    journal: "",
    doi: "",
    url: "",
    memo: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // PDF選択時にAIでメタデータ抽出
  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setIsParsing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pdf/parse", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        // AI抽出メタデータをフォームに自動入力（空の場合のみ）
        if (data.title && !form.title_original) {
          updateField("title_original", data.title);
        }
        if (data.authors?.length && !form.authors) {
          updateField("authors", Array.isArray(data.authors) ? data.authors.join(", ") : data.authors);
        }
        if (data.journal && !form.journal) {
          updateField("journal", data.journal);
        }
        if (data.published_date && !form.published_date) {
          updateField("published_date", data.published_date);
        }
        if (data.doi && !form.doi) {
          updateField("doi", data.doi);
        }
        if (data.text) {
          setPdfText(data.text);
        }
      }
    } catch {
      // PDF解析失敗は無視（手動入力で対応可能）
    } finally {
      setIsParsing(false);
    }
  };

  // AI処理を実行
  const handleAiProcess = async () => {
    if (!form.title_original.trim()) {
      setError("AI処理にはタイトル（原題）が必要です");
      return;
    }

    setIsAiProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_original: form.title_original.trim(),
          authors: form.authors
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          text: pdfText || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "AI処理に失敗しました");
        return;
      }

      const data = await res.json();
      setAiResult(data);
      setAiEdited({
        title_ja: data.title_ja || "",
        summary_ja: data.summary_ja || "",
        explanation_ja: data.explanation_ja || "",
      });

      // 日本語タイトルが空の場合はAI結果を自動反映
      if (!form.title_ja && data.title_ja) {
        updateField("title_ja", data.title_ja);
      }
    } catch {
      setError("AI処理に失敗しました。ネットワークを確認してください。");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Google DriveへPDFアップロード
  const uploadPdf = async (): Promise<string | null> => {
    if (!pdfFile) return null;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      const res = await fetch("/api/drive/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
      // Google Drive未設定時はスキップ
      return null;
    } catch {
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title_original.trim()) {
      setError("タイトル（原題）は必須です");
      return;
    }

    setIsSubmitting(true);

    try {
      // PDFがあればGoogle Driveにアップロード
      const googleDriveUrl = await uploadPdf();

      const body: Record<string, unknown> = {
        title_original: form.title_original.trim(),
        title_ja: (aiEdited.title_ja || form.title_ja).trim() || null,
        authors: form.authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        published_date: form.published_date || null,
        journal: form.journal.trim() || null,
        doi: form.doi.trim() || null,
        url: form.url.trim() || null,
        memo: form.memo.trim() || null,
        google_drive_url: googleDriveUrl,
        source: "manual",
      };

      // AI結果があれば含める
      if (aiResult) {
        body.summary_ja = aiEdited.summary_ja.trim() || null;
        body.explanation_ja = aiEdited.explanation_ja.trim() || null;
      }

      const res = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "登録に失敗しました");
        return;
      }

      const paper = await res.json();
      router.push(`/papers/${paper.id}`);
    } catch {
      setError("登録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
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

      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">論文登録</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* PDFアップロード */}
        <div className="rounded-lg border border-gray-200 p-5 dark:border-gray-700">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            PDFアップロード（任意）
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handlePdfSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-blue-900/30 dark:file:text-blue-400"
          />
          {isParsing && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
              <p className="text-xs text-blue-600 dark:text-blue-400">
                AIがPDFからメタデータを抽出しています...（タイトル・著者・DOI等）
              </p>
            </div>
          )}
          {pdfFile && !isParsing && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400">
              {pdfFile.name} を選択済み（Google Drive設定時に自動アップロードされます）
            </p>
          )}
        </div>

        {/* タイトル（原題）必須 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            タイトル（原題）<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title_original}
            onChange={(e) => updateField("title_original", e.target.value)}
            placeholder="例: Attention Is All You Need"
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* 日本語タイトル */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            日本語タイトル
          </label>
          <input
            type="text"
            value={form.title_ja}
            onChange={(e) => updateField("title_ja", e.target.value)}
            placeholder="例: 注意機構がすべて（AI生成で自動入力されます）"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* 著者 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            著者名（カンマ区切り）
          </label>
          <input
            type="text"
            value={form.authors}
            onChange={(e) => updateField("authors", e.target.value)}
            placeholder="例: Ashish Vaswani, Noam Shazeer, Niki Parmar"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* 発行日・ジャーナル名 横並び */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              発行日
            </label>
            <input
              type="date"
              value={form.published_date}
              onChange={(e) => updateField("published_date", e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              ジャーナル/会議名
            </label>
            <input
              type="text"
              value={form.journal}
              onChange={(e) => updateField("journal", e.target.value)}
              placeholder="例: NeurIPS 2017"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* DOI・URL 横並び */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              DOI
            </label>
            <input
              type="text"
              value={form.doi}
              onChange={(e) => updateField("doi", e.target.value)}
              placeholder="例: 10.48550/arXiv.1706.03762"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              元論文URL
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => updateField("url", e.target.value)}
              placeholder="例: https://arxiv.org/abs/1706.03762"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* メモ */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            メモ
          </label>
          <textarea
            value={form.memo}
            onChange={(e) => updateField("memo", e.target.value)}
            placeholder="この論文に関するメモを入力..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* AI処理セクション */}
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-5 dark:border-purple-800 dark:bg-purple-900/10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-purple-700 dark:text-purple-300">
              AI自動生成
            </h2>
            <button
              type="button"
              onClick={handleAiProcess}
              disabled={isAiProcessing || !form.title_original.trim()}
              className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isAiProcessing ? "生成中..." : aiResult ? "再生成" : "AI生成を実行"}
            </button>
          </div>

          {isAiProcessing && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  AIが要約・解説・タイトル翻訳を生成しています...
                </p>
              </div>
              <div className="space-y-2">
                <div className="h-4 animate-pulse rounded bg-purple-200/50 dark:bg-purple-700/30" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-purple-200/50 dark:bg-purple-700/30" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-purple-200/50 dark:bg-purple-700/30" />
              </div>
            </div>
          )}

          {!isAiProcessing && !aiResult && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              タイトルを入力後「AI生成を実行」ボタンを押すと、日本語タイトル・要約・解説が自動生成されます。
              PDFをアップロードするとより精度の高い結果が得られます。
            </p>
          )}

          {!isAiProcessing && aiResult && (
            <div className="space-y-4">
              {/* 日本語タイトル */}
              <div>
                <label className="mb-1 block text-xs font-medium text-purple-700 dark:text-purple-300">
                  日本語タイトル（AI生成）
                </label>
                <input
                  type="text"
                  value={aiEdited.title_ja}
                  onChange={(e) =>
                    setAiEdited((prev) => ({ ...prev, title_ja: e.target.value }))
                  }
                  className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-purple-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* 要約 */}
              <div>
                <label className="mb-1 block text-xs font-medium text-purple-700 dark:text-purple-300">
                  要約（AI生成）
                </label>
                <textarea
                  value={aiEdited.summary_ja}
                  onChange={(e) =>
                    setAiEdited((prev) => ({ ...prev, summary_ja: e.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-purple-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* 解説 */}
              <div>
                <label className="mb-1 block text-xs font-medium text-purple-700 dark:text-purple-300">
                  解説（AI生成）
                </label>
                <textarea
                  value={aiEdited.explanation_ja}
                  onChange={(e) =>
                    setAiEdited((prev) => ({ ...prev, explanation_ja: e.target.value }))
                  }
                  rows={6}
                  className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-purple-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                使用トークン数: {aiResult.total_tokens.toLocaleString()}
                　※内容は編集可能です。編集後の内容が登録されます。
              </p>
            </div>
          )}
        </div>

        {/* 送信ボタン */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isUploading || isAiProcessing}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting
              ? isUploading
                ? "アップロード中..."
                : "登録中..."
              : "論文を登録"}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
