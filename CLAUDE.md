# CLAUDE.md — Paper-site

## プロジェクト概要
論文管理Webアプリ。キーワードやRSSフィードで学術論文を自動収集し、AIで関連度スコアリング・要約・解説を生成。お気に入り・メモ機能付きのキュレーションサイト。

## 技術スタック
- **フレームワーク**: Next.js 16 (App Router) / React 19 / TypeScript 5
- **スタイリング**: Tailwind CSS 4
- **データベース**: Supabase (PostgreSQL)
- **AI**: Gemini 2.5 Flash (`@google/genai`)
- **デプロイ**: Vercel（cron: 毎日06:00 UTC に `/api/cron/collect`）
- **リンター/フォーマッター**: ESLint 9 + Prettier

## コマンド
```bash
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
npm run lint     # ESLint実行
```

## ディレクトリ構成
```
src/
├── app/              # Next.js App Router ページ・APIルート
│   ├── api/          # APIエンドポイント
│   │   ├── ai/        # AI要約・解説生成
│   │   ├── auth/      # Google OAuth認証（接続・コールバック・ステータス・切断）
│   │   ├── collect/   # 論文収集トリガー
│   │   ├── cron/      # Vercel Cron（定期自動収集）
│   │   ├── drive/     # Google Drive連携
│   │   ├── feeds/     # RSSフィード管理
│   │   ├── interests/ # 関心プロファイル管理
│   │   ├── keywords/  # キーワード管理
│   │   ├── papers/    # 論文CRUD
│   │   ├── pdf/       # PDF解析
│   │   ├── notion/    # Notion連携（エクスポート・設定）
│   │   ├── scoring/   # スコアリング診断・再スコアリング
│   │   └── settings/  # レビュー設定
│   ├── favorites/    # お気に入り一覧ページ
│   ├── feeds/        # RSSフィード管理ページ
│   ├── interests/    # 関心プロファイルページ
│   ├── keywords/     # キーワード管理ページ
│   ├── papers/       # 論文詳細ページ
│   ├── review/       # レビュー待ち論文ページ
│   └── settings/     # 設定・スコアリングメトリクスページ
├── components/       # 共有UIコンポーネント
├── lib/              # ビジネスロジック・外部連携
│   ├── scoring.ts      # AIスコアリング（Gemini 2.5 Flash）
│   ├── collector.ts    # キーワードベース論文収集
│   ├── rss-collector.ts# RSSフィード論文収集
│   ├── ai.ts           # AI要約・解説生成
│   ├── supabase.ts     # Supabaseクライアント
│   ├── arxiv.ts        # arXiv API連携
│   ├── openalex.ts     # OpenAlex API連携
│   ├── semantic-scholar.ts # Semantic Scholar API連携
│   ├── rss.ts          # RSSパーサー
│   ├── google-drive.ts # Google Drive連携（OAuth/サービスアカウント デュアルモード認証）
│   ├── google-oauth.ts # Google OAuth 2.0ヘルパー（トークン管理・認証URL生成）
│   ├── notion.ts       # Notion API連携
│   └── interest-learner.ts # 関心学習
└── types/
    └── database.ts   # DB型定義
supabase/
└── schema.sql        # データベーススキーマ
```

## データベーステーブル
- `papers` — 論文データ（タイトル、著者、要約、スコア、お気に入り、メモなど）
- `keywords` — 検索キーワード（カテゴリ、ソース指定）
- `paper_keywords` — 論文-キーワード関連（多対多）
- `rss_feeds` — RSSフィード登録
- `collection_logs` — 収集実行ログ
- `interests` — 関心プロファイル
- `review_settings` — スコアリング閾値・機能設定・Notion連携設定・Google OAuth トークン

## 環境変数
必要な環境変数（`.env.local`）:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase接続
- `GEMINI_API_KEY` — Gemini AI API
- `GOOGLE_DRIVE_FOLDER_ID` — Google Drive保存先フォルダID
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — Google OAuth 2.0クライアント認証情報
- `GOOGLE_SERVICE_ACCOUNT_KEY` — サービスアカウント認証情報（オプション、OAuth未接続時のフォールバック）
- `CRON_SECRET` — Vercel Cronの認証
- `NOTION_TOKEN` — Notion Internal Integration Token（Notion連携）

## コーディング規約
- パスエイリアス `@/*` → `./src/*` を使用する
- コンポーネントは `src/components/` に配置
- APIルートは Next.js App Router の Route Handlers (`route.ts`) で実装
- データベース操作は `src/lib/supabase.ts` のクライアントを通じて行う
- 日本語UIを基本とする

## Gemini API 注意事項
- Gemini 2.5 Flash は**thinking mode がデフォルトON**。JSON応答が切り詰められる原因になる
- JSON構造化出力時は必ず `thinkingConfig: { thinkingBudget: 0 }` を設定する
- `responseMimeType: "application/json"` と `maxOutputTokens: 1024` を併用する

## Git コミット規約
- 日本語コミットメッセージ可
- プレフィックス: `feat:`, `fix:`, `docs:` など conventional commits に準拠

## 画面設計

@docs/screen-definitions.md

## API仕様書

docs/api-specification.md

## テスト仕様書

docs/test-specification.md