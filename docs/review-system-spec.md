# 論文レビューシステム 仕様書

## 1. 概要

### 1.1 目的
RSS・キーワード収集で大量に取得される論文を効率的にトリアージするため、マッチングアプリ風のレビューUIとAIスコアリングによる自動選別機能を導入する。

### 1.2 背景
RSSフィード導入により1回の収集で数十〜数百件の論文が取得されるようになった。すべてを論文一覧に並べるとノイズが多く、ユーザーが本当に関心のある論文を見つけにくい。

### 1.3 コンセプト
- 収集した論文は「未レビュー」状態で保存
- マッチングアプリのように1件ずつ「興味あり / スキップ」で判定
- ユーザーの判定履歴＋手動設定から**関心プロファイル**を構築
- AIが関心プロファイルに基づいて**関連度スコア**を算出し、自動選別

---

## 2. 設計方針

### 2.1 論文ステータスの導入

papers テーブルに `review_status` カラムを追加：

| ステータス | 意味 | 論文一覧での表示 |
|-----------|------|----------------|
| `approved` | レビュー済み（興味あり）or 手動登録 | 表示する |
| `pending` | 未レビュー（自動収集直後） | 表示しない |
| `skipped` | レビュー済み（スキップ） | 表示しない |
| `auto_approved` | AIスコアが高く自動承認 | 表示する |
| `auto_skipped` | AIスコアが低く自動スキップ | 表示しない |

**既存論文への影響:**
- 手動登録（source: `"manual"`）→ `approved`
- キーワード収集（source: `"auto"`）→ `approved`（既存動作を維持）
- RSS収集（source: `"rss"`）→ `pending`（レビュー待ち）

### 2.2 関心プロファイル

ユーザーの関心領域を以下の2つのソースから構築：

1. **手動設定**: ユーザーが明示的に登録する関心キーワード・分野
2. **学習データ**: レビュー判定履歴（approved/skipped）から自動抽出

### 2.3 AIスコアリング

- RSS収集時にGemini APIで各論文の関連度をスコアリング（0〜100）
- スコアに基づいて自動判定:
  - **70以上** → `auto_approved`（論文一覧に自動表示）
  - **30以下** → `auto_skipped`（自動スキップ）
  - **31〜69** → `pending`（手動レビュー対象）
- 閾値はユーザーが設定画面で調整可能

---

## 3. データベース設計

### 3.1 papers テーブルの変更

```sql
-- レビューステータス
ALTER TABLE papers ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';

-- AIスコア（0〜100、NULL=未スコアリング）
ALTER TABLE papers ADD COLUMN relevance_score INTEGER;

-- インデックス
CREATE INDEX idx_papers_review_status ON papers(review_status);
CREATE INDEX idx_papers_relevance_score ON papers(relevance_score) WHERE relevance_score IS NOT NULL;
```

**既存データの扱い:**
- 既存の全論文は `review_status = 'approved'` のまま（デフォルト値）
- 新規RSS収集分のみ `pending` で保存

### 3.2 新規テーブル: `interests`（関心プロファイル）

```sql
CREATE TABLE interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| label | TEXT | 関心キーワード / 分野名 |
| type | TEXT | `manual`（手動追加）or `learned`（自動学習） |
| weight | REAL | 重み（1.0=標準、学習により0.1〜2.0で変動） |
| created_at | TIMESTAMPTZ | 作成日時 |

### 3.3 新規テーブル: `review_settings`（スコアリング設定）

```sql
CREATE TABLE review_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初期値
INSERT INTO review_settings (key, value) VALUES
  ('auto_approve_threshold', '70'),
  ('auto_skip_threshold', '30'),
  ('scoring_enabled', 'true');
```

---

## 4. 処理フロー

### 4.1 RSS収集時のフロー変更

```
現在: RSS取得 → タイトル翻訳 → papers保存(source="rss")
    ↓
変更後:
RSS取得
  → タイトル翻訳
  → AIスコアリング（関心プロファイルと照合）
  → スコアに基づきreview_status決定
    - 70以上 → auto_approved
    - 30以下 → auto_skipped
    - 31〜69 → pending
  → papers保存(source="rss", review_status=判定結果, relevance_score=スコア)
```

### 4.2 キーワード収集は変更なし
- キーワード収集（source: `"auto"`）は既にユーザーが指定した検索条件のため、従来通り `approved` で保存

### 4.3 AIスコアリングのプロンプト

```
あなたは研究者の関心度を判定する専門家です。

以下の「関心プロファイル」と「論文情報」を照合し、
研究者がこの論文に興味を持つ可能性を0〜100の整数で評価してください。

## 関心プロファイル
{interests_list}

## 論文情報
タイトル: {title}
著者: {authors}
アブストラクト: {abstract}

## 評価基準
- 90-100: 研究テーマに直接関連する
- 70-89: 関連性が高い、手法や分野が近い
- 40-69: 間接的に関連する可能性がある
- 10-39: 関連性が低い
- 0-9: 全く無関係

スコア（数値のみ）を出力してください。
```

### 4.4 関心プロファイルの自動学習

レビュー判定時に以下の学習ロジックを実行：

- **「興味あり」判定時**: 論文のタイトル・アブストラクトからキーワードをAIで抽出し、`interests`テーブルに `type='learned'` で追加（既存のものはweight増加）
- **「スキップ」判定時**: 該当する学習済みキーワードのweightを微減

---

## 5. API設計

### 5.1 未レビュー論文取得

**`GET /api/papers/review`**

レスポンス:
```json
{
  "papers": [
    {
      "id": "uuid",
      "title_original": "...",
      "title_ja": "...",
      "authors": ["..."],
      "abstract": "...",
      "url": "...",
      "relevance_score": 55,
      "source": "rss",
      "collected_at": "..."
    }
  ],
  "total_pending": 42
}
```

クエリパラメータ:
- `sort`: `score_desc`（スコア高い順、デフォルト）/ `date_desc`（新しい順）
- `limit`: 取得件数（デフォルト: 20）

### 5.2 レビュー判定

**`POST /api/papers/review`**

リクエスト:
```json
{
  "paper_id": "uuid",
  "action": "approve" | "skip"
}
```

レスポンス:
```json
{
  "success": true,
  "review_status": "approved",
  "learned_interests": ["traffic flow", "simulation"]
}
```

### 5.3 一括操作

**`POST /api/papers/review/bulk`**

リクエスト:
```json
{
  "action": "approve_all_auto" | "skip_all_auto",
  "min_score": 70
}
```

### 5.4 関心プロファイルCRUD

**`GET /api/interests`** — 関心一覧取得

**`POST /api/interests`** — 手動追加
```json
{
  "label": "交通工学",
  "weight": 1.5
}
```

**`PATCH /api/interests/:id`** — weight調整

**`DELETE /api/interests/:id`** — 削除

### 5.5 スコアリング設定

**`GET /api/settings/review`** — 設定取得

**`PATCH /api/settings/review`** — 設定更新
```json
{
  "auto_approve_threshold": 75,
  "auto_skip_threshold": 25,
  "scoring_enabled": true
}
```

---

## 6. UI設計

### 6.1 レビューページ (`/review`)

**メインUI: カード型スワイプレビュー**

```
┌────────────────────────────────────────┐
│  未レビュー: 42件                    スコア順 ▼ │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  スコア: 65                       │  │
│  │                                  │  │
│  │  Traffic Signal Optimization     │  │
│  │  Using Deep Reinforcement        │  │
│  │  Learning                        │  │
│  │  ─────────────────               │  │
│  │  深層強化学習を用いた交通信号最適化  │  │
│  │                                  │  │
│  │  著者: Smith, J. et al.          │  │
│  │  出典: RSS - Nature              │  │
│  │                                  │  │
│  │  アブストラクト:                  │  │
│  │  This paper proposes a novel...  │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│      [ スキップ ]     [ 興味あり ]       │
│                                        │
│  ← 2/42 →                              │
└────────────────────────────────────────┘
```

**操作:**
- 「興味あり」ボタン → `approved` に変更、論文一覧に追加
- 「スキップ」ボタン → `skipped` に変更、非表示
- キーボードショートカット: `←` スキップ、`→` 興味あり
- 一括操作: 「スコア70以上を全て承認」ボタン

### 6.2 関心プロファイル管理 (`/interests`)

**一覧表示:**
- 手動追加（type=manual）と自動学習（type=learned）をタブ切り替え
- 各項目: ラベル、weight表示（バー）、編集・削除

**新規追加フォーム:**
- キーワード/分野名入力
- weight（スライダー: 0.1〜2.0）

### 6.3 設定ページの拡張 (`/settings`)

既存の設定ページに「AIスコアリング設定」セクションを追加:

```
┌ AIスコアリング設定 ──────────────────────┐
│                                          │
│  スコアリング: [有効 ●○ 無効]              │
│                                          │
│  自動承認しきい値: [====●====] 70          │
│  自動スキップしきい値: [==●======] 30      │
│                                          │
│  ※ しきい値の間(31〜69)の論文は            │
│    手動レビュー対象になります              │
└──────────────────────────────────────────┘
```

### 6.4 論文一覧の変更 (`/`)

- `review_status` が `approved` または `auto_approved` の論文のみ表示
- `auto_approved` にはバッジ表示（「AI推薦」等）
- フィルタ追加: `source` 別（全て / 手動 / キーワード / RSS）

### 6.5 ナビゲーション

```
論文一覧 | 論文登録 | キーワード | RSS | レビュー(42) | お気に入り | 関心 | 設定
```

- 「レビュー」に未レビュー件数バッジを表示
- 「関心」→ 関心プロファイル管理ページ

---

## 7. 技術スタック

### 7.1 追加パッケージ
なし（既存のGemini API + Supabase + Next.jsで実装可能）

### 7.2 ファイル構成

**新規作成:**

| ファイル | 内容 |
|---------|------|
| `src/lib/scoring.ts` | AIスコアリングモジュール |
| `src/lib/interest-learner.ts` | 関心プロファイル自動学習ロジック |
| `src/app/review/page.tsx` | レビューページUI |
| `src/app/interests/page.tsx` | 関心プロファイル管理UI |
| `src/app/api/papers/review/route.ts` | レビューAPI（GET/POST） |
| `src/app/api/papers/review/bulk/route.ts` | 一括レビューAPI |
| `src/app/api/interests/route.ts` | 関心CRUD API（GET/POST） |
| `src/app/api/interests/[id]/route.ts` | 関心CRUD API（PATCH/DELETE） |
| `src/app/api/settings/review/route.ts` | スコアリング設定API |

**変更:**

| ファイル | 変更内容 |
|---------|---------|
| `supabase/schema.sql` | papers変更, interests, review_settings追加 |
| `src/types/database.ts` | 新型追加, Paper型にreview_status, relevance_score追加 |
| `src/lib/rss-collector.ts` | スコアリング統合, review_status設定 |
| `src/app/page.tsx` | review_statusフィルタ追加 |
| `src/components/Header.tsx` | レビュー・関心メニュー追加 |
| `src/app/settings/page.tsx` | スコアリング設定セクション追加 |

---

## 8. ライブDB移行SQL

```sql
-- 1. papers テーブルにレビューステータスとスコアを追加
ALTER TABLE papers ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE papers ADD COLUMN relevance_score INTEGER;
CREATE INDEX idx_papers_review_status ON papers(review_status);
CREATE INDEX idx_papers_relevance_score ON papers(relevance_score) WHERE relevance_score IS NOT NULL;

-- 2. 関心プロファイルテーブル
CREATE TABLE interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON interests FOR ALL USING (true);

-- 3. スコアリング設定テーブル
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

---

## 9. 実装ステップ

### Step 1: 基盤（DB + レビューUI）
- papers テーブルに `review_status`, `relevance_score` 追加
- 型定義更新
- RSS収集を `pending` で保存するよう変更
- レビューページ（カード型UI）作成
- レビューAPI作成
- 論文一覧のフィルタ修正

### Step 2: 関心プロファイル
- interests テーブル作成
- 関心プロファイル管理ページ作成
- 関心CRUD API作成
- レビュー判定時の自動学習ロジック

### Step 3: AIスコアリング
- スコアリングモジュール作成
- RSS収集にスコアリング統合
- review_settings テーブル + 設定UI
- 一括操作API
- 自動承認/スキップの閾値処理

---

## 10. 検証方法

1. `npm run build` でビルドエラーがないこと
2. SupabaseでSQL移行を実行
3. RSS収集後、論文が `pending` で保存されること
4. `/review` ページでカード型レビューが動作すること
5. 「興味あり」→ 論文一覧に表示、「スキップ」→ 非表示
6. 関心プロファイルの手動追加・自動学習が動作すること
7. AIスコアリングが正しくスコアを算出すること
8. 閾値に基づく自動判定が正しく動作すること
