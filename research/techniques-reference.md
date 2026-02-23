# AI論文自動選定 手法解説・参考文献集

本ドキュメントでは、[scoring-improvement-plan.md](./scoring-improvement-plan.md) で提案した各改善施策の理論的背景、仕組み、および参考論文を体系的に解説する。

---

## 目次

1. [Chain-of-Thought (CoT) スコアリング](#1-chain-of-thought-cot-スコアリング)
2. [テキスト埋め込み（Embedding）による意味的類似度](#2-テキスト埋め込みembeddingによる意味的類似度)
3. [BM25 によるキーワードマッチング](#3-bm25-によるキーワードマッチング)
4. [Few-Shot In-Context Learning](#4-few-shot-in-context-learning)
5. [ユーザーフィードバック学習（バンディット・RLHF）](#5-ユーザーフィードバック学習バンディットrlhf)
6. [マルチシグナル融合](#6-マルチシグナル融合)
7. [評価指標とキャリブレーション](#7-評価指標とキャリブレーション)
8. [参考文献一覧](#8-参考文献一覧)

---

## 1. Chain-of-Thought (CoT) スコアリング

### 1.1 概要

Chain-of-Thought（CoT）プロンプティングとは、LLMに最終的な回答を出力する前に**中間推論ステップを明示的に生成させる**手法である。Wei et al. (2022) [1] が提案し、算術推論・常識推論・記号推論など多様なタスクで大幅な精度向上を示した。

### 1.2 なぜスコアリングに有効か

現在のシステムでは `thinkingBudget: 0`（推論なし）+ `maxOutputTokens: 10`（数値のみ出力）という設定で、LLMに「直感的な」スコアだけを出力させている。これは人間が「論文タイトルを一瞥して5秒で点数をつける」のに相当する。

CoTを導入すると、LLMは以下のような推論プロセスを経るようになる：

```
1. この論文は「〇〇」に関する研究である
2. 関心プロファイルの「△△」キーワードと直接関連がある（重み: 1.5）
3. 一方「□□」キーワードとは間接的な関連にとどまる
4. 直接関連キーワードの重みが高いため → 総合スコア: 78
```

Lee et al. (2024) [2] はCoTプロンプティングにルーブリック（評価基準）を組み合わせることで、**ゼロショットで13.44%、Few-shotで3.7%のスコアリング精度向上**を実証している。

### 1.3 LLM-as-a-Judge パラダイム

Zheng et al. (2023) [3] は、LLMを評価者（Judge）として使用する際の知見を体系化した。主な発見：

- **位置バイアス**: 提示順序により評価が変わる → 関心キーワードを重み順にソートして一貫性を確保
- **冗長性バイアス**: 長い出力を高く評価しがち → JSON構造化出力で形式を固定
- **自己バイアス**: 自分が生成したテキストを高く評価 → 今回はスコアリングのみのため該当しない

### 1.4 構造化出力（JSON）の効果

構造化出力に関する研究 [4] では、LLMにJSON等の構造化フォーマットで出力させることで、フリーテキスト出力と比較して以下のメリットがあることが示されている：

- **パース安定性**: 数値のみ出力させても時折テキストが混入する問題を回避
- **推論の可視化**: `reasoning` フィールドでスコアの根拠を保存・分析可能
- **スキーマ遵守**: `responseMimeType: "application/json"` でフォーマットを強制

### 1.5 本システムへの適用

```
現状:  プロンプト → LLM(推論なし) → "73"
改善後: プロンプト → LLM(推論あり) → {"reasoning":"...", "matched_interests":["..."], "score":73}
```

**変更点まとめ**:
| 設定 | 現状 | 改善後 |
|------|------|--------|
| thinkingBudget | 0 | 1024 |
| maxOutputTokens | 10 | 300 |
| responseMimeType | なし | application/json |
| 出力形式 | 数値のみ | JSON（理由+スコア） |

### 1.6 参考論文

| # | 論文 | 年 | 会議/誌 | 関連性 |
|---|------|------|---------|--------|
| [1] | Wei et al. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" | 2022 | NeurIPS | CoTの原論文。中間推論ステップにより推論タスクの精度が大幅向上 |
| [2] | Lee et al. "A Chain-of-Thought Prompting Approach with LLMs for Evaluating Students' Formative Assessment Responses in Science" | 2024 | AAAI | CoT+ルーブリックでスコアリング精度13.44%向上を実証 |
| [3] | Zheng et al. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" | 2023 | NeurIPS | LLMを評価者として使う際のバイアスと対策を体系化 |
| [4] | "Generating Structured Outputs from Language Models: Benchmark and Studies" | 2025 | arXiv | LLMの構造化出力の信頼性を評価 |

---

## 2. テキスト埋め込み（Embedding）による意味的類似度

### 2.1 概要

テキスト埋め込み（Text Embedding）とは、テキストを**固定長の数値ベクトル（例: 256次元）**に変換する技術である。変換後のベクトル間の**コサイン類似度**を計算することで、テキスト同士の意味的な近さを定量的に測定できる。

```
"深層学習による画像認識" → [0.12, -0.45, 0.78, ..., 0.33]  (256次元)
"CNNを用いた物体検出"   → [0.15, -0.42, 0.71, ..., 0.29]  (256次元)
                                            ↓
                              コサイン類似度 = 0.92 (高い類似性)
```

### 2.2 Sentence-BERT の革新

Reimers & Gurevych (2019) [5] は、BERTをSiameseネットワーク構造で学習させることで、**意味的に比較可能な文埋め込み**を効率的に生成する手法を提案した。

従来のBERTでは10,000文のペア比較に**約65時間**かかっていたが、Sentence-BERTでは各文を一度だけベクトル化してコサイン類似度を計算するため、**約5秒**に短縮された。これにより大規模な類似度計算が実用的になった。

### 2.3 Google Gecko / Gemini Embedding

Lee et al. (2024) [6] が提案した Gecko は、Google DeepMindが開発した軽量テキスト埋め込みモデルである。特徴：

- **知識蒸留**: 大規模LLMの知識を小型モデルに蒸留
- **次元効率**: 256次元でも768次元の既存モデルを上回る性能
- **多言語対応**: 日英混在テキストにも対応

現在の Gemini API では `gemini-embedding-001` として利用可能であり、本システムで既に使用している `@google/genai` SDK から直接呼び出せる。

### 2.4 コサイン類似度の仕組み

2つのベクトル $\mathbf{a}$ と $\mathbf{b}$ のコサイン類似度は以下で定義される：

```
similarity(a, b) = (a · b) / (|a| × |b|)
```

- 値域: -1 〜 1（通常の埋め込みでは 0 〜 1 に近い範囲）
- 1 に近い → 意味的に類似
- 0 に近い → 無関係
- 負の値 → 意味的に対立（稀）

### 2.5 学術論文推薦への応用

学術論文推薦における埋め込みの活用に関する研究 [7] では、タイトル・アブストラクトの埋め込みに加え、引用データや知識エンティティを組み合わせた**多面的文書埋め込み**により推薦精度が向上することが示されている。

推薦システムにおける埋め込み技術の包括的サーベイ [8] では、協調フィルタリング、自己教師あり学習、グラフベース手法など多様なアプローチが整理されている。

### 2.6 本システムへの適用

```
関心プロファイル → Embedding → 関心ベクトル（事前計算・キャッシュ可能）
論文タイトル+要約 → Embedding → 論文ベクトル
                            ↓
                  コサイン類似度 → 0-100のスコアに変換
```

**利点**:
- LLM呼び出しより**高速・低コスト**（$0.15/1M tokens）
- キーワードに含まれない**潜在的関連性**を発見できる
- Supabase pgvector と組み合わせることで**ベクトル検索**も可能

**Supabase pgvector**: Supabase はPostgreSQL拡張の pgvector を標準でサポートしており、ベクトルカラムの追加とコサイン類似度によるインデックス検索が可能。

### 2.7 参考論文

| # | 論文 | 年 | 会議/誌 | 関連性 |
|---|------|------|---------|--------|
| [5] | Reimers & Gurevych "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks" | 2019 | EMNLP | 意味的文埋め込みの基盤技術 |
| [6] | Lee et al. "Gecko: Versatile Text Embeddings Distilled from Large Language Models" | 2024 | arXiv | Google Gemini Embedding の基盤。256次元で高精度 |
| [7] | "Enhancing Academic Paper Recommendations Using Fine-Grained Knowledge Entities and Multifaceted Document Embeddings" | 2025 | arXiv | 多面的埋め込みによる論文推薦 |
| [8] | "Embedding in Recommender Systems: A Survey" | 2023 | arXiv | 推薦システムにおける埋め込み技術の包括的サーベイ |

---

## 3. BM25 によるキーワードマッチング

### 3.1 概要

BM25（Best Matching 25）は、Robertson & Walker (1994) [9] が提案した**確率的情報検索モデル**である。TF-IDF を発展させたもので、文書中のキーワード出現頻度（TF: Term Frequency）と逆文書頻度（IDF: Inverse Document Frequency）を確率的フレームワークで組み合わせる。

Google検索やElasticsearchなど多くの検索エンジンで**デフォルトのランキング関数**として採用されており、30年以上にわたり情報検索の標準手法であり続けている。

### 3.2 TF-IDF と BM25 の違い

**TF-IDF**:
```
score(q, d) = Σ tf(t, d) × idf(t)
```
- tf: 文書d中の用語tの出現頻度
- idf: 用語tがどれだけ「珍しい」か

**BM25** (TF-IDFの改良版):
```
score(q, d) = Σ idf(t) × [tf(t,d) × (k1 + 1)] / [tf(t,d) + k1 × (1 - b + b × |d|/avgdl)]
```
- k1: TF飽和パラメータ（通常 1.2〜2.0）。TFが増えても際限なくスコアが上がらないよう飽和させる
- b: 文書長正規化パラメータ（通常 0.75）。長い文書が有利にならないよう補正
- avgdl: 全文書の平均長

**直感的理解**: TF-IDFでは「キーワードが10回出現する文書は5回の2倍のスコア」だが、BM25では「10回も5回もそこまで大きな差ではない」という現実に即した挙動になる。

### 3.3 ハイブリッド検索（Sparse + Dense）

Karpukhin et al. (2020) [11] は Dense Passage Retrieval (DPR) を提案し、密なベクトル検索（Embedding）がBM25をtop-20精度で9-19%上回ることを示した。しかし：

- BM25は**エンティティ名や専門用語**の完全一致に強い
- Embeddingは**意味的パラフレーズ**に強い
- 両者は**補完的**な関係にある

Lewis et al. (2020) [12] が提案したRAG（Retrieval-Augmented Generation）も、検索（sparse/dense）と生成（LLM）の組み合わせであり、本システムの「BM25 → Embedding → LLM」パイプラインの理論的基盤となる。

### 3.4 本システムへの適用

```
収集された論文群
    ↓
[BM25スコア計算] ← 関心キーワードをクエリとして使用
    ↓
スコア < 10 の論文を除外（明らかに無関係）
    ↓
残った論文 → Embedding/LLMスコアリングへ
```

**利点**:
- **コスト: ゼロ**（CPU計算のみ、API呼び出し不要）
- **速度: 即座**（ミリ秒単位）
- LLM呼び出しの**事前フィルタ**として、コスト削減に直結

**制限**:
- 意味的類似性は捉えられない（「機械学習」と「ニューラルネットワーク」が一致しない）
- このため単独使用ではなく、Embedding/LLMとの**組み合わせ**が重要

### 3.5 参考論文

| # | 論文 | 年 | 会議/誌 | 関連性 |
|---|------|------|---------|--------|
| [9] | Robertson & Walker "Some Simple Effective Approximations to the 2-Poisson Model for Probabilistic Weighted Retrieval" | 1994 | SIGIR | BM25の原論文 |
| [10] | Robertson & Zaragoza "The Probabilistic Relevance Framework: BM25 and Beyond" | 2009 | FnTIR | BM25の包括的レビュー |
| [11] | Karpukhin et al. "Dense Passage Retrieval for Open-Domain Question Answering" | 2020 | EMNLP | 密ベクトル検索 vs BM25 の比較。ハイブリッドの根拠 |
| [12] | Lewis et al. "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" | 2020 | NeurIPS | RAG。検索+生成の組み合わせの理論的基盤 |

---

## 4. Few-Shot In-Context Learning

### 4.1 概要

In-Context Learning（ICL）とは、LLMにタスクの**具体例をプロンプト中に提示**することで、追加の学習（ファインチューニング）なしにタスクを遂行させる手法である。Brown et al. (2020) [13] が GPT-3 で実証し、現代のLLM活用の基盤となっている。

```
例）Few-shot スコアリングプロンプト:

### 過去の評価例:
- 論文「Attention Is All You Need」→ スコア: 92（理由: Transformer は関心キーワード「深層学習」に直接関連）
- 論文「Economic Analysis of GDP Growth」→ スコア: 5（理由: 経済分析は関心プロファイルと無関係）

### 評価対象:
- 論文「Vision Transformer for Medical Image Segmentation」→ ?
```

### 4.2 なぜ Few-shot が有効か

LLMは Few-shot 例から以下を暗黙的に学習する：

1. **タスクの形式**: 何を入力し、何を出力すべきか
2. **評価基準の具体化**: 抽象的な「関連性」の概念をユーザー固有の文脈で具体化
3. **スコアの分布**: 実際のスコア範囲やキャリブレーション（例：ほとんどが60-80に集中、など）

### 4.3 動的な例選択の重要性

Liu et al. (2022) [14] は、テスト入力に**意味的に類似した例を動的に選択**することでICL性能が大幅に向上することを実証した。

本システムへの適用：
```
1. 対象論文のタイトルと、過去の評価済み論文のタイトルをEmbeddingで比較
2. 最も類似した承認論文3件 + 棄却論文3件をFew-shot例として選択
3. プロンプトに注入
```

**静的な例選択**（最新N件を使う）でも効果はあるが、**動的な例選択**の方がより高い精度向上が見込める。ただし動的選択にはEmbedding計算が必要なため、Phase 3（Embedding導入）以降に実装するのが合理的。

### 4.4 Many-Shot ICL

Google DeepMind (2024) [15] は、Few-shot（数例）からMany-shot（数百〜数千例）に拡張することで、さらなる性能向上を確認している。Geminiの長コンテキストウィンドウ（100万トークン）を活用すれば、多数の過去評価例を含めることも技術的には可能。ただし、コスト（入力トークン増加）とのバランスを考慮する必要がある。

### 4.5 注意点

- **コールドスタート問題**: レビュー履歴が少ない段階では有効でない → **最低20件以上のレビュー蓄積後**に有効化
- **バイアスの増幅**: 偏った例を提示すると、その偏りがスコアリングに反映される → 承認・棄却のバランスを保つ
- **プロンプト長の増加**: 例を増やすほど入力トークンが増える → 3-5例が実用的

### 4.6 参考論文

| # | 論文 | 年 | 会議/誌 | 関連性 |
|---|------|------|---------|--------|
| [13] | Brown et al. "Language Models are Few-Shot Learners" | 2020 | NeurIPS | ICLの原論文。Few-shotでの多様なタスク遂行を実証 |
| [14] | Liu et al. "What Makes Good In-Context Examples for GPT-3?" | 2022 | ACL Workshop | 意味的類似例の動的選択で性能大幅向上 |
| [15] | Google DeepMind "Many-Shot In-Context Learning" | 2024 | arXiv | Many-shot（数百例）でさらなる性能向上を確認 |
| [16] | "Retrieval-style In-context Learning for Few-shot Hierarchical Text Classification" | 2024 | TACL | 検索ベースICLのテキスト分類への応用 |

---

## 5. ユーザーフィードバック学習（バンディット・RLHF）

### 5.1 概要

ユーザーが論文を「承認」「スキップ」する行為は、推薦システムに対する**暗黙的フィードバック**である。このフィードバックを活用してスコアリングを継続的に改善する手法は、大きく以下の3つに分類できる。

### 5.2 探索と活用のバランス（Multi-Armed Bandit）

**問題**: 高スコア論文ばかり提示していると、本当は興味があるが現在のモデルでは低スコアと判定される論文（未知の良い論文）を見逃す可能性がある。

**解決**: Multi-Armed Bandit（多腕バンディット）アルゴリズムにより、「既知の良い推薦を活用する」ことと「未知の可能性を探索する」ことのバランスを取る。

Li et al. (2010) [17] が提案した **LinUCB** は、文脈（ユーザー特徴量 + 論文特徴量）を考慮した上で探索・活用のバランスを最適化するアルゴリズムであり、Yahoo!ニュースのパーソナライズド推薦で実用的な効果を実証した。

**Thompson Sampling** (Agrawal & Goyal, 2012 [18]) は、各選択肢の報酬分布をベイズ的にモデル化し、分布からサンプリングして行動を決定する手法。理論的には対数的リグレット（最適行動との差の蓄積）を達成できることが証明されている。

### 5.3 本システムでの簡易実装

本システムは個人利用のため、大規模なバンディットアルゴリズムは過剰。以下のシンプルなアプローチが実用的：

```
スコア >= 70: 常に提示（活用）
スコア <= 30: 常にスキップ（活用）
スコア 31-69: 80%の確率で提示、20%の確率で探索（ランダム提示/非提示）
```

探索結果のフィードバックにより、中間スコア帯の判定精度が徐々に向上する。

### 5.4 RLHF（Reinforcement Learning from Human Feedback）

Christiano et al. (2017) [19] が提案した RLHF は、人間のペア比較フィードバック（「AよりBが良い」）から報酬モデルを学習し、その報酬モデルで方策を最適化する手法。ChatGPTの学習にも使用された。

**本システムとの関係**: 本システムのapprove/skipは、厳密にはRLHFの「ペア比較」とは異なる「ポイントワイズフィードバック」だが、conceptは共通している。ユーザーの「これは良い/悪い」という判断から、スコアリングモデル（= LLMのプロンプト + 関心プロファイル）を継続的に改善するという設計思想の基盤。

### 5.5 Exponential Moving Average (EMA) による重み更新

現在のシステムでは関心キーワードの重みを固定値（approve時 +0.1、skip時 -0.05）で更新している。EMAを導入すると：

```
新しい重み = 現在の重み × (1 - α) + 目標値 × α
```

- α（学習率）を調整することで、学習速度と安定性のトレードオフを制御
- 急激な重み変動を防ぎ、オーバーフィッティングを抑制
- 時間減衰を自然に実現（最近のフィードバックほど影響が大きい）

### 5.6 参考論文

| # | 論文 | 年 | 会議/誌 | 関連性 |
|---|------|------|---------|--------|
| [17] | Li et al. "A Contextual-Bandit Approach to Personalized News Article Recommendation" | 2010 | WWW | LinUCB。文脈付きバンディットによるパーソナライズド推薦 |
| [18] | Agrawal & Goyal "Analysis of Thompson Sampling for the Multi-armed Bandit Problem" | 2012 | COLT | Thompson Samplingの理論的分析 |
| [19] | Christiano et al. "Deep Reinforcement Learning from Human Preferences" | 2017 | NeurIPS | RLHF の原論文。人間フィードバックからの学習 |
| [20] | "Deep Reinforcement Learning in Recommender Systems: A Survey and New Perspectives" | 2023 | KBS | 推薦システムにおける深層強化学習のサーベイ |

---

## 6. マルチシグナル融合

### 6.1 概要

論文の「ユーザーにとっての価値」は、内容の関連性だけでなく、論文の品質・影響力・新しさなど複数のシグナルで構成される。これらを統合することで、単一シグナルよりもロバストな推薦が可能になる。

### 6.2 コンテンツベース vs メタデータベース

Beel et al. (2016) [21] は200以上の論文推薦システム研究をレビューし、以下を報告している：

- **コンテンツベース**（55%）: テキスト類似度で推薦。TF-IDFが最頻の重み付け手法
- **協調フィルタリング**（18%）: 類似ユーザーの行動パターンから推薦
- **ハイブリッド**（14%）: 複数手法の組み合わせ

**個人利用ツール**では他ユーザーの行動データがないため、協調フィルタリングは適用困難。代わりに、コンテンツベース（テキスト類似度）とメタデータベース（引用数・新しさ）のハイブリッドが最適。

### 6.3 利用可能なシグナル

| シグナル | 情報源 | 取得コスト | 意味 |
|---------|--------|-----------|------|
| LLMスコア | Gemini API | 高（API呼び出し） | 関心プロファイルとの意味的関連度 |
| Embedding類似度 | Gemini Embedding API | 低 | 潜在的な意味的類似性 |
| キーワードマッチ | 自前計算 | ゼロ | 明示的なキーワードの一致度 |
| 引用数 | Semantic Scholar / OpenAlex | ゼロ（既存APIに含む） | 論文の影響力・品質の代理指標 |
| 新しさ | 出版日 | ゼロ（既存データ） | 最新研究の優先度 |
| ジャーナル | 出版元情報 | ゼロ（既存データ） | 掲載誌の権威性 |

### 6.4 シグナル統合手法

**線形加重平均**（最もシンプル）:
```
最終スコア = w1 × LLMスコア + w2 × Embedding類似度 + w3 × 引用数スコア + w4 × 新しさスコア
```

重みの初期値は経験則で設定し、フィードバックデータが蓄積された後に最適化する。

**引用数の対数スケール変換**:
引用数は分布が極端に偏る（大半が0-10、一部が1000以上）ため、対数変換して正規化する：
```
citationScore = min(100, 30 + log10(citations + 1) × 23)
```
- 0引用 → 30点
- 10引用 → 53点
- 100引用 → 76点
- 1000引用 → 99点

### 6.5 引用ネットワークの活用

引用ネットワークベースの研究 [22] では、多層引用ネットワーク（直接引用 + 間接引用）と著者協力ネットワークから構造的・意味的特徴を統合することで推薦精度が向上することが示されている。ただしこれは大規模システム向けの手法であり、本システムでは引用数を単純なシグナルとして利用するのが現実的。

### 6.6 参考論文

| # | 論文 | 年 | 会議/誌 | 関連性 |
|---|------|------|---------|--------|
| [21] | Beel et al. "Research-paper Recommender Systems: A Literature Survey" | 2016 | IJDL | 論文推薦システムの包括的サーベイ（200+研究） |
| [22] | "Research Paper Recommendation System Based on Multiple Features from Citation Network" | 2024 | Scientometrics | 引用ネットワーク+多特徴量融合による推薦 |
| [23] | "Utilizing Collaborative Filtering in a Personalized Research-Paper Recommendation System" | 2024 | arXiv | 協調フィルタリングによる論文推薦 |
| [24] | "A Hybrid Paper Recommendation Method by Using Heterogeneous Graph and Metadata" | 2020 | IEEE | ハイブリッドグラフ+メタデータ推薦 |

---

## 7. 評価指標とキャリブレーション

### 7.1 なぜ評価指標が必要か

改善施策を実装しても、その効果を定量的に測定できなければ、本当に改善されたのか判断できない。また、スコアリングの「正しさ」にはさまざまな側面があり、適切な指標を選ぶことが重要。

### 7.2 主要な評価指標

#### Precision@K（上位K件の適合率）

```
Precision@K = (上位K件中のユーザー承認数) / K
```

例: 上位10件中8件が承認 → Precision@10 = 0.8 (80%)

**意味**: 「AIが推薦した上位K件のうち、実際にユーザーが興味を持った割合」。推薦の精度を直感的に示す。

#### NDCG@K（正規化減損累積利得）

推薦リストの**順序の品質**を評価する指標。上位に関連アイテムがあるほど高い評価を受ける。

```
DCG@K = Σ(i=1 to K) rel(i) / log2(i + 1)
NDCG@K = DCG@K / IDCG@K
```

- rel(i): i番目のアイテムの関連度（承認=1, スキップ=0）
- IDCG: 理想的な並び順でのDCG（全ての関連アイテムが上位に来た場合）
- 値域: 0〜1（1が理想的なランキング）

**意味**: 「AIスコアの高い順に並べたとき、承認論文がどれだけ上位に集まっているか」

推薦システム評価のサーベイ [25] ではこれらの指標の特性が体系的に整理されている。

#### scoreGap（本システム独自の簡易指標）

```
scoreGap = (承認論文の平均AIスコア) - (棄却論文の平均AIスコア)
```

**意味**: AIスコアがユーザーの判断をどれだけ分離できているか。値が大きいほど、AIスコアがユーザーの嗜好を正確に反映している。

**利点**: 計算が簡単で直感的。改善施策の前後で比較しやすい。

### 7.3 スコアキャリブレーション

Guo et al. (2017) [27] は、現代のニューラルネットワークが**過信**する傾向にあることを指摘した。例えば「スコア80」が本当に「80%の確率で関連がある」ことを意味するかは保証されない。

**Temperature Scaling**:
```
calibrated_score = sigmoid(score / T)
```
パラメータ T を検証データで最適化し、スコアの確信度を補正する手法。本システムでは、ユーザーレビュー結果とAIスコアの関係を分析し、閾値（auto_approve/auto_skip）を適切に設定することが実質的なキャリブレーションになる。

### 7.4 オフライン評価

個人利用ツールではオンラインA/Bテスト（ランダムにユーザーを分割して異なるアルゴリズムを比較）は困難。代わりに**時系列比較**を用いる：

1. Phase 1 実装前のスコアリング結果を記録
2. Phase 1 実装後のスコアリング結果を記録
3. 同一指標（scoreGap, Precision@10等）で比較

オフラインA/Bテストに関する研究 [28] では、履歴データから反事実推定によりアルゴリズム変更の効果を推定する手法が提案されている。

### 7.5 参考論文

| # | 論文 | 年 | 会議/誌 | 関連性 |
|---|------|------|---------|--------|
| [25] | "A Comprehensive Survey of Evaluation Techniques for Recommendation Systems" | 2023 | arXiv | NDCG, MAP, Precision@K等の体系的レビュー |
| [26] | "Evaluating Recommender Systems: Survey and Framework" | 2022 | ACM Comput. Surv. | 精度以外の評価観点（多様性・新規性等） |
| [27] | Guo et al. "On Calibration of Modern Neural Networks" | 2017 | ICML | スコアキャリブレーションの理論と手法 |
| [28] | "Offline A/B Testing for Recommender Systems" | 2018 | arXiv | 履歴データによるオフライン評価手法 |

---

## 8. 参考文献一覧

### Chain-of-Thought / LLM評価

| # | 著者 | タイトル | 年 | 会議/誌 |
|---|------|---------|------|---------|
| [1] | Wei et al. | Chain-of-Thought Prompting Elicits Reasoning in Large Language Models | 2022 | NeurIPS |
| [2] | Lee et al. | A Chain-of-Thought Prompting Approach with LLMs for Evaluating Students' Formative Assessment Responses in Science | 2024 | AAAI |
| [3] | Zheng et al. | Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena | 2023 | NeurIPS |
| [4] | — | Generating Structured Outputs from Language Models: Benchmark and Studies | 2025 | arXiv |

### テキスト埋め込み / 意味的類似度

| # | 著者 | タイトル | 年 | 会議/誌 |
|---|------|---------|------|---------|
| [5] | Reimers & Gurevych | Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks | 2019 | EMNLP |
| [6] | Lee et al. | Gecko: Versatile Text Embeddings Distilled from Large Language Models | 2024 | arXiv |
| [7] | — | Enhancing Academic Paper Recommendations Using Fine-Grained Knowledge Entities and Multifaceted Document Embeddings | 2025 | arXiv |
| [8] | — | Embedding in Recommender Systems: A Survey | 2023 | arXiv |

### 情報検索 / BM25

| # | 著者 | タイトル | 年 | 会議/誌 |
|---|------|---------|------|---------|
| [9] | Robertson & Walker | Some Simple Effective Approximations to the 2-Poisson Model for Probabilistic Weighted Retrieval | 1994 | SIGIR |
| [10] | Robertson & Zaragoza | The Probabilistic Relevance Framework: BM25 and Beyond | 2009 | FnTIR |
| [11] | Karpukhin et al. | Dense Passage Retrieval for Open-Domain Question Answering | 2020 | EMNLP |
| [12] | Lewis et al. | Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks | 2020 | NeurIPS |

### Few-Shot / In-Context Learning

| # | 著者 | タイトル | 年 | 会議/誌 |
|---|------|---------|------|---------|
| [13] | Brown et al. | Language Models are Few-Shot Learners | 2020 | NeurIPS |
| [14] | Liu et al. | What Makes Good In-Context Examples for GPT-3? | 2022 | ACL Workshop |
| [15] | Google DeepMind | Many-Shot In-Context Learning | 2024 | arXiv |
| [16] | — | Retrieval-style In-context Learning for Few-shot Hierarchical Text Classification | 2024 | TACL |

### フィードバック学習 / バンディット / RLHF

| # | 著者 | タイトル | 年 | 会議/誌 |
|---|------|---------|------|---------|
| [17] | Li et al. | A Contextual-Bandit Approach to Personalized News Article Recommendation | 2010 | WWW |
| [18] | Agrawal & Goyal | Analysis of Thompson Sampling for the Multi-armed Bandit Problem | 2012 | COLT |
| [19] | Christiano et al. | Deep Reinforcement Learning from Human Preferences | 2017 | NeurIPS |
| [20] | — | Deep Reinforcement Learning in Recommender Systems: A Survey and New Perspectives | 2023 | KBS |

### マルチシグナル融合 / 論文推薦

| # | 著者 | タイトル | 年 | 会議/誌 |
|---|------|---------|------|---------|
| [21] | Beel et al. | Research-paper Recommender Systems: A Literature Survey | 2016 | IJDL |
| [22] | — | Research Paper Recommendation System Based on Multiple Features from Citation Network | 2024 | Scientometrics |
| [23] | — | Utilizing Collaborative Filtering in a Personalized Research-Paper Recommendation System | 2024 | arXiv |
| [24] | — | A Hybrid Paper Recommendation Method by Using Heterogeneous Graph and Metadata | 2020 | IEEE |

### 評価指標 / キャリブレーション

| # | 著者 | タイトル | 年 | 会議/誌 |
|---|------|---------|------|---------|
| [25] | — | A Comprehensive Survey of Evaluation Techniques for Recommendation Systems | 2023 | arXiv |
| [26] | — | Evaluating Recommender Systems: Survey and Framework | 2022 | ACM Comput. Surv. |
| [27] | Guo et al. | On Calibration of Modern Neural Networks | 2017 | ICML |
| [28] | — | Offline A/B Testing for Recommender Systems | 2018 | arXiv |
