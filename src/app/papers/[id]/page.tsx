export default async function PaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">論文詳細</h1>
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">論文ID: {id} の詳細画面（Phase 2で実装）</p>
      </div>
    </div>
  );
}
