# RSSフィード機能 仕様書

## 1. 概要

### 1.1 目的
論文自動収集の精度向上のため、既存のキーワード検索に加えて、RSSフィードによるジャーナル新着論文の取得機能を追加する。

### 1.2 背景
現在のPaperShelfは、キーワードベースのAPI検索（arXiv, Semantic Scholar, OpenAlex）で論文を自動収集している。しかしキーワード検索はノイズが混じりやすく、特定ジャーナルの新着を確実に追いたい場合には不向きである。

RSSフィードを併用することで、以下の使い分けが可能になる：

| 収集方式 | 用途 | 特徴 |
|----------|------|------|
| キーワード検索 | テーマベースの横断的発見 | 広い網、複数ソース横断 |
| RSSフィード | 特定ジャーナルの新着追跡 | 高精度、取りこぼしなし |

### 1.3 対応する主要ジャーナルのRSSフィード

| 出版社 | RSSサポート | Feed URL例 |
|--------|-----------|------------|
| Nature | あり | `https://www.nature.com/nature.rss` |
| Science | あり | `https://www.sciencemag.org/rss/current.xml` |
| arXiv | あり | `https://rss.arxiv.org/rss/cs.AI` |
| Springer | あり | `https://link.springer.com/search.rss?facet-journal-id=XXXXX` |
| IEEE | あり | IEEE Xplore経由 |
| Elsevier | あり | ScienceDirect経由（動的URL） |
| PLOS | あり | 各ジャーナルページから取得可能 |

---

## 2. 設計方針

### 2.1 管理方式
- **専用テーブル**（`rss_feeds`）で管理（keywordsテーブルとは分離）
- **専用UIページ**（`/feeds`）で管理（キーワード管理とは独立した画面）

### 2.2 AI処理方針
- **タイトル翻訳のみ**実行（要約・解説は省略）
- Gemini API消費を最小化し、コスト効率を重視
- 要約・解説が必要な場合はユーザーが論文詳細画面から手動で実行可能

### 2.3 収集タイミング
- 既存のVercel Cron Job（毎日6:00 UTC）に相乗り
- キーワード収集の後にRSS収集を実行
- 手動収集API（`/api/collect`）からも実行可能

---

## 3. データベース設計

### 3.1 新規テーブル: `rss_feeds`

```sql
CREATE TABLE rss_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| name | TEXT | フィード表示名（例: "Nature - Latest Research"） |
| feed_url | TEXT | RSSフィードURL |
| is_active | BOOLEAN | 有効/無効フラグ |
| last_fetched_at | TIMESTAMPTZ | 最終取得日時（差分取得に使用） |
| created_at | TIMESTAMPTZ | 登録日時 |

### 3.2 既存テーブル変更: `collection_logs`

RSS収集のログも記録するため、以下の変更を行う：

```sql
-- keyword_id を NULL許可に変更（RSS収集時はkeyword不要）
ALTER TABLE collection_logs ALTER COLUMN keyword_id DROP NOT NULL;

-- feed_id カラムを追加
ALTER TABLE collection_logs ADD COLUMN feed_id UUID REFERENCES rss_feeds(id) ON DELETE SET NULL;
```

### 3.3 papers テーブルの source 値

| source値 | 意味 |
|----------|------|
| `"manual"` | ユーザーが手動登録 |
| `"auto"` | キーワード検索で自動収集 |
| `"rss"` | RSSフィードから自動収集（新規） |

---

## 4. 処理フロー

### 4.1 RSS収集パイプライン

```
rss_feeds テーブル（有効なフィード）
  ↓
各フィードに対して:
  ① Feed XMLをHTTP取得
  ② rss-parser でパース（RSS 2.0 / Atom両対応）
  ③ last_fetched_at 以降のエントリのみ抽出
  ④ メタデータ正規化（タイトル、著者、DOI、URL、出版日）
  ⑤ DOIベースの重複排除（DBに既存の論文を除外）
  ⑥ AI処理: タイトル翻訳のみ（translateTitle）
  ⑦ papers テーブルに保存（source: "rss"）
  ⑧ last_fetched_at を現在時刻に更新
  ⑨ collection_logs にログ記録
```

### 4.2 フィードエントリからのデータ抽出

| 項目 | 抽出元 | 備考 |
|------|--------|------|
| タイトル | `<title>` | 必須 |
| 著者 | `<dc:creator>` or `<author>` | 未提供の場合は空配列 |
| アブストラクト | `<description>` or `<summary>` | HTML含む場合はタグ除去 |
| 出版日 | `<pubDate>` or `<published>` | ISO形式に正規化 |
| DOI | URLから `doi.org/` パターン抽出 | 重複排除のキー |
| URL | `<link>` | 論文ページへのリンク |

---

## 5. API設計

### 5.1 フィード一覧取得 / 登録

**`GET /api/feeds`**

レスポンス:
```json
{
  "feeds": [
    {
      "id": "uuid",
      "name": "Nature - Latest Research",
      "feed_url": "https://www.nature.com/nature.rss",
      "is_active": true,
      "last_fetched_at": "2026-02-23T06:00:00Z",
      "created_at": "2026-02-23T00:00:00Z"
    }
  ]
}
```

**`POST /api/feeds`**

リクエスト:
```json
{
  "name": "Nature - Latest Research",
  "feed_url": "https://www.nature.com/nature.rss"
}
```

### 5.2 フィード更新 / 削除

**`PATCH /api/feeds/:id`**

リクエスト（部分更新）:
```json
{
  "name": "更新後の名前",
  "feed_url": "https://...",
  "is_active": false
}
```

**`DELETE /api/feeds/:id`**

---

## 6. UI設計

### 6.1 RSSフィード管理ページ (`/feeds`)

キーワード管理ページと同じUIパターンを踏襲する。

**一覧表示:**
- フィード名
- Feed URL（省略表示）
- 有効/無効トグルスイッチ
- 最終取得日時
- 編集・削除ボタン

**新規追加フォーム:**
- フィード名（必須）
- Feed URL（必須）

**ヘルプテキスト（代表的なFeed URL例）:**
```
登録したRSSフィードから定期的に新着論文を自動収集します。
例: Nature (https://www.nature.com/nature.rss)
    arXiv CS.AI (https://rss.arxiv.org/rss/cs.AI)
    Science (https://www.sciencemag.org/rss/current.xml)
```

### 6.2 ナビゲーション

Headerのナビゲーションに「RSS」メニューを追加（「キーワード」の後に配置）：

```
論文一覧 | 論文登録 | キーワード | RSS | お気に入り | 設定
```

---

## 7. 技術スタック

### 7.1 追加パッケージ

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| rss-parser | 最新 | RSS 2.0 / Atom フィードパーサー（TypeScript対応） |

### 7.2 ファイル構成

**新規作成（6ファイル）:**

| ファイル | 内容 |
|---------|------|
| `src/lib/rss.ts` | RSSフィード取得・パースモジュール |
| `src/lib/rss-collector.ts` | RSS収集ロジック |
| `src/app/api/feeds/route.ts` | フィードCRUD API（GET/POST） |
| `src/app/api/feeds/[id]/route.ts` | フィードCRUD API（PATCH/DELETE） |
| `src/app/feeds/page.tsx` | フィード管理UI |

**変更（6ファイル）:**

| ファイル | 変更内容 |
|---------|---------|
| `supabase/schema.sql` | rss_feeds テーブル追加、collection_logs変更 |
| `src/types/database.ts` | RssFeed型追加、CollectionLog型変更 |
| `src/lib/ai.ts` | translateTitle() を単独エクスポート |
| `src/app/api/cron/collect/route.ts` | RSS収集の呼び出し追加 |
| `src/app/api/collect/route.ts` | RSS収集の呼び出し追加 |
| `src/components/Header.tsx` | ナビゲーションに「RSS」追加 |

---

## 8. ライブDB移行手順

Supabase SQL Editorで以下を実行：

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

---

## 9. 検証方法

1. `npm run build` でビルドエラーがないことを確認
2. SupabaseでSQL移行を実行
3. `/feeds` ページでフィードの追加・編集・削除が動作すること
4. テスト用フィード（`https://rss.arxiv.org/rss/cs.AI`）を登録
5. 手動収集API（`/api/collect`）を実行し、RSSフィードから論文が取得されること
6. papers テーブルに `source="rss"` で保存されていること
7. タイトルの日本語翻訳が正しく生成されていること
8. collection_logs にRSS収集のログが記録されていること
