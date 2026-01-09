import { RedditPost } from "@/types";
import { logger } from "./logger";

export async function fetchSubredditPosts(
  subreddits: string[]
): Promise<RedditPost[]> {
  const timer = logger.startTimer("REDDIT_FETCH");
  const subredditStr = subreddits.join("+");
  
  try {
    logger.step("REDDIT_FETCH", `Starting fetch for subreddits: ${subredditStr}`);
    
    // Early return if subreddits array is empty
    if (subreddits.length === 0) {
      logger.warn("REDDIT_FETCH", "Empty subreddits array provided");
      return [];
    }

    // Join subreddit names with + separator
    const joinedNames = subreddits.join("+");

    // Construct the Reddit API URL
    const url = `https://www.reddit.com/r/${joinedNames}/new.json?limit=100`;
    
    logger.redditRequest(subredditStr, url);

    const requestStart = Date.now();
    // Fetch with custom User-Agent to avoid bot detection
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });
    const requestTime = Date.now() - requestStart;

    logger.apiResponse("GET", url, res.status, res.statusText, requestTime);

    // Check if request was successful
    if (!res.ok) {
      logger.redditError(subredditStr, `HTTP ${res.status} ${res.statusText}`);
      return [];
    }

    // Parse JSON response
    const parseStart = Date.now();
    const data = await res.json();
    const parseTime = Date.now() - parseStart;
    
    logger.debug("REDDIT_FETCH", `Parsed JSON response in ${parseTime}ms`, {
      childrenCount: data.data?.children?.length || 0
    });

    // Map Reddit API response to our RedditPost interface
    const mapStart = Date.now();
    const posts: RedditPost[] = data.data.children.map((child: any) => {
      const permalink = child.data.permalink.startsWith("/")
        ? child.data.permalink
        : `/${child.data.permalink}`;

      return {
        id: child.data.name,
        title: child.data.title,
        selftext: child.data.selftext,
        url: `https://reddit.com${permalink}`,
        author: child.data.author,
        subreddit: child.data.subreddit,
        created_utc: child.data.created_utc,
      };
    });
    const mapTime = Date.now() - mapStart;

    logger.debug("REDDIT_FETCH", `Mapped ${posts.length} posts in ${mapTime}ms`);
    logger.redditResponse(subredditStr, posts.length, Date.now() - requestStart);
    timer.end();

    return posts;
  } catch (error) {
    // Log error and return empty array (never crash)
    logger.redditError(subredditStr, error);
    timer.end();
    return [];
  }
}
