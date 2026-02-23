# RSSフィード機能 TODOリスト

仕様書: `docs/rss-feed-spec.md`

---

## Phase 1: 基盤準備

- [x] **TODO 1: rss-parser パッケージのインストール**
  - `npm install rss-parser`
  - RSS 2.0 / Atom 両対応のフィードパーサー

- [x] **TODO 2: データベーススキーマ更新** (`supabase/schema.sql`)
  - `rss_feeds` テーブル定義を追加
  - `collection_logs` テーブルの変更（keyword_id NULL許可、feed_id追加）を記載
  - ※ 実際のDB移行はSupabase SQL Editorで手動実行

- [x] **TODO 3: 型定義の追加** (`src/types/database.ts`)
  - `RssFeed` 型を追加（id, name, feed_url, is_active, last_fetched_at, created_at）
  - `RssFeedInsert` / `RssFeedUpdate` 型を追加
  - `CollectionLog` 型に `feed_id` を追加、`keyword_id` をオプショナルに変更

---

## Phase 2: バックエンド実装

- [x] **TODO 4: RSSフィード取得・パースモジュール作成** (`src/lib/rss.ts`)
  - `rss-parser` を使用したフィード取得関数
  - RSS/Atom両対応のパース処理
  - HTMLタグ除去（abstract/description用）
  - DOI抽出（URLから `doi.org/` パターン）
  - メタデータ正規化（タイトル、著者、DOI、URL、出版日）

- [x] **TODO 5: RSS収集ロジック作成** (`src/lib/rss-collector.ts`)
  - `collectAllRssFeeds()` メイン関数
  - 有効なフィード一覧取得 → 各フィード処理
  - `last_fetched_at` 以降のエントリのみ抽出（差分取得）
  - DOIベースの重複排除（DB既存論文との照合）
  - AI処理: `translateTitle()` のみ（`src/lib/ai.ts` から既にエクスポート済み）
  - papers テーブルに保存（source: `"rss"`）
  - `last_fetched_at` を現在時刻に更新
  - `collection_logs` にログ記録（feed_id付き）

---

## Phase 3: API実装

- [x] **TODO 6: フィードCRUD API（GET/POST）作成** (`src/app/api/feeds/route.ts`)
  - `GET /api/feeds` — フィード一覧取得（created_at降順）
  - `POST /api/feeds` — フィード新規登録（name, feed_url必須）

- [x] **TODO 7: フィードCRUD API（PATCH/DELETE）作成** (`src/app/api/feeds/[id]/route.ts`)
  - `PATCH /api/feeds/:id` — フィード部分更新（name, feed_url, is_active）
  - `DELETE /api/feeds/:id` — フィード削除

- [x] **TODO 8: Cron Job にRSS収集を追加** (`src/app/api/cron/collect/route.ts`)
  - `collectAllPapers()` の後に `collectAllRssFeeds()` を呼び出し
  - RSS収集結果もレスポンスに含める

- [x] **TODO 9: 手動収集APIにRSS収集を追加** (`src/app/api/collect/route.ts`)
  - `collectAllPapers()` の後に `collectAllRssFeeds()` を呼び出し
  - RSS収集結果もレスポンスに含める

---

## Phase 4: UI実装

- [x] **TODO 10: RSSフィード管理ページ作成** (`src/app/feeds/page.tsx`)
  - キーワード管理ページ (`src/app/keywords/page.tsx`) のUIパターンを踏襲
  - 一覧表示: フィード名、Feed URL（省略表示）、有効/無効トグル、最終取得日時、編集・削除ボタン
  - 新規追加フォーム: フィード名（必須）、Feed URL（必須）
  - 編集モーダル/インライン編集
  - ヘルプテキスト（代表的なFeed URL例を表示）

- [x] **TODO 11: ナビゲーションにRSSメニュー追加** (`src/components/Header.tsx`)
  - navItems配列に `{ href: "/feeds", label: "RSS" }` を追加
  - 「キーワード」の後、「お気に入り」の前に配置

---

## Phase 5: 検証

- [x] **TODO 12: ビルド確認 & 動作検証**
  - [x] `npm run build` でビルドエラーがないことを確認 (Compiled successfully)
  - [ ] SupabaseでSQL移行を実行（手動）
  - [ ] `/feeds` ページでフィードのCRUD操作を確認
  - [ ] テスト用フィード（arXiv CS.AI等）を登録して収集テスト

---

## 主要ファイル一覧

### 新規作成（5ファイル）

| ファイル | 内容 |
|---------|------|
| `src/lib/rss.ts` | RSSフィード取得・パースモジュール |
| `src/lib/rss-collector.ts` | RSS収集ロジック（collectAllRssFeeds） |
| `src/app/api/feeds/route.ts` | フィードCRUD API（GET/POST） |
| `src/app/api/feeds/[id]/route.ts` | フィードCRUD API（PATCH/DELETE） |
| `src/app/feeds/page.tsx` | フィード管理UI |

### 変更（5ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `supabase/schema.sql` | rss_feeds テーブル追加、collection_logs変更 |
| `src/types/database.ts` | RssFeed型追加、CollectionLog型変更 |
| `src/app/api/cron/collect/route.ts` | RSS収集の呼び出し追加 |
| `src/app/api/collect/route.ts` | RSS収集の呼び出し追加 |
| `src/components/Header.tsx` | ナビゲーションに「RSS」追加 |

### 変更不要（確認済み）

| ファイル | 理由 |
|---------|------|
| `src/lib/ai.ts` | `translateTitle()` は既にスタンドアロン関数としてエクスポート済み |

---

## DB移行SQL（Supabase SQL Editorで手動実行）

```sql
-- 1. rss_feeds テーブル作成
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. collection_logs の keyword_id を NULL許可に
ALTER TABLE collection_logs ALTER COLUMN keyword_id DROP NOT NULL;

-- 3. collection_logs に feed_id カラム追加
ALTER TABLE collection_logs ADD COLUMN feed_id UUID REFERENCES rss_feeds(id) ON DELETE SET NULL;

-- 4. RLS ポリシー
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON rss_feeds FOR ALL USING (true);
```
