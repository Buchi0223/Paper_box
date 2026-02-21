import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <p className="mb-2 text-6xl font-bold text-gray-300 dark:text-gray-700">404</p>
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          ページが見つかりません
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          トップページに戻る
        </Link>
      </div>
    </div>
  );
}
