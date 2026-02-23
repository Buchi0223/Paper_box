# 論文レビューシステム TODOリスト

仕様書: `docs/review-system-spec.md`

---

## Step 1: 基盤（DB + レビューUI）

- [x] **TODO 1: データベーススキーマ更新** (`supabase/schema.sql`)
  - `papers` テーブルに `review_status TEXT NOT NULL DEFAULT 'approved'` 追加
  - `papers` テーブルに `relevance_score INTEGER` 追加
  - インデックス追加（`idx_papers_review_status`, `idx_papers_relevance_score`）
  - ※ 実際のDB移行はSupabase SQL Editorで手動実行

- [x] **TODO 2: 型定義の更新** (`src/types/database.ts`)
  - `Paper` 型に `review_status`, `relevance_score` を追加
  - `PaperInsert` / `PaperUpdate` 型にも追加
  - `Interest` / `InterestInsert` 型を追加（Step 2で使用）
  - `ReviewSetting` 型を追加（Step 3で使用）

- [x] **TODO 3: RSS収集を `pending` で保存するよう変更** (`src/lib/rss-collector.ts`)
  - `collectForFeed()` での papers 保存時に `review_status: "pending"` を設定
  - キーワード収集（source: `"auto"`）は従来通り `approved` のまま

- [x] **TODO 4: レビューAPI作成** (`src/app/api/papers/review/route.ts`)
  - `GET /api/papers/review` — 未レビュー論文取得（`review_status = 'pending'`）
    - クエリパラメータ: `sort`（score_desc / date_desc）, `limit`
    - レスポンス: papers配列 + total_pending件数
  - `POST /api/papers/review` — レビュー判定（approve / skip）
    - `paper_id` + `action` を受け取り `review_status` を更新

- [x] **TODO 5: レビューページ作成** (`src/app/review/page.tsx`)
  - カード型スワイプレビューUI
  - 論文情報表示: スコア、タイトル（英語+日本語）、著者、出典、アブストラクト
  - 「興味あり」「スキップ」ボタン
  - キーボードショートカット: `←` スキップ、`→` 興味あり
  - 未レビュー件数表示、ページネーション（2/42 等）
  - ソート切り替え（スコア順 / 日付順）

- [x] **TODO 6: 論文一覧のフィルタ修正** (`src/app/api/papers/route.ts`)
  - `review_status` が `approved` または `auto_approved` の論文のみ取得
  - `auto_approved` に「AI推薦」バッジ表示（`src/components/PaperCard.tsx`）

- [x] **TODO 7: ナビゲーション更新** (`src/components/Header.tsx`)
  - navItems に `{ href: "/review", label: "レビュー" }` を追加
  - 「RSS」の後、「お気に入り」の前に配置

---

## Step 2: 関心プロファイル

- [x] **TODO 8: データベーススキーマ更新** (`supabase/schema.sql`)
  - `interests` テーブル追加（id, label, type, weight, created_at）
  - RLSポリシー設定
  - ※ 実際のDB移行はSupabase SQL Editorで手動実行

- [x] **TODO 9: 関心プロファイルCRUD API作成**
  - `src/app/api/interests/route.ts` — GET（一覧取得）/ POST（手動追加）
  - `src/app/api/interests/[id]/route.ts` — PATCH（weight調整）/ DELETE（削除）

- [x] **TODO 10: 関心プロファイル管理ページ作成** (`src/app/interests/page.tsx`)
  - 手動追加（type=manual）と自動学習（type=learned）をタブ切り替え
  - 各項目: ラベル、weight表示（バー）、編集・削除
  - 新規追加フォーム: キーワード/分野名（必須）、weight（スライダー: 0.1〜2.0）

- [x] **TODO 11: 関心プロファイル自動学習ロジック作成** (`src/lib/interest-learner.ts`)
  - 「興味あり」判定時: AIでタイトル・アブストラクトからキーワード抽出 → `interests` に `type='learned'` で追加（既存はweight増加）
  - 「スキップ」判定時: 該当する学習済みキーワードのweight微減
  - レビューAPI（POST /api/papers/review）から呼び出し

- [x] **TODO 12: ナビゲーション更新** (`src/components/Header.tsx`)
  - navItems に `{ href: "/interests", label: "関心" }` を追加
  - 「お気に入り」の後、「設定」の前に配置

---

## Step 3: AIスコアリング

- [x] **TODO 13: データベーススキーマ更新** (`supabase/schema.sql`)
  - `review_settings` テーブル追加（id, key, value, updated_at）
  - 初期値INSERT（auto_approve_threshold=70, auto_skip_threshold=30, scoring_enabled=true）
  - RLSポリシー設定
  - ※ 実際のDB移行はSupabase SQL Editorで手動実行

- [x] **TODO 14: AIスコアリングモジュール作成** (`src/lib/scoring.ts`)
  - `scoreRelevance(paper, interests)` — Gemini APIで関連度スコア（0〜100）を算出
  - プロンプト: 関心プロファイルと論文情報を照合し、数値のみ返却
  - `determineReviewStatus(score, settings)` — スコアからreview_statusを決定
  - `getReviewSettings()` — review_settingsテーブルから閾値取得

- [x] **TODO 15: RSS収集にスコアリング統合** (`src/lib/rss-collector.ts`)
  - `collectForFeed()` にスコアリングステップを追加
  - フロー: RSS取得 → 翻訳 → スコアリング → review_status決定 → 保存
  - `scoring_enabled` が false の場合はスキップ（全て `pending` で保存）

- [x] **TODO 16: スコアリング設定API作成** (`src/app/api/settings/review/route.ts`)
  - `GET /api/settings/review` — 設定取得
  - `PATCH /api/settings/review` — 設定更新（auto_approve_threshold, auto_skip_threshold, scoring_enabled）

- [x] **TODO 17: 一括操作API作成** (`src/app/api/papers/review/bulk/route.ts`)
  - `POST /api/papers/review/bulk`
  - `approve_all_auto`: 指定スコア以上の pending 論文を一括承認
  - `skip_all_auto`: 指定スコア以下の pending 論文を一括スキップ

- [x] **TODO 18: 設定ページにスコアリング設定追加** (`src/app/settings/page.tsx`)
  - 「AIスコアリング設定」セクション追加
  - スコアリング有効/無効トグル
  - 自動承認しきい値スライダー（0〜100）
  - 自動スキップしきい値スライダー（0〜100）

- [x] **TODO 19: レビューページに一括操作ボタン追加** (`src/app/review/page.tsx`)
  - 「スコア○○以上を全て承認」ボタン
  - 一括操作API呼び出し
  - 操作後のリスト更新

---

## Step 4: 検証

- [x] **TODO 20: ビルド確認 & 動作検証**
  - [x] `npm run build` でビルドエラーがないことを確認
  - [x] SupabaseでSQL移行を実行（手動） — Step 1, 2, 3 すべて実行済み
  - [ ] RSS収集後、論文が `pending` で保存されること（実環境テストで確認）
  - [x] `/review` ページでカード型レビューが動作すること（Step 1で確認済み）
  - [x] 「興味あり」→ 論文一覧に表示、「スキップ」→ 非表示（Step 1で確認済み）
  - [x] 関心プロファイルの手動追加・自動学習が動作すること（Step 2で確認済み）
  - [ ] AIスコアリングが正しくスコアを算出すること（実環境テストで確認）
  - [ ] 閾値に基づく自動判定が正しく動作すること（実環境テストで確認）

---

## 主要ファイル一覧

### 新規作成（9ファイル）

| ファイル | 内容 |
|---------|------|
| `src/lib/scoring.ts` | AIスコアリングモジュール |
| `src/lib/interest-learner.ts` | 関心プロファイル自動学習ロジック |
| `src/app/review/page.tsx` | レビューページUI（カード型スワイプ） |
| `src/app/interests/page.tsx` | 関心プロファイル管理UI |
| `src/app/api/papers/review/route.ts` | レビューAPI（GET/POST） |
| `src/app/api/papers/review/bulk/route.ts` | 一括レビューAPI |
| `src/app/api/interests/route.ts` | 関心CRUD API（GET/POST） |
| `src/app/api/interests/[id]/route.ts` | 関心CRUD API（PATCH/DELETE） |
| `src/app/api/settings/review/route.ts` | スコアリング設定API |

### 変更（6ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `supabase/schema.sql` | papers変更, interests, review_settings追加 |
| `src/types/database.ts` | 新型追加, Paper型にreview_status, relevance_score追加 |
| `src/lib/rss-collector.ts` | スコアリング統合, review_status設定 |
| `src/app/page.tsx` | review_statusフィルタ追加, AI推薦バッジ |
| `src/components/Header.tsx` | 「レビュー」「関心」メニュー追加 |
| `src/app/settings/page.tsx` | スコアリング設定セクション追加 |

---

## DB移行SQL（Supabase SQL Editorで手動実行）

### Step 1 実装後に実行

```sql
-- papers テーブルにレビューステータスとスコアを追加
ALTER TABLE papers ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE papers ADD COLUMN relevance_score INTEGER;
CREATE INDEX idx_papers_review_status ON papers(review_status);
CREATE INDEX idx_papers_relevance_score ON papers(relevance_score) WHERE relevance_score IS NOT NULL;
```

### Step 2 実装後に実行

```sql
-- 関心プロファイルテーブル
CREATE TABLE interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON interests FOR ALL USING (true);
```

### Step 3 実装後に実行

```sql
-- スコアリング設定テーブル
CREATE TABLE review_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON review_settings FOR ALL USING (true);

INSERT INTO review_settings (key, value) VALUES
  ('auto_approve_threshold', '70'),
  ('auto_skip_threshold', '30'),
  ('scoring_enabled', 'true');
```
