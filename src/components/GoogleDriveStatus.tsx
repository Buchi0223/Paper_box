"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface GoogleDriveStatusProps {
  variant?: "header" | "settings";
}

export default function GoogleDriveStatus({
  variant = "settings",
}: GoogleDriveStatusProps) {
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/google/status");
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        setEmail(data.email);
      }
    } catch {
      // ステータス取得失敗は無視
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = () => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(pathname)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Google Drive接続を解除しますか？")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", {
        method: "POST",
      });
      if (res.ok) {
        setConnected(false);
        setEmail(null);
      }
    } catch {
      // 切断失敗
    } finally {
      setDisconnecting(false);
    }
  };

  // --- Header variant ---
  if (variant === "header") {
    if (loading) return null;

    return (
      <button
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={disconnecting}
        title={
          connected
            ? `Google Drive: ${email || "接続済み"}（クリックで切断）`
            : "Google Driveに接続"
        }
        className="rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
      >
        <svg
          className={`h-5 w-5 ${
            connected
              ? "text-green-600 dark:text-green-400"
              : "text-gray-400 dark:text-gray-500"
          }`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M7.71 3.5L1.15 15l4.58 3L12.29 6.5zM12 18.5l-3.58-3h7.16L19.16 18.5zM22.85 15L16.29 3.5h-4.58L18.27 15z" />
        </svg>
      </button>
    );
  }

  // --- Settings variant ---
  if (loading) {
    return (
      <div className="h-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          接続状態:
        </span>
        {connected ? (
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            接続済み ({email})
          </span>
        ) : (
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            未接続
          </span>
        )}
      </div>

      {connected ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {disconnecting ? "切断中..." : "切断する"}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Google Driveに接続
        </button>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        PDFのアップロードにはGoogle Drive接続が必要です
      </p>
    </div>
  );
}
