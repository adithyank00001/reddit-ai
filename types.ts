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
}