# AI論文自動選定 精度向上 計画書

## 1. 現状分析

### 1.1 現在のスコアリングシステム

| 項目 | 内容 |
|------|------|
| モデル | Gemini 2.5 Flash |
| 入力 | タイトル + 著者 + 日本語タイトル（+ 要約がある場合） |
| 出力 | 0-100の整数スコアのみ |
| プロンプト | 5段階評価基準のシステムプロンプト |
| 設定 | `temperature: 0.1`, `maxOutputTokens: 10`, `thinkingBudget: 0` |
| 関心プロファイル | 手動キーワード（weight付き）+ 自動学習キーワード |

### 1.2 主要な課題

1. **情報不足**: アブストラクトが収集時に取得されているが、DBに保存されておらず、スコアリング時に使用できていない
2. **推論なし**: `thinkingBudget: 0`により、LLMが浅い判断しかできない
3. **単一シグナル**: LLMスコアのみに依存しており、引用数や新しさなどの補助シグナルがない
4. **評価基盤なし**: スコアリング精度を定量的に測定・追跡する仕組みがない
5. **フィードバック活用不足**: ユーザーのapprove/skip履歴がスコアリングプロンプトに反映されていない

---

## 2. 改善施策の体系

### 全体アーキテクチャ（目標状態）

```
論文取得
  ↓
[Tier 1] キーワードマッチ（BM25）  ← 無料・即座
  ↓ (低スコアを除外)
[Tier 2] Embedding 類似度          ← 低コスト
  ↓ (低類似度を除外)
[Tier 3] LLM スコアリング（CoT）    ← 高精度・アブストラクト含む
  ↓
マルチシグナル統合（AI + 引用数 + 新しさ）
  ↓
最終スコア → review_status 決定
  ↓
ユーザーレビュー → フィードバック学習 → 関心プロファイル更新
  ↓
精度メトリクス記録 → 改善サイクル
```

---

## 3. 実装フェーズ

### Phase 1: 低コスト・高効果の即効施策

**目標**: 最小限の変更で最大の精度向上を得る

#### TODO 1: アブストラクトの保存と活用

**課題**: arXiv / Semantic Scholar / OpenAlex から取得済みのアブストラクトがDBに保存されていない

**変更内容**:
- `papers` テーブルに `abstract` カラム追加
- `collector.ts`: insert時にabstractを保存
- `rss-collector.ts`: RSSエントリのdescriptionをabstractとして保存
- `scoring.ts`: スコアリング時にアブストラクト（先頭500文字）をプロンプトに含める

**期待効果**: タイトルだけでは判断困難な論文の精度が大幅改善
**実装難易度**: 簡単（DBカラム追加 + 3ファイル修正）

#### TODO 2: Chain-of-Thought スコアリングの導入

**課題**: `thinkingBudget: 0` + `maxOutputTokens: 10` で推論なしの浅い判断

**変更内容**:
- `scoring.ts` のプロンプトを改善（評価手順を明示、JSON出力に変更）
- `thinkingBudget: 0 → 1024` に変更（推論を有効化）
- `maxOutputTokens: 10 → 300` に変更
- `responseMimeType: "application/json"` を追加
- 出力形式: `{ "reasoning": "理由", "matched_interests": [...], "score": 数値 }`

**改善プロンプト案**:
```
## 評価手順（必ずこの順序で考えてください）
1. 論文の主要研究テーマを特定する
2. 各関心キーワードとの関連性を個別に評価する（重みを考慮）
3. 直接的関連 vs 間接的関連 を区別する
4. 総合スコアを決定する
```

**期待効果**: 推論プロセスの明示化で13%以上の精度向上が見込まれる
**実装難易度**: 簡単（プロンプト + config変更のみ）
**コスト増**: 出力トークン10→300（Gemini 2.5 Flash は安価なため影響軽微）

#### TODO 3: スコアリング精度トラッキング基盤の構築

**課題**: 改善施策の効果を定量的に測定する手段がない

**変更内容**:
- `scoring_feedback` テーブル新規作成
- レビューAPI（approve/skip実行時）にフィードバック記録を追加
- 精度メトリクスAPI（`/api/settings/review/metrics`）を新規作成
- 設定ページにスコアリング精度ダッシュボードを追加

**記録するデータ**:
```sql
CREATE TABLE scoring_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES papers(id),
  ai_score INTEGER,
  user_action TEXT,        -- 'approve' / 'skip'
  scoring_method TEXT,     -- 'v1', 'v2' etc.
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**主要メトリクス**:
- **scoreGap**: 承認論文と棄却論文の平均スコア差（大きいほど良い）
- **Precision@K**: 上位K件中のユーザー承認割合
- **正解率**: AIの自動判定（auto_approved/auto_skipped）と手動判定の一致率

**期待効果**: 全ての改善施策の効果測定基盤
**実装難易度**: 簡単

---

### Phase 2: Few-Shot学習とシグナル拡張

**目標**: ユーザー履歴を活用し、補助シグナルを追加する

#### TODO 4: Few-Shot Examples のプロンプト注入

**課題**: LLMがユーザーの具体的な嗜好パターンを知らない

**変更内容**:
- `scoring.ts`: 過去のレビュー結果（approve/skip各3件）をプロンプトに動的追加
- 最新の手動レビュー結果を優先

**プロンプト追加部分**:
```
## 参考：過去のレビュー結果
### 興味ありと判定された論文:
- "論文A" → 高スコア
- "論文B" → 高スコア
### スキップされた論文:
- "論文C" → 低スコア
- "論文D" → 低スコア
```

**期待効果**: ユーザーの暗黙的嗜好パターンをLLMが学習
**実装難易度**: 簡単
**前提条件**: レビュー履歴が20件以上蓄積されてから有効化

#### TODO 5: 引用数・新しさシグナルの追加

**課題**: 論文の品質・重要性を示す客観的指標がない

**変更内容**:
- `papers` テーブルに `citation_count` カラム追加
- `semantic-scholar.ts`: citationCount フィールドを取得
- `openalex.ts`: cited_by_count フィールドを取得
- `collector.ts`: 引用数をDBに保存
- `scoring.ts`: 引用数スコアと新しさスコアを算出し、LLMスコアと加重平均

**スコア統合式**:
```
最終スコア = LLMスコア × 0.7 + 引用数スコア × 0.1 + 新しさスコア × 0.2
```

**引用数スコア**: 対数スケール（0引用→30, 10引用→60, 100引用→80, 1000引用→100）
**新しさスコア**: 30日以内→100, 1年→50, 3年以上→10

**期待効果**: 質の高い論文のランキング向上
**実装難易度**: 簡単〜中

---

### Phase 3: Embedding ベースの意味的マッチング

**目標**: キーワードに含まれない潜在的関連性を発見する

#### TODO 6: Gemini Embedding API の導入

**変更内容**:
- `src/lib/embedding.ts` 新規作成
- `gemini-embedding-001` モデルを使用（`@google/genai`は既にインストール済み）
- 256次元のembeddingを生成（ストレージ節約のため3072→256に削減）
- Supabase pgvector 拡張を有効化
- `papers` テーブルに `embedding vector(256)` カラム追加

**主要関数**:
- `getEmbedding(text, taskType)`: テキストのembeddingを取得
- `cosineSimilarity(a, b)`: コサイン類似度を計算
- `getInterestEmbedding(interests)`: 関心プロファイル全体のembeddingを算出

**コスト**: Gemini Embedding API は $0.15/1M tokens（非常に安価）

#### TODO 7: ハイブリッドスコアリングパイプライン

**変更内容**:
- `scoring.ts` を3段階パイプラインに改修

```
全論文 → Embedding類似度(< 0.3 を除外) → LLMスコアリング → 最終スコア
```

**スコア統合式（更新）**:
```
最終スコア = LLMスコア × 0.5 + Embedding類似度 × 0.2 + 引用数 × 0.1 + 新しさ × 0.2
```

**期待効果**:
- LLM呼び出しを30-50%削減（低類似度論文をスキップ）
- 潜在的関連性の発見

**実装難易度**: 中

---

### Phase 4: フィードバック学習の強化

**目標**: ユーザーレビューからの学習を改善する

#### TODO 8: EMAベースの重み更新

**課題**: 現在の固定値更新（+0.1/-0.05）では学習速度の調整ができない

**変更内容**:
- `interest-learner.ts`: Exponential Moving Average方式に変更
- 承認時: `newWeight = currentWeight × 0.85 + 2.0 × 0.15`
- スキップ時: `newWeight = max(0.1, currentWeight - 0.08)`
- `interests` テーブルに `hit_count`, `last_hit_at` カラム追加
- 長期間ヒットしないキーワードは自然減衰

#### TODO 9: ネガティブキーワードの導入（将来検討）

**概要**: skip/rejectされた論文のキーワードをネガティブシグナルとして活用
**注意**: skip時のLLM呼び出しコストが高いため、バッチ処理での実装を検討

---

### Phase 5: 軽量プリフィルタリング

**目標**: コスト削減と処理速度向上

#### TODO 10: BM25キーワードマッチによるプリフィルタ

**変更内容**:
- `src/lib/keyword-filter.ts` 新規作成
- 外部ライブラリ不要（自前実装30行程度）
- 収集時にキーワードスコアが10未満の論文はLLM/Embedding呼び出しをスキップ

**スコアリングパイプライン最終形**:
```
[Tier 1] BM25キーワードマッチ (0コスト) → 10未満を除外
[Tier 2] Embedding類似度 (低コスト) → 0.25未満を除外
[Tier 3] LLM CoTスコアリング (高精度)
↓
マルチシグナル統合 → 最終スコア
```

---

## 4. 実装優先度マトリクス

| 順位 | 施策 | Phase | 難易度 | 精度影響 | コスト影響 | 前提条件 |
|------|------|-------|--------|----------|-----------|---------|
| 1 | アブストラクト活用 | 1 | 簡単 | 非常に高 | 微増 | なし |
| 2 | CoTスコアリング | 1 | 簡単 | 高 | 微増 | なし |
| 3 | 精度トラッキング | 1 | 簡単 | 基盤 | なし | なし |
| 4 | Few-Shot Examples | 2 | 簡単 | 中〜高 | 微増 | レビュー20件以上 |
| 5 | 引用数・新しさ | 2 | 簡単 | 中 | なし | なし |
| 6 | Embedding類似度 | 3 | 中 | 高 | 低増 | pgvector有効化 |
| 7 | ハイブリッドパイプライン | 3 | 中 | 高 | 削減 | TODO 6完了 |
| 8 | EMA重み更新 | 4 | 簡単 | 中 | なし | なし |
| 9 | BM25プリフィルタ | 5 | 簡単 | 低〜中 | 削減 | なし |
| 10 | マルチシグナル統合 | 3 | 中 | 高 | なし | TODO 5,6完了 |

---

## 5. DB移行SQL一覧

### Phase 1
```sql
-- TODO 1: abstractカラム追加
ALTER TABLE papers ADD COLUMN abstract TEXT;

-- TODO 3: スコアリングフィードバックテーブル
CREATE TABLE scoring_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  ai_score INTEGER,
  user_action TEXT NOT NULL,
  scoring_method TEXT DEFAULT 'v1',
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scoring_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON scoring_feedback FOR ALL USING (true);
```

### Phase 2
```sql
-- TODO 5: 引用数カラム追加
ALTER TABLE papers ADD COLUMN citation_count INTEGER;
```

### Phase 3
```sql
-- TODO 6: pgvector拡張 + embeddingカラム
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE papers ADD COLUMN embedding vector(256);

-- 類似度検索用インデックス
CREATE INDEX papers_embedding_idx ON papers
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Phase 4
```sql
-- TODO 8: interests テーブルにフィードバック追跡カラム追加
ALTER TABLE interests ADD COLUMN hit_count INTEGER DEFAULT 0;
ALTER TABLE interests ADD COLUMN last_hit_at TIMESTAMPTZ;
```

---

## 6. 効果測定計画

### 主要KPI

| メトリクス | 定義 | 目標値 |
|-----------|------|--------|
| scoreGap | 承認論文と棄却論文の平均スコア差 | > 30 |
| Precision@10 | 上位10件中のユーザー承認率 | > 80% |
| 自動判定正解率 | auto_approved/auto_skippedの正解率 | > 85% |
| LLM呼び出し率 | 全論文のうちLLMスコアリングを実行した割合 | < 60% |

### 測定サイクル

1. Phase 1 実装後: 1-2週間レビュー蓄積 → Phase 1メトリクス計測
2. Phase 2 実装後: 1週間レビュー蓄積 → Phase 1 vs 2 比較
3. Phase 3以降: 同様に1週間ごとに比較

---

## 7. 参考技術・ライブラリ

| 技術 | 用途 | URL/備考 |
|------|------|----------|
| Gemini Embedding API | テキストembedding | `gemini-embedding-001`モデル、@google/genai SDK |
| Supabase pgvector | ベクトル類似度検索 | Supabase標準拡張 |
| BM25 | キーワードマッチング | 自前実装（30行程度） |
| Chain-of-Thought | LLMスコアリング改善 | プロンプト技術 |
| NDCG | ランキング品質評価 | 推薦システムの標準メトリクス |

---

## 8. リスクと注意事項

1. **コスト管理**: Phase 3（Embedding）導入でAPI呼び出しが増えるが、Tier分けで低関連論文のLLM呼び出しを削減し、総コストは抑制可能
2. **過学習リスク**: Few-Shot Examples が少数のレビュー結果に偏る可能性 → 最低20件蓄積後に有効化
3. **コールドスタート**: レビュー履歴なしの初期段階ではPhase 1の施策のみで運用
4. **プロンプト変更の影響**: CoTスコアリング導入時にスコア分布が変化する可能性 → 閾値の再調整が必要
