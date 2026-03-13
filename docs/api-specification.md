# API仕様書

## 概要

本ドキュメントは Paper-site の全APIエンドポイントの仕様を定義する。
すべてのAPIは Next.js App Router の Route Handlers として実装されている。

- **ベースURL**: `/api`
- **レスポンス形式**: JSON (`Content-Type: application/json`)
- **認証**: 基本的に認証不要（Cronエンドポイントのみ `CRON_SECRET` による認証あり）

---

## 共通仕様

### エラーレスポンス

すべてのエンドポイントは、エラー時に以下の形式でレスポンスを返す。

```json
{
  "error": "エラーメッセージ"
}
```

### ステータスコード一覧

| コード | 意味 |
|--------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | リクエスト不正 |
| 401 | 認証エラー |
| 404 | リソース未検出 |
| 409 | 競合（重複） |
| 500 | サーバーエラー |

---

## 1. 論文 (Papers)

### GET /api/papers

論文一覧を取得する（ページネーション・フィルタリング対応）。
承認済み（`approved` / `auto_approved`）の論文のみ返却する。

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1ページあたりの件数 |
| `sort` | string | `collected_at` | ソートカラム |
| `order` | string | `desc` | ソート順（`asc` / `desc`） |
| `search` | string | — | 全文検索（タイトル・要約・メモ） |
| `favorite` | string | — | `true` でお気に入りのみ |
| `keyword_id` | string | — | キーワードIDでフィルタ |
| `date_from` | string | — | 日付範囲の開始（YYYY-MM-DD） |
| `date_to` | string | — | 日付範囲の終了（YYYY-MM-DD） |

**レスポンス** `200 OK`

```json
{
  "papers": [
    {
      "id": "uuid",
      "title_original": "Paper Title",
      "title_ja": "論文タイトル",
      "authors": ["Author1", "Author2"],
      "published_date": "2026-01-15",
      "journal": "Nature",
      "doi": "10.1234/example",
      "url": "https://example.com/paper",
      "abstract": "...",
      "summary_ja": "日本語要約",
      "explanation_ja": "日本語解説",
      "relevance_score": 85,
      "is_favorite": false,
      "memo": null,
      "review_status": "approved",
      "collected_at": "2026-01-20T06:00:00Z",
      "source": "arXiv"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

---

### GET /api/papers/:id

指定IDの論文詳細を取得する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | 論文ID |

**レスポンス** `200 OK`

```json
{
  "id": "uuid",
  "title_original": "Paper Title",
  "title_ja": "論文タイトル",
  "authors": ["Author1"],
  "published_date": "2026-01-15",
  "journal": "Nature",
  "doi": "10.1234/example",
  "url": "https://example.com/paper",
  "abstract": "...",
  "summary_ja": "日本語要約",
  "explanation_ja": "日本語解説",
  "relevance_score": 85,
  "is_favorite": false,
  "memo": "メモ内容",
  "review_status": "approved",
  "source": "arXiv",
  "google_drive_url": null,
  "collected_at": "2026-01-20T06:00:00Z",
  "created_at": "2026-01-20T06:00:00Z"
}
```

**エラーレスポンス** `404 Not Found`

```json
{ "error": "Paper not found" }
```

---

### POST /api/papers

論文を手動登録する。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `title_original` | string | **必須** | 原題 |
| `title_ja` | string | — | 日本語タイトル |
| `authors` | string[] | — | 著者リスト |
| `published_date` | string | — | 出版日 |
| `journal` | string | — | ジャーナル名 |
| `doi` | string | — | DOI |
| `url` | string | — | 論文URL |
| `summary_ja` | string | — | 日本語要約 |
| `explanation_ja` | string | — | 日本語解説 |
| `source` | string | — | ソース名 |
| `google_drive_url` | string | — | Google DriveのURL |
| `memo` | string | — | メモ |

**レスポンス** `201 Created`

```json
{
  "id": "uuid",
  "title_original": "Paper Title",
  "...": "..."
}
```

**エラーレスポンス**

- `400 Bad Request` — `title_original` が未指定
- `409 Conflict` — 同一DOIの論文が既に存在

---

### PATCH /api/papers/:id

論文情報を更新する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | 論文ID |

**リクエストボディ**

論文の任意のフィールドを指定可能（`is_favorite`, `memo`, `title_ja` など）。

**レスポンス** `200 OK`

更新後の論文オブジェクトを返却。

**エラーレスポンス** `404 Not Found`

---

### DELETE /api/papers/:id

論文を削除する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | 論文ID |

**レスポンス** `200 OK`

```json
{ "success": true }
```

---

## 2. レビュー (Review)

### GET /api/papers/review

レビュー待ち（`pending`）の論文一覧を取得する。

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `sort` | string | `score_desc` | ソート順（`score_desc` / `collected_at`） |
| `limit` | number | 20 | 取得件数 |

**レスポンス** `200 OK`

```json
{
  "papers": [ "..." ],
  "total_pending": 42
}
```

---

### POST /api/papers/review

個別の論文をレビュー（承認/スキップ）する。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `paper_id` | string (UUID) | **必須** | 論文ID |
| `action` | string | **必須** | `"approve"` または `"skip"` |

**レスポンス** `200 OK`

```json
{
  "success": true,
  "review_status": "approved",
  "paper": { "..." },
  "learned_interests": ["keyword1", "keyword2"]
}
```

**副作用**
- スコアリング精度の追跡（`scoring_feedback` テーブルへ記録）
- 承認/スキップに基づく関心プロファイルの自動学習

---

### POST /api/papers/review/bulk

スコア閾値に基づき、論文を一括承認/スキップする。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `action` | string | **必須** | `"approve_all_auto"` または `"skip_all_auto"` |
| `min_score` | number | — | 承認の最低スコア（デフォルト: 70） |
| `max_score` | number | — | スキップの最大スコア（デフォルト: 30） |

**レスポンス** `200 OK`

```json
{
  "success": true,
  "action": "approve_all_auto",
  "affected_count": 15
}
```

---

## 3. キーワード (Keywords)

### GET /api/keywords

検索キーワード一覧を取得する。

**レスポンス** `200 OK`

```json
{
  "keywords": [
    {
      "id": "uuid",
      "keyword": "machine learning",
      "category": "AI",
      "sources": ["arXiv", "OpenAlex"],
      "journals": null,
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/keywords

検索キーワードを新規作成する。

**リクエストボディ**

| フィールド | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `keyword` | string | **必須** | — | 検索キーワード |
| `category` | string | — | — | カテゴリ |
| `sources` | string[] | — | `["arXiv"]` | 検索ソース |
| `journals` | string[] | — | — | ジャーナル指定 |
| `is_active` | boolean | — | `true` | 有効/無効 |

**レスポンス** `201 Created`

作成されたキーワードオブジェクトを返却。

---

### PATCH /api/keywords/:id

キーワードを更新する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | キーワードID |

**リクエストボディ**

`keyword`, `category`, `sources`, `journals`, `is_active` の任意のフィールドを指定可能。

**レスポンス** `200 OK`

更新後のキーワードオブジェクトを返却。

---

### DELETE /api/keywords/:id

キーワードを削除する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | キーワードID |

**レスポンス** `200 OK`

```json
{ "success": true }
```

---

## 4. RSSフィード (Feeds)

### GET /api/feeds

RSSフィード一覧を取得する。

**レスポンス** `200 OK`

```json
{
  "feeds": [
    {
      "id": "uuid",
      "name": "Nature Feed",
      "feed_url": "https://www.nature.com/nature.rss",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/feeds

RSSフィードを新規登録する。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | **必須** | フィード名 |
| `feed_url` | string | **必須** | RSSフィードURL |
| `is_active` | boolean | — | 有効/無効（デフォルト: true） |

**レスポンス** `201 Created`

作成されたフィードオブジェクトを返却。

---

### PATCH /api/feeds/:id

RSSフィードを更新する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | フィードID |

**リクエストボディ**

`name`, `feed_url`, `is_active` の任意のフィールドを指定可能。

**レスポンス** `200 OK`

更新後のフィードオブジェクトを返却。

---

### DELETE /api/feeds/:id

RSSフィードを削除する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | フィードID |

**レスポンス** `200 OK`

```json
{ "success": true }
```

---

## 5. 関心プロファイル (Interests)

### GET /api/interests

関心キーワード一覧を取得する。

**レスポンス** `200 OK`

```json
{
  "interests": [
    {
      "id": "uuid",
      "label": "deep learning",
      "weight": 1.0,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/interests

関心キーワードを手動追加する。

**リクエストボディ**

| フィールド | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `label` | string | **必須** | — | 関心キーワード |
| `weight` | number | — | `1.0` | 重み（0.0〜1.0） |

**レスポンス** `201 Created`

作成された関心オブジェクトを返却。

---

### PATCH /api/interests/:id

関心キーワードを更新する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | 関心ID |

**リクエストボディ**

`label`, `weight` の任意のフィールドを指定可能。

**レスポンス** `200 OK`

更新後の関心オブジェクトを返却。

---

### DELETE /api/interests/:id

関心キーワードを削除する。

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (UUID) | 関心ID |

**レスポンス** `200 OK`

```json
{ "success": true }
```

---

## 6. AI処理 (AI)

### POST /api/ai/process

論文のタイトル翻訳・要約・解説を一括生成する。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `paper_id` | string (UUID) | — | 指定時はDB更新を行う |
| `title_original` | string | **必須** | 論文の原題 |
| `authors` | string[] | — | 著者リスト |
| `abstract` | string | — | アブストラクト |
| `text` | string | — | 論文本文 |

**レスポンス** `200 OK`

```json
{
  "title_ja": "日本語タイトル",
  "summary_ja": "日本語要約（200〜400字）",
  "explanation_ja": "日本語解説",
  "total_tokens": 1500
}
```

**副作用**: `paper_id` 指定時、対象論文の `title_ja`, `summary_ja`, `explanation_ja` を更新。

---

### POST /api/ai/summarize

論文の日本語要約のみを生成する。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `paper_id` | string (UUID) | — | 指定時はDB更新を行う |
| `title_original` | string | **必須** | 論文の原題 |
| `authors` | string[] | — | 著者リスト |
| `abstract` | string | — | アブストラクト |
| `text` | string | — | 論文本文 |

**レスポンス** `200 OK`

```json
{
  "summary": "日本語要約テキスト",
  "usage": { "...": "..." }
}
```

---

### POST /api/ai/explain

論文の日本語解説のみを生成する。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `paper_id` | string (UUID) | — | 指定時はDB更新を行う |
| `title_original` | string | **必須** | 論文の原題 |
| `authors` | string[] | — | 著者リスト |
| `abstract` | string | — | アブストラクト |
| `text` | string | — | 論文本文 |

**レスポンス** `200 OK`

```json
{
  "explanation": "日本語解説テキスト",
  "usage": { "...": "..." }
}
```

---

## 7. PDF解析 (PDF)

### POST /api/pdf/parse

PDFファイルからメタデータを抽出する。

**リクエスト**: `multipart/form-data`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` | File | **必須** | PDFファイル（`application/pdf` のみ） |

**レスポンス** `200 OK`

```json
{
  "title": "Extracted Paper Title",
  "authors": ["Author1", "Author2"],
  "journal": "Nature",
  "published_date": "2026-01-15",
  "doi": "10.1234/example",
  "abstract": "論文のアブストラクト",
  "text": "本文テキスト（先頭12000文字）",
  "pages": 12
}
```

**エラーレスポンス** `400 Bad Request` — PDF以外のファイル

**備考**: Gemini AIでメタデータ抽出を試み、失敗時はPDFメタデータにフォールバック。

---

## 8. Google Drive (Drive)

### POST /api/drive/upload

PDFファイルをGoogle Driveにアップロードする。

**リクエスト**: `multipart/form-data`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` | File | **必須** | PDFファイル（`application/pdf` のみ） |

**レスポンス** `201 Created`

```json
{
  "url": "https://drive.google.com/file/d/xxx/view"
}
```

**エラーレスポンス**

- `400 Bad Request` — PDF以外のファイル
- `500 Internal Server Error` — Google Drive認証エラー

```json
{
  "error": "エラーメッセージ",
  "error_code": "env_not_configured"
}
```

**エラーコード一覧**

| コード | 説明 |
|--------|------|
| `env_not_configured` | OAuth未接続かつサービスアカウント未設定 |
| `invalid_config` | サービスアカウント設定が不正 |

**備考**: OAuth認証優先、未接続時はサービスアカウントにフォールバック。両方未設定の場合は `env_not_configured` エラー。

---

## 9. Google OAuth認証 (Auth)

### GET /api/auth/google

Google OAuth 2.0 認証を開始する。Googleの同意画面へリダイレクトする。

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `returnTo` | string | `/settings` | 認証完了後のリダイレクト先（相対パスのみ） |

**レスポンス** `302 Found` — Google OAuth 同意画面へリダイレクト

**エラーレスポンス** `302 Found` — `/settings?error=google_auth_failed` へリダイレクト

**備考**: `returnTo` が相対パスでない場合はオープンリダイレクト防止のため `/settings` にフォールバックする。

---

### GET /api/auth/google/callback

Google OAuth コールバック。認証コードをトークンに交換し、DBに保存する。

**クエリパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `code` | string | Google OAuth 認証コード |
| `state` | string | リダイレクト先パス（`returnTo` から引き継ぎ） |

**レスポンス** `302 Found` — `state` で指定されたパスへリダイレクト

**エラーレスポンス** `302 Found` — `/settings?error=google_auth_failed` へリダイレクト

**副作用**: `review_settings` テーブルに `google_drive_refresh_token` と `google_drive_email` を保存。

---

### GET /api/auth/google/status

Google Drive の接続状態を取得する。

**レスポンス** `200 OK`

```json
{
  "connected": true,
  "email": "user@gmail.com"
}
```

**備考**: トークンが存在しない場合は `{ "connected": false, "email": null }` を返す。

---

### POST /api/auth/google/disconnect

Google Drive 接続を解除する。トークンを失効させ、DBから削除する。

**レスポンス** `200 OK`

```json
{ "success": true }
```

**エラーレスポンス** `500 Internal Server Error`

```json
{ "error": "切断に失敗しました" }
```

**副作用**: Google APIでトークンを失効させ、`review_settings` から `google_drive_refresh_token` と `google_drive_email` をクリアする。

---

## 10. 論文収集 (Collection)

### POST /api/collect

キーワード検索とRSSフィードから論文を手動収集する。

**リクエストボディ**: なし

**レスポンス** `200 OK`

```json
{
  "keyword_results": [
    {
      "keyword": "machine learning",
      "source": "arXiv",
      "found": 5,
      "new": 3,
      "error": null
    }
  ],
  "rss_results": [
    {
      "feed": "Nature Feed",
      "found": 10,
      "new": 7,
      "error": null
    }
  ],
  "summary": {
    "keywords_processed": 3,
    "keyword_papers_found": 12,
    "keyword_errors": 0,
    "feeds_processed": 2,
    "rss_papers_found": 15,
    "rss_errors": 0,
    "total_papers_found": 27
  }
}
```

---

### GET /api/collect/logs

収集実行ログを取得する。

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `limit` | number | 50 | 取得件数 |

**レスポンス** `200 OK`

```json
{
  "logs": [
    {
      "id": "uuid",
      "source_type": "keyword",
      "source_name": "machine learning",
      "papers_found": 5,
      "papers_new": 3,
      "error_message": null,
      "executed_at": "2026-01-20T06:00:00Z"
    }
  ]
}
```

---

## 11. Cron (定期自動収集)

### GET / POST /api/cron/collect

Vercel Cronから毎日06:00 UTCに呼び出される自動収集エンドポイント。

**認証**

| ヘッダー | 値 | 説明 |
|---|---|---|
| `Authorization` | `Bearer {CRON_SECRET}` | `CRON_SECRET` 環境変数が設定されている場合は必須 |

**レスポンス** `200 OK`

```json
{
  "ok": true,
  "keywords_processed": 3,
  "keyword_papers_found": 12,
  "feeds_processed": 2,
  "rss_papers_found": 15,
  "total_papers_found": 27,
  "keyword_results": ["..."],
  "rss_results": ["..."]
}
```

**自動収集無効時のレスポンス** `200 OK`

```json
{
  "ok": true,
  "skipped": true,
  "reason": "Auto-collection is disabled in settings"
}
```

**エラーレスポンス** `401 Unauthorized` — `CRON_SECRET` 不一致

---

## 12. 設定 (Settings)

### GET /api/settings/review

レビュー・スコアリング設定を取得する。

**レスポンス** `200 OK`

```json
{
  "id": "uuid",
  "auto_approve_threshold": 70,
  "auto_skip_threshold": 30,
  "scoring_enabled": true,
  "auto_collect_enabled": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-20T00:00:00Z"
}
```

---

### PATCH /api/settings/review

レビュー・スコアリング設定を更新する。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `auto_approve_threshold` | number | — | 自動承認の閾値スコア |
| `auto_skip_threshold` | number | — | 自動スキップの閾値スコア |
| `scoring_enabled` | boolean | — | スコアリング有効/無効 |
| `auto_collect_enabled` | boolean | — | 自動収集有効/無効 |

**レスポンス** `200 OK`

更新後の設定オブジェクトを返却。

---

### GET /api/settings/review/metrics

スコアリング精度メトリクスを取得する。

**レスポンス** `200 OK`

```json
{
  "total_reviews": 100,
  "score_gap": 15.2,
  "accuracy": 0.78,
  "precision_at_10": 0.90,
  "avg_approved_score": 72.5,
  "avg_skipped_score": 35.8
}
```

---

## 13. スコアリング診断 (Scoring)

### GET /api/scoring/test

スコアリングシステムの診断テストを実行する。Gemini APIの設定比較テストを含む。

**レスポンス** `200 OK`

```json
{
  "interests": {
    "count": 10,
    "error": null,
    "items": ["deep learning", "NLP", "..."]
  },
  "settings": {
    "scoring_enabled": true,
    "auto_approve_threshold": 70,
    "auto_skip_threshold": 30
  },
  "api_test": "OK",
  "test_fixed_config": {
    "raw_text": "{\"score\":75,\"reason\":\"...\"}",
    "parsed": { "score": 75, "reason": "..." },
    "elapsed_ms": 1200
  },
  "test_old_config": {
    "raw_text": "{\"score\":80,\"reason\":\"...\"}",
    "parsed": { "score": 80, "reason": "..." },
    "elapsed_ms": 2500
  },
  "score_distribution": {
    "total": 150,
    "avg": 55.3,
    "min": 5,
    "max": 98,
    "distribution": {
      "0-20": 15,
      "21-40": 30,
      "41-60": 40,
      "61-80": 45,
      "81-100": 20
    }
  }
}
```

---

### POST /api/scoring/rescore

レビュー待ち論文を現在の関心プロファイルで再スコアリングする（最大50件）。

**リクエストボディ**: なし

**レスポンス** `200 OK`

```json
{
  "message": "15件の論文を再スコアリングしました",
  "rescored": 15,
  "errors": 0,
  "total_pending": 42,
  "results": [
    {
      "title": "Paper Title",
      "old_score": 45,
      "new_score": 72
    }
  ]
}
```

**エラーレスポンス** `400 Bad Request`
- スコアリングが無効
- 関心プロファイルが未登録

---

## 14. Notion連携 (Notion)

### GET /api/notion/settings

Notion連携設定を取得する。

**レスポンス** `200 OK`

```json
{
  "notion_database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "is_configured": true
}
```

**備考**: `is_configured` は `NOTION_TOKEN` 環境変数が設定されており、かつ `notion_database_id` が空でない場合に `true`。

---

### PATCH /api/notion/settings

NotionデータベースIDを更新する。保存時に接続検証を行う。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `notion_database_id` | string | **必須** | NotionデータベースID（空文字で設定クリア） |

**レスポンス** `200 OK`

```json
{ "success": true }
```

**エラーレスポンス** `400 Bad Request` — データベースIDが無効またはインテグレーション未接続

---

### POST /api/notion/settings/test

Notion接続テストを実行する。

**リクエストボディ**: なし

**レスポンス** `200 OK`

```json
{ "connected": true }
```

**エラーレスポンス** `400 Bad Request`

```json
{
  "connected": false,
  "error": "エラーメッセージ"
}
```

---

### POST /api/notion/export

論文をNotionデータベースにエクスポートする。既存ページがある場合は更新。

**リクエストボディ**

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `paper_id` | string (UUID) | **必須** | 論文ID |

**レスポンス** `200 OK`

```json
{
  "success": true,
  "notion_page_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "notion_page_url": "https://www.notion.so/..."
}
```

**副作用**: 対象論文の `notion_page_id`, `notion_page_url`, `notion_exported_at` を更新。

**エラーレスポンス**
- `400 Bad Request` — `paper_id` 未指定
- `404 Not Found` — 論文が存在しない
- `500 Internal Server Error` — Notion APIエラー

---

## エンドポイント一覧

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/papers` | 論文一覧取得 |
| GET | `/api/papers/:id` | 論文詳細取得 |
| POST | `/api/papers` | 論文手動登録 |
| PATCH | `/api/papers/:id` | 論文更新 |
| DELETE | `/api/papers/:id` | 論文削除 |
| GET | `/api/papers/review` | レビュー待ち一覧 |
| POST | `/api/papers/review` | 個別レビュー |
| POST | `/api/papers/review/bulk` | 一括レビュー |
| GET | `/api/keywords` | キーワード一覧 |
| POST | `/api/keywords` | キーワード作成 |
| PATCH | `/api/keywords/:id` | キーワード更新 |
| DELETE | `/api/keywords/:id` | キーワード削除 |
| GET | `/api/feeds` | RSSフィード一覧 |
| POST | `/api/feeds` | RSSフィード登録 |
| PATCH | `/api/feeds/:id` | RSSフィード更新 |
| DELETE | `/api/feeds/:id` | RSSフィード削除 |
| GET | `/api/interests` | 関心一覧 |
| POST | `/api/interests` | 関心追加 |
| PATCH | `/api/interests/:id` | 関心更新 |
| DELETE | `/api/interests/:id` | 関心削除 |
| POST | `/api/ai/process` | AI一括処理 |
| POST | `/api/ai/summarize` | AI要約生成 |
| POST | `/api/ai/explain` | AI解説生成 |
| POST | `/api/pdf/parse` | PDF解析 |
| POST | `/api/drive/upload` | Google Driveアップロード |
| GET | `/api/auth/google` | Google OAuth認証開始 |
| GET | `/api/auth/google/callback` | Google OAuthコールバック |
| GET | `/api/auth/google/status` | Google Drive接続状態取得 |
| POST | `/api/auth/google/disconnect` | Google Drive接続解除 |
| POST | `/api/collect` | 手動収集 |
| GET | `/api/collect/logs` | 収集ログ取得 |
| GET/POST | `/api/cron/collect` | 定期自動収集 |
| GET | `/api/settings/review` | 設定取得 |
| PATCH | `/api/settings/review` | 設定更新 |
| GET | `/api/settings/review/metrics` | メトリクス取得 |
| GET | `/api/scoring/test` | スコアリング診断 |
| POST | `/api/scoring/rescore` | 再スコアリング |
| GET | `/api/notion/settings` | Notion設定取得 |
| PATCH | `/api/notion/settings` | Notion設定更新 |
| POST | `/api/notion/settings/test` | Notion接続テスト |
| POST | `/api/notion/export` | Notionエクスポート |
