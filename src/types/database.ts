export type Database = {
  public: {
    Tables: {
      papers: {
        Row: Paper;
        Insert: PaperInsert;
        Update: PaperUpdate;
      };
      keywords: {
        Row: Keyword;
        Insert: KeywordInsert;
        Update: KeywordUpdate;
      };
      paper_keywords: {
        Row: PaperKeyword;
        Insert: PaperKeyword;
        Update: PaperKeyword;
      };
      collection_logs: {
        Row: CollectionLog;
        Insert: CollectionLogInsert;
        Update: Partial<CollectionLogInsert>;
      };
    };
  };
};

export type Paper = {
  id: string;
  title_original: string;
  title_ja: string | null;
  authors: string[];
  published_date: string | null;
  journal: string | null;
  doi: string | null;
  url: string | null;
  summary_ja: string | null;
  explanation_ja: string | null;
  source: string;
  google_drive_url: string | null;
  is_favorite: boolean;
  memo: string | null;
  collected_at: string;
  created_at: string;
  updated_at: string;
};

export type PaperInsert = Omit<Paper, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type PaperUpdate = Partial<PaperInsert>;

export type Keyword = {
  id: string;
  keyword: string;
  category: string | null;
  sources: string[];
  is_active: boolean;
  created_at: string;
};

export type KeywordInsert = Omit<Keyword, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type KeywordUpdate = Partial<KeywordInsert>;

export type PaperKeyword = {
  paper_id: string;
  keyword_id: string;
};

export type CollectionLog = {
  id: string;
  keyword_id: string;
  status: string;
  papers_found: number;
  message: string | null;
  executed_at: string;
};

export type CollectionLogInsert = Omit<CollectionLog, "id"> & {
  id?: string;
};
