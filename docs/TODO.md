# 開発TODOリスト

## Phase 1: 基盤構築

### プロジェクトセットアップ
- [x] Next.js (App Router) プロジェクト作成（TypeScript）
- [x] Tailwind CSS セットアップ
- [x] ESLint / Prettier 設定
- [x] プロジェクトのディレクトリ構成を整理
- [ ] GitHubリポジトリ作成・初回push
- [x] `.env.local` と `.env.example` 作成

### Supabase設定
- [ ] Supabaseプロジェクト作成
- [x] `papers` テーブル作成（SQLスキーマ定義済み: `supabase/schema.sql`）
- [x] `keywords` テーブル作成（SQLスキーマ定義済み）
- [x] `paper_keywords` テーブル作成（SQLスキーマ定義済み）
- [x] `collection_logs` テーブル作成（SQLスキーマ定義済み）
- [x] Supabase クライアント初期化（`lib/supabase.ts`）

### 基本レイアウト
- [x] 共通レイアウトコンポーネント作成（ヘッダー・ナビゲーション）
- [x] ページルーティング設定（`/`, `/papers/[id]`, `/papers/new`, `/keywords`, `/favorites`, `/settings`）
- [x] レスポンシブ対応のベースCSS

---

## Phase 2: 論文一覧・詳細画面

### 論文一覧画面（トップページ `/`）
- [ ] 論文一覧取得API（`GET /api/papers`）実装
- [ ] カードコンポーネント作成（日本語タイトル、原題、著者、発行日、要約抜粋、お気に入りアイコン）
- [ ] 日付ごとのグルーピング表示
- [ ] ページネーション or 無限スクロール実装
- [ ] ソート機能（収集日 新しい順/古い順）

### 論文詳細画面（`/papers/[id]`）
- [ ] 論文詳細取得API（`GET /api/papers/:id`）実装
- [ ] 詳細画面コンポーネント作成（タイトル、著者、発行日、ジャーナル名、要約全文、解説全文）
- [ ] 元論文へのリンクボタン

### お気に入り機能
- [ ] 論文更新API（`PATCH /api/papers/:id`）実装
- [ ] お気に入りトグルボタンコンポーネント
- [ ] お気に入り一覧ページ（`/favorites`）
- [ ] お気に入りフィルタ機能

### メモ機能
- [ ] メモ入力テキストエリア（詳細画面）
- [ ] メモ保存処理（PATCH APIと連携）

### 検索・フィルタ機能
- [ ] フリーテキスト検索（タイトル・要約・メモ対象）
- [ ] キーワードタグによるフィルタ
- [ ] 日付範囲フィルタ
- [ ] 検索UIコンポーネント（検索バー + フィルタパネル）

---

## Phase 3: 論文手動登録

### 登録フォーム（`/papers/new`）
- [ ] 論文登録API（`POST /api/papers`）実装
- [ ] 入力フォーム作成（タイトル、著者、発行日、ジャーナル名、DOI、URL）
- [ ] バリデーション実装
- [ ] 登録成功後の詳細画面へのリダイレクト

### PDFアップロード
- [ ] PDFファイルアップロードUI
- [ ] PDFからのメタデータ自動抽出（可能な範囲）

### Google Drive連携
- [ ] Google Driveサービスアカウント設定
- [ ] PDFアップロードAPI（`POST /api/drive/upload`）実装
- [ ] アップロード後の共有リンク取得・DB保存
- [ ] 登録フローへの組み込み（PDF → Google Drive → DB保存）

---

## Phase 4: AI連携

### OpenAI API基盤
- [ ] OpenAI クライアント初期化（`lib/openai.ts`）
- [ ] プロンプトテンプレート作成（要約用・解説用・翻訳用）
- [ ] トークン使用量のログ記録

### 要約・解説生成API
- [ ] 要約生成API（`POST /api/ai/summarize`）実装
- [ ] 解説生成API（`POST /api/ai/explain`）実装
- [ ] 日本語タイトル翻訳処理

### 手動登録との統合
- [ ] 手動登録時にAI処理を自動実行するフロー
- [ ] AI生成中のローディングUI
- [ ] AI生成結果のプレビュー・編集機能

---

## Phase 5: 自動収集

### 論文検索API連携
- [ ] arXiv API クライアント実装（`lib/arxiv.ts`）
- [ ] Semantic Scholar API クライアント実装（`lib/semantic-scholar.ts`）
- [ ] 検索結果のパース・正規化処理
- [ ] DOIベースの重複排除ロジック

### キーワード管理画面（`/keywords`）
- [ ] キーワード一覧取得API（`GET /api/keywords`）実装
- [ ] キーワード登録API（`POST /api/keywords`）実装
- [ ] キーワード更新API（`PATCH /api/keywords/:id`）実装
- [ ] キーワード削除API（`DELETE /api/keywords/:id`）実装
- [ ] キーワード管理UI（一覧表示、追加、編集、削除、有効/無効切替）
- [ ] 検索対象ソース選択UI

### 自動収集処理
- [ ] 収集実行API（`POST /api/collect`）実装
- [ ] Cron Job用API（`POST /api/cron/collect`）実装
- [ ] `vercel.json` にCronスケジュール設定（毎日1回）
- [ ] CRON_SECRET による認証チェック
- [ ] 収集 → AI処理 → DB保存の一連フロー実装

### 収集ログ
- [ ] 収集ログ取得API（`GET /api/collect/logs`）実装
- [ ] 収集ログ表示UI（設定画面 or 専用画面）
- [ ] エラー時の通知・リトライ

---

## Phase 6: 仕上げ

### デザイン・UX改善
- [ ] レスポンシブデザイン最終調整（PC / タブレット / スマートフォン）
- [ ] ダークモード対応
- [ ] ローディング・スケルトンUI
- [ ] エラーハンドリング・トースト通知
- [ ] 空状態（Empty State）のUI

### 設定画面（`/settings`）
- [ ] APIキー等の設定管理UI（※環境変数で管理するため最小限）
- [ ] 収集スケジュールの確認表示

### パフォーマンス・品質
- [ ] 画像・フォント最適化
- [ ] API レスポンスのキャッシュ戦略
- [ ] エラーバウンダリ設定
- [ ] メタデータ・OGP設定

### デプロイ
- [ ] Vercelプロジェクト作成・GitHub連携
- [ ] 環境変数設定（Vercel Dashboard）
- [ ] 本番デプロイ・動作確認
- [ ] Cron Job動作確認

### 論文削除機能
- [ ] 論文削除API（`DELETE /api/papers/:id`）実装
- [ ] 削除確認ダイアログUI
