-- 引用ネットワーク探索機能: カラム追加マイグレーション
-- Issue #9: https://github.com/Buchi0223/Paper_box/issues/9
-- Supabase SQL Editorで実行してください

-- 1. papers テーブルに citation_explored_at カラム追加
ALTER TABLE papers ADD COLUMN IF NOT EXISTS citation_explored_at TIMESTAMPTZ DEFAULT NULL;

-- 2. collection_logs テーブルに seed_paper_id カラム追加
ALTER TABLE collection_logs ADD COLUMN IF NOT EXISTS seed_paper_id UUID REFERENCES papers(id) ON DELETE SET NULL;

-- 3. 未探索シード論文の検索用インデックス
CREATE INDEX IF NOT EXISTS idx_papers_citation_unexplored ON papers(collected_at DESC) WHERE citation_explored_at IS NULL;

-- 検証: 以下のクエリでカラム存在を確認
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'papers' AND column_name = 'citation_explored_at';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'collection_logs' AND column_name = 'seed_paper_id';

-- ロールバック（必要な場合）:
-- DROP INDEX IF EXISTS idx_papers_citation_unexplored;
-- ALTER TABLE collection_logs DROP COLUMN IF EXISTS seed_paper_id;
-- ALTER TABLE papers DROP COLUMN IF EXISTS citation_explored_at;
