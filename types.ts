export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  subreddit: string;
  created_utc: number;
}

export interface Post {
  id: string;
  reddit_post_id: string;
  alert_id: string;
  title: string;
  body: string;
  url: string;
  author: string;
  subreddit: string;
  created_utc: number;
  status: string;
  created_at?: string;
  opportunity_score?: number | null;
  opportunity_type?: string | null;
  opportunity_reason?: string | null;
  suggested_angle?: string | null;
  reply_draft?: string | null; // Legacy field name
  ai_reply?: string | null; // Field name used by Worker 2
  relevance_score?: number | null;
  ai_analysis?: string | null;
}