# スコアリング精度向上 TODOリスト

> 参照: [scoring-improvement-plan.md](./scoring-improvement-plan.md) / [techniques-reference.md](./techniques-reference.md)

---

## Phase 1: 低コスト・高効果の即効施策

### TODO 1: アブストラクトの保存と活用
- [x] 1-1. Supabase SQL Editor で `ALTER TABLE papers ADD COLUMN abstract TEXT;` を実行 ※要手動実行
- [x] 1-2. `src/lib/collector.ts` — insert時に `abstract: paper.abstract || null` を追加
- [x] 1-3. `src/lib/rss-collector.ts` — RSSエントリの description を abstract として保存
- [x] 1-4. `src/lib/rss.ts` — `RssEntry` 型に `abstract` フィールドを追加（既に存在していた）
- [x] 1-5. `src/lib/scoring.ts` — スコアリングプロンプトに `abstract`（先頭500文字）を含める
- [x] 1-6. `src/types/database.ts` — `Paper` 型に `abstract` フィールドを追加
- [x] 1-7. ビルド確認 (`npm run build`)

### TODO 2: Chain-of-Thought スコアリングの導入
- [x] 2-1. `src/lib/scoring.ts` — `SCORING_PROMPT` を改善（評価手順の明示、JSON出力形式に変更）
- [x] 2-2. `src/lib/scoring.ts` — config変更: `thinkingBudget: 0 → 1024`
- [x] 2-3. `src/lib/scoring.ts` — config変更: `maxOutputTokens: 10 → 300`
- [x] 2-4. `src/lib/scoring.ts` — config追加: `responseMimeType: "application/json"`
- [x] 2-5. `src/lib/scoring.ts` — レスポンスパーサーを JSON 対応に変更（`reasoning`, `matched_interests`, `score` を抽出）
- [ ] 2-6. `scoring_feedback` 等に `reasoning` を保存する仕組みの検討（任意・将来対応）
- [x] 2-7. ビルド確認 (`npm run build`)

### TODO 3: スコアリング精度トラッキング基盤の構築
- [x] 3-1. Supabase SQL Editor で `scoring_feedback` テーブルを作成（+ RLSポリシー）※要手動実行
- [x] 3-2. `src/types/database.ts` — `ScoringFeedback` 型を追加
- [x] 3-3. `src/lib/scoring.ts` — `trackScoringAccuracy()` 関数を追加
- [x] 3-4. `src/app/api/papers/review/route.ts` — approve/skip実行時に `trackScoringAccuracy()` を呼び出し
- [x] 3-5. `src/app/api/settings/review/metrics/route.ts` — 精度メトリクスAPI を新規作成（scoreGap, Precision@K, 正解率）
- [x] 3-6. `src/app/settings/page.tsx` — スコアリング精度ダッシュボード（簡易表示）を追加
- [x] 3-7. ビルド確認 (`npm run build`)

### Phase 1 完了条件
- [x] デプロイ・動作確認
- [ ] 1〜2週間レビューを蓄積し、Phase 1 メトリクスを計測

---

## Phase 2: Few-Shot 学習とシグナル拡張

### TODO 4: Few-Shot Examples のプロンプト注入
- [ ] 4-1. `src/lib/scoring.ts` — `buildFewShotExamples()` 関数を新規作成（approve/skip各3件をDBから取得）
- [ ] 4-2. `src/lib/scoring.ts` — `scoreRelevance()` 内で Few-Shot 例をプロンプトに動的追加
- [ ] 4-3. レビュー履歴が20件未満の場合はFew-Shot注入をスキップするガード処理
- [ ] 4-4. ビルド確認 (`npm run build`)

### TODO 5: 引用数・新しさシグナルの追加
- [ ] 5-1. Supabase SQL Editor で `ALTER TABLE papers ADD COLUMN citation_count INTEGER;` を実行
- [ ] 5-2. `src/lib/semantic-scholar.ts` — API fieldsに `citationCount` を追加、型を拡張
- [ ] 5-3. `src/lib/openalex.ts` — API select に `cited_by_count` を追加、型を拡張
- [ ] 5-4. `src/lib/collector.ts` — 正規化関数 + insert に `citation_count` を追加
- [ ] 5-5. `src/lib/scoring.ts` — `citationScore()` 関数を追加（対数スケール: 0→30, 10→53, 100→76, 1000→99）
- [ ] 5-6. `src/lib/scoring.ts` — `recencyScore()` 関数を追加（30日以内→100, 1年→50, 3年以上→10）
- [ ] 5-7. `src/lib/scoring.ts` — 最終スコア計算を加重平均に変更（LLM×0.7 + 引用数×0.1 + 新しさ×0.2）
- [ ] 5-8. `src/types/database.ts` — `Paper` 型に `citation_count` フィールドを追加
- [ ] 5-9. ビルド確認 (`npm run build`)

### Phase 2 完了条件
- [ ] デプロイ・動作確認
- [ ] 1週間レビュー蓄積 → Phase 1 vs Phase 2 メトリクス比較

---

## Phase 3: Embedding ベースの意味的マッチング

### TODO 6: Gemini Embedding API の導入
- [ ] 6-1. Supabase SQL Editor で pgvector 拡張有効化 + embedding カラム追加 + インデックス作成
- [ ] 6-2. `src/lib/embedding.ts` — 新規作成（`getEmbedding()`, `cosineSimilarity()`, `getInterestEmbedding()`）
- [ ] 6-3. `src/lib/collector.ts` — 論文保存時に embedding を生成・保存
- [ ] 6-4. `src/lib/rss-collector.ts` — 同上
- [ ] 6-5. `src/types/database.ts` — `Paper` 型に `embedding` フィールドを追加
- [ ] 6-6. ビルド確認 (`npm run build`)

### TODO 7: ハイブリッドスコアリングパイプライン
- [ ] 7-1. `src/lib/scoring.ts` — Embedding 類似度算出を統合（< 0.3 は LLM スキップ）
- [ ] 7-2. `src/lib/scoring.ts` — 最終スコア計算を更新（LLM×0.5 + Embedding×0.2 + 引用数×0.1 + 新しさ×0.2）
- [ ] 7-3. `src/lib/scoring.ts` — LLM スキップ時のフォールバックスコア計算
- [ ] 7-4. ビルド確認 (`npm run build`)

### Phase 3 完了条件
- [ ] デプロイ・動作確認
- [ ] LLM 呼び出し率の計測（目標: 全論文の60%未満）
- [ ] 1週間レビュー蓄積 → Phase 2 vs Phase 3 メトリクス比較

---

## Phase 4: フィードバック学習の強化

### TODO 8: EMA ベースの重み更新
- [ ] 8-1. Supabase SQL Editor で interests テーブルに `hit_count`, `last_hit_at` カラム追加
- [ ] 8-2. `src/lib/interest-learner.ts` — 承認時の重み更新を EMA 方式に変更（学習率 α=0.15）
- [ ] 8-3. `src/lib/interest-learner.ts` — スキップ時の重み減少を改善（-0.05 → -0.08、下限0.1）
- [ ] 8-4. `src/lib/interest-learner.ts` — `hit_count`, `last_hit_at` を更新するロジック追加
- [ ] 8-5. 長期間ヒットしないキーワードの自然減衰処理を検討（バッチ or Cron）
- [ ] 8-6. ビルド確認 (`npm run build`)

### TODO 9: ネガティブキーワードの導入（将来検討）
- [ ] 9-1. 設計検討: skip 論文からのネガティブシグナル活用方法
- [ ] 9-2. コスト見積もり: skip 時の LLM 呼び出しコスト vs バッチ処理
- [ ] 9-3. 実装（設計確定後）

### Phase 4 完了条件
- [ ] デプロイ・動作確認
- [ ] 関心プロファイルの重み収束状況を確認

---

## Phase 5: 軽量プリフィルタリング

### TODO 10: BM25 キーワードマッチによるプリフィルタ
- [ ] 10-1. `src/lib/keyword-filter.ts` — 新規作成（`quickKeywordScore()` 自前実装、外部ライブラリ不要）
- [ ] 10-2. `src/lib/rss-collector.ts` — 収集時に BM25 スコア < 10 の論文を Embedding/LLM スキップ
- [ ] 10-3. `src/lib/collector.ts` — 同上
- [ ] 10-4. ビルド確認 (`npm run build`)

### Phase 5 完了条件
- [ ] デプロイ・動作確認
- [ ] プリフィルタ除外率の計測
- [ ] LLM 呼び出し率の再計測（目標: 全論文の60%未満）

---

## DB 移行 SQL チェックリスト

各フェーズ実装前に Supabase SQL Editor で実行する。

### Phase 1
- [ ] `ALTER TABLE papers ADD COLUMN abstract TEXT;`
- [ ] `scoring_feedback` テーブル作成 + RLS ポリシー

### Phase 2
- [ ] `ALTER TABLE papers ADD COLUMN citation_count INTEGER;`

### Phase 3
- [ ] `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] `ALTER TABLE papers ADD COLUMN embedding vector(256);`
- [ ] `CREATE INDEX papers_embedding_idx ON papers USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`

### Phase 4
- [ ] `ALTER TABLE interests ADD COLUMN hit_count INTEGER DEFAULT 0;`
- [ ] `ALTER TABLE interests ADD COLUMN last_hit_at TIMESTAMPTZ;`

---

## KPI 目標値

| メトリクス | 定義 | 目標値 | 計測開始 |
|-----------|------|--------|---------|
| scoreGap | 承認論文と棄却論文の平均AIスコア差 | > 30 | Phase 1 完了後 |
| Precision@10 | 上位10件中のユーザー承認率 | > 80% | Phase 1 完了後 |
| 自動判定正解率 | auto_approved/auto_skipped と手動判定の一致率 | > 85% | Phase 1 完了後 |
| LLM呼び出し率 | 全論文のうち LLM スコアリングを実行した割合 | < 60% | Phase 3 完了後 |
