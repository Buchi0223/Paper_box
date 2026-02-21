# 論文管理Webアプリ 仕様書

## 1. システム概要

### 1.1 目的
研究者・学生が日々の論文情報を効率的に収集・管理・閲覧するためのWebアプリケーション。
キーワードベースの自動収集、AI要約・解説生成、手動登録を統合し、キュレーションサイトのような体験を提供する。

### 1.2 利用形態
- **個人利用**（認証なし）
- Vercelにデプロイし、URLでアクセス

---

## 2. 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| フロントエンド | Next.js (App Router) | TypeScript, Tailwind CSS |
| バックエンド | Next.js API Routes + Supabase | サーバーレス |
| データベース | Supabase (PostgreSQL) | RLS無効（個人利用のため） |
| AI | OpenAI API (GPT-4o) | 要約・解説・翻訳生成 |
| 論文検索API | Semantic Scholar / arXiv API | 論文メタデータ取得 |
| ファイル保管 | Google Drive API | ダウンロード論文の保管 |
| デプロイ | Vercel | GitHub連携で自動デプロイ |
| 定期実行 | Vercel Cron Jobs | 論文自動収集のスケジューリング |

---

## 3. 機能仕様

### 3.1 論文収集機能

#### 3.1.1 キーワード管理
- キーワードの登録・編集・削除
- キーワードごとに検索対象ソースを選択可能（arXiv, Semantic Scholar等）
- キーワードにカテゴリタグを付与可能

#### 3.1.2 自動収集（Cron）
- Vercel Cron Jobsにより**毎日1回**自動実行
- 登録キーワードごとに論文検索APIを呼び出し
- 新規論文のみを取得（重複排除: DOIベース）
- 取得した論文メタデータをDBに保存

#### 3.1.3 AI処理（OpenAI API）
収集した論文に対して以下を自動生成：
- **日本語タイトル**: 原題の日本語訳
- **要約（Abstract要約）**: 300文字程度の日本語要約
- **解説**: 研究の背景・手法・結果・意義を平易に説明（500〜800文字）

#### 3.1.4 保存データ
各論文について以下を保存：
- 原題（英語）
- 日本語タイトル
- 著者名
- 発行日
- ジャーナル/会議名
- DOI
- 元論文URL（リンク）
- 要約（日本語）
- 解説（日本語）
- 収集元ソース
- 収集日時

---

### 3.2 論文一覧・閲覧機能

#### 3.2.1 一覧画面（トップページ）
- キュレーションサイト風のカードレイアウト
- 日付ごとにグルーピング表示
- 各カードに表示する情報：
  - 日本語タイトル
  - 原題
  - 著者（先頭3名 + et al.）
  - 発行日
  - 要約（先頭100文字）
  - お気に入りアイコン
- ページネーションまたは無限スクロール
- ソート：収集日（新しい順/古い順）

#### 3.2.2 論文詳細画面
- 日本語タイトル / 原題
- 著者一覧
- 発行日・ジャーナル名
- 元論文へのリンクボタン
- AI生成の要約（全文）
- AI生成の解説（全文）
- お気に入りトグル
- メモ欄（テキストエリア、保存ボタン）

#### 3.2.3 お気に入り機能
- 一覧画面・詳細画面からワンクリックでお気に入り登録/解除
- お気に入り論文のみのフィルタリング表示

#### 3.2.4 メモ機能
- 各論文に対してテキストメモを付与
- メモは即座にDBに保存（自動保存 or 保存ボタン）

#### 3.2.5 検索・フィルタ
- フリーテキスト検索（タイトル・要約・メモを対象）
- キーワードタグによるフィルタ
- お気に入りフィルタ
- 日付範囲フィルタ

---

### 3.3 論文登録機能（手動）

#### 3.3.1 登録フォーム
- 論文PDFアップロード
- 手動入力フィールド：
  - タイトル（原題）
  - 著者名
  - 発行日
  - ジャーナル/会議名
  - DOI（任意）
  - 元論文URL（任意）
- PDFアップロード時、可能な範囲でメタデータ自動抽出

#### 3.3.2 AI自動処理
アップロードされたPDFに対して：
- 要約を自動生成
- 解説を自動生成
- 日本語タイトルを自動生成

#### 3.3.3 Google Drive連携
- アップロードされたPDFをGoogle Driveの指定フォルダに自動保存
- Google Drive上のファイルリンクをDBに保存

#### 3.3.4 メモ
- 登録時にメモを付与可能
- 登録後も編集可能

---

## 4. データベース設計

### 4.1 テーブル定義

#### `papers`（論文テーブル）
| カラム名 | 型 | 説明 |
|---------|------|------|
| id | UUID (PK) | 主キー |
| title_original | TEXT | 原題 |
| title_ja | TEXT | 日本語タイトル |
| authors | TEXT[] | 著者名リスト |
| published_date | DATE | 発行日 |
| journal | TEXT | ジャーナル/会議名 |
| doi | TEXT (UNIQUE) | DOI |
| url | TEXT | 元論文URL |
| summary_ja | TEXT | AI生成の日本語要約 |
| explanation_ja | TEXT | AI生成の日本語解説 |
| source | TEXT | 収集元（arXiv, manual等） |
| google_drive_url | TEXT | Google Drive上のPDFリンク |
| is_favorite | BOOLEAN | お気に入りフラグ |
| memo | TEXT | ユーザーメモ |
| collected_at | TIMESTAMPTZ | 収集日時 |
| created_at | TIMESTAMPTZ | レコード作成日時 |
| updated_at | TIMESTAMPTZ | レコード更新日時 |

#### `keywords`（キーワードテーブル）
| カラム名 | 型 | 説明 |
|---------|------|------|
| id | UUID (PK) | 主キー |
| keyword | TEXT | 検索キーワード |
| category | TEXT | カテゴリタグ |
| sources | TEXT[] | 検索対象ソースリスト |
| is_active | BOOLEAN | 有効/無効 |
| created_at | TIMESTAMPTZ | 作成日時 |

#### `paper_keywords`（論文-キーワード関連テーブル）
| カラム名 | 型 | 説明 |
|---------|------|------|
| paper_id | UUID (FK) | papers.id |
| keyword_id | UUID (FK) | keywords.id |

#### `collection_logs`（収集ログテーブル）
| カラム名 | 型 | 説明 |
|---------|------|------|
| id | UUID (PK) | 主キー |
| keyword_id | UUID (FK) | 対象キーワード |
| status | TEXT | success / error |
| papers_found | INTEGER | 取得件数 |
| message | TEXT | ログメッセージ |
| executed_at | TIMESTAMPTZ | 実行日時 |

---

## 5. 画面構成

```
/                          → トップ（論文一覧）
/papers/:id                → 論文詳細
/papers/new                → 論文手動登録
/keywords                  → キーワード管理
/favorites                 → お気に入り一覧
/settings                  → 設定（API キー等）
```

### 5.1 レイアウト
- **ヘッダー**: アプリ名、ナビゲーション（一覧 / 登録 / キーワード / お気に入り / 設定）
- **メインコンテンツ**: 各ページの内容
- **レスポンシブ対応**: PC・タブレット・スマートフォン

### 5.2 デザイン方針
- Tailwind CSSによるシンプルで読みやすいデザイン
- ダークモード対応
- カードベースのレイアウトで情報を整理

---

## 6. API設計

### 6.1 論文関連

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/papers | 論文一覧取得（検索・フィルタ対応） |
| GET | /api/papers/:id | 論文詳細取得 |
| POST | /api/papers | 論文手動登録 |
| PATCH | /api/papers/:id | 論文更新（お気に入り・メモ） |
| DELETE | /api/papers/:id | 論文削除 |

### 6.2 キーワード関連

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/keywords | キーワード一覧取得 |
| POST | /api/keywords | キーワード登録 |
| PATCH | /api/keywords/:id | キーワード更新 |
| DELETE | /api/keywords/:id | キーワード削除 |

### 6.3 収集関連

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/collect | 手動で論文収集を実行 |
| GET | /api/collect/logs | 収集ログ取得 |
| POST | /api/cron/collect | Cron Job用エンドポイント |

### 6.4 AI処理

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/ai/summarize | 論文の要約生成 |
| POST | /api/ai/explain | 論文の解説生成 |

### 6.5 Google Drive

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/drive/upload | PDFをGoogle Driveにアップロード |

---

## 7. 外部サービス連携

### 7.1 論文検索API
- **arXiv API**: OAI-PMH / Atom Feed。無料。主にCS・物理・数学系
- **Semantic Scholar API**: REST API。無料枠あり。幅広い分野対応

### 7.2 OpenAI API
- **モデル**: GPT-4o
- **用途**: 要約生成、解説生成、タイトル翻訳
- **コスト管理**: トークン使用量をログに記録

### 7.3 Google Drive API
- **認証**: サービスアカウント方式
- **操作**: PDFファイルのアップロード、共有リンク取得

---

## 8. 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_DRIVE_FOLDER_ID=

# Cron
CRON_SECRET=
```

---

## 9. 開発フェーズ

### Phase 1: 基盤構築
- Next.jsプロジェクトセットアップ
- Supabase設定・テーブル作成
- 基本レイアウト・ナビゲーション

### Phase 2: 論文一覧・詳細画面
- 論文一覧画面（カードレイアウト）
- 論文詳細画面
- お気に入り・メモ機能
- 検索・フィルタ機能

### Phase 3: 論文手動登録
- 登録フォーム
- PDF アップロード
- Google Drive連携

### Phase 4: AI連携
- OpenAI API連携（要約・解説・翻訳）
- 手動登録時の自動AI処理

### Phase 5: 自動収集
- arXiv API / Semantic Scholar API 連携
- キーワード管理画面
- Vercel Cron Jobsによる定期実行
- 収集ログ

### Phase 6: 仕上げ
- レスポンシブ対応
- ダークモード
- パフォーマンス最適化
- Vercelデプロイ・動作確認
