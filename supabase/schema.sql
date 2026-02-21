-- 論文管理Webアプリ データベーススキーマ

-- UUID生成用の拡張機能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 論文テーブル
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_original TEXT NOT NULL,
  title_ja TEXT,
  authors TEXT[] NOT NULL DEFAULT '{}',
  published_date DATE,
  journal TEXT,
  doi TEXT UNIQUE,
  url TEXT,
  summary_ja TEXT,
  explanation_ja TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  google_drive_url TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  memo TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- キーワードテーブル
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL,
  category TEXT,
  sources TEXT[] NOT NULL DEFAULT '{arXiv}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 論文-キーワード関連テーブル
CREATE TABLE paper_keywords (
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, keyword_id)
);

-- 収集ログテーブル
CREATE TABLE collection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'success',
  papers_found INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_papers_collected_at ON papers(collected_at DESC);
CREATE INDEX idx_papers_is_favorite ON papers(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_papers_source ON papers(source);
CREATE INDEX idx_keywords_is_active ON keywords(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_collection_logs_executed_at ON collection_logs(executed_at DESC);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER papers_updated_at
  BEFORE UPDATE ON papers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 全文検索用インデックス（日本語タイトル・原題・要約・メモ）
CREATE INDEX idx_papers_fulltext ON papers
  USING GIN (to_tsvector('simple', coalesce(title_original, '') || ' ' || coalesce(title_ja, '') || ' ' || coalesce(summary_ja, '') || ' ' || coalesce(memo, '')));
