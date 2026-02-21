export default function Home() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">論文一覧</h1>
      </div>
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">
          論文がまだ登録されていません。
          <br />
          キーワードを登録して自動収集するか、手動で論文を登録してください。
        </p>
      </div>
    </div>
  );
}
