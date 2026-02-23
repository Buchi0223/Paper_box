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
        Update: Partial<PaperKeyword>;
      };
      collection_logs: {
        Row: CollectionLog;
        Insert: CollectionLogInsert;
        Update: Partial<CollectionLogInsert>;
      };
      rss_feeds: {
        Row: RssFeed;
        Insert: RssFeedInsert;
        Update: RssFeedUpdate;
      };
      interests: {
        Row: Interest;
        Insert: InterestInsert;
        Update: Partial<InterestInsert>;
      };
      review_settings: {
        Row: ReviewSetting;
        Insert: ReviewSettingInsert;
        Update: Partial<ReviewSettingInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
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
  review_status: string;
  relevance_score: number | null;
  collected_at: string;
  created_at: string;
  updated_at: string;
};

export type PaperInsert = {
  id?: string;
  title_original: string;
  title_ja?: string | null;
  authors?: string[];
  published_date?: string | null;
  journal?: string | null;
  doi?: string | null;
  url?: string | null;
  summary_ja?: string | null;
  explanation_ja?: string | null;
  source?: string;
  google_drive_url?: string | null;
  is_favorite?: boolean;
  memo?: string | null;
  review_status?: string;
  relevance_score?: number | null;
  collected_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type PaperUpdate = {
  id?: string;
  title_original?: string;
  title_ja?: string | null;
  authors?: string[];
  published_date?: string | null;
  journal?: string | null;
  doi?: string | null;
  url?: string | null;
  summary_ja?: string | null;
  explanation_ja?: string | null;
  source?: string;
  google_drive_url?: string | null;
  is_favorite?: boolean;
  memo?: string | null;
  review_status?: string;
  relevance_score?: number | null;
  collected_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type Keyword = {
  id: string;
  keyword: string;
  category: string | null;
  sources: string[];
  journals: string[];
  is_active: boolean;
  created_at: string;
};

export type KeywordInsert = {
  id?: string;
  keyword: string;
  category?: string | null;
  sources?: string[];
  journals?: string[];
  is_active?: boolean;
  created_at?: string;
};

export type KeywordUpdate = {
  id?: string;
  keyword?: string;
  category?: string | null;
  sources?: string[];
  journals?: string[];
  is_active?: boolean;
  created_at?: string;
};

export type PaperKeyword = {
  paper_id: string;
  keyword_id: string;
};

export type CollectionLog = {
  id: string;
  keyword_id: string | null;
  feed_id: string | null;
  status: string;
  papers_found: number;
  message: string | null;
  executed_at: string;
};

export type CollectionLogInsert = {
  id?: string;
  keyword_id?: string | null;
  feed_id?: string | null;
  status?: string;
  papers_found?: number;
  message?: string | null;
  executed_at?: string;
};

export type RssFeed = {
  id: string;
  name: string;
  feed_url: string;
  is_active: boolean;
  last_fetched_at: string | null;
  created_at: string;
};

export type RssFeedInsert = {
  id?: string;
  name: string;
  feed_url: string;
  is_active?: boolean;
  last_fetched_at?: string | null;
  created_at?: string;
};

export type RssFeedUpdate = {
  id?: string;
  name?: string;
  feed_url?: string;
  is_active?: boolean;
  last_fetched_at?: string | null;
  created_at?: string;
};

export type Interest = {
  id: string;
  label: string;
  type: string;
  weight: number;
  created_at: string;
};

export type InterestInsert = {
  id?: string;
  label: string;
  type?: string;
  weight?: number;
  created_at?: string;
};

export type ReviewSetting = {
  id: string;
  key: string;
  value: string;
  updated_at: string;
};

export type ReviewSettingInsert = {
  id?: string;
  key: string;
  value: string;
  updated_at?: string;
};
