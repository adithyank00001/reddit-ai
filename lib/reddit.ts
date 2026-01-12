import { RedditPost } from "@/types";
import { logger } from "./logger";

// RSS-Bridge instances to fetch Reddit data in JSON Feed format
const BRIDGES = [
  "https://rss-bridge.org/bridge01",
  "https://rss.bka.li",
  "https://feed.eugenemolnar.com",
  "https://bridge.suumitsu.eu",
  "https://rssbridge.noc.social"
];

/**
 * Strip HTML tags from a string using regex
 */
function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Convert ISO date string to Unix timestamp (seconds)
 */
function isoToUnixTimestamp(isoString: string): number {
  if (!isoString) return 0;
  try {
    return Math.floor(new Date(isoString).getTime() / 1000);
  } catch {
    return 0;
  }
}

/**
 * Extract subreddit name from Reddit URL or use provided subreddit
 */
function extractSubreddit(url: string, fallbackSubreddit: string): string {
  if (!url) return fallbackSubreddit;
  try {
    // Try to extract from URL like https://reddit.com/r/saas/...
    const match = url.match(/\/r\/([^\/]+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // Fall through to fallback
  }
  return fallbackSubreddit;
}

/**
 * Fetch posts from a single subreddit using RSS-Bridge
 */
async function fetchSingleSubreddit(
  subreddit: string,
  overallStart: number,
  MAX_TOTAL_TIME: number
): Promise<RedditPost[]> {
  // Try each bridge for this subreddit
  for (const bridge of BRIDGES) {
    // Check if we're running out of time budget
    const elapsed = Date.now() - overallStart;
    if (elapsed > MAX_TOTAL_TIME) {
      logger.warn("REDDIT_FETCH", `Time budget exceeded (${elapsed}ms). Stopping bridge attempts for r/${subreddit}.`);
      break;
    }

    try {
      // Construct RSS-Bridge URL
      const url = `${bridge}/?action=display&bridge=Reddit&context=single&subreddit=${subreddit}&format=Json`;
      const requestStart = Date.now();

      // Log which bridge we are trying
      logger.redditRequest(subreddit, url);

      // Create AbortController for timeout (3 seconds per bridge)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
        cache: "no-store",
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const requestTime = Date.now() - requestStart;

      logger.apiResponse("GET", url, res.status, res.statusText, requestTime);

      // If this bridge failed, try next one
      if (!res.ok) {
        logger.redditError(subreddit, `Bridge ${bridge} returned HTTP ${res.status} ${res.statusText}. Trying next bridge...`);
        continue;
      }

      // Safety check: Detect HTML responses (Cloudflare challenges) before parsing JSON
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        logger.warn("REDDIT_FETCH", `Bridge ${bridge} sent HTML (likely Cloudflare block). Trying next bridge...`);
        continue;
      }

      // Parse JSON Feed response
      const parseStart = Date.now();
      const data = await res.json();
      const parseTime = Date.now() - parseStart;

      // Validate JSON Feed structure
      if (!data?.items || !Array.isArray(data.items)) {
        logger.redditError(subreddit, `Bridge ${bridge} returned invalid JSON Feed structure. Trying next bridge...`);
        continue;
      }

      // Map JSON Feed items to RedditPost interface
      const mapStart = Date.now();
      const posts: RedditPost[] = data.items.map((item: any) => {
        return {
          id: item.id || "",
          title: item.title || "",
          selftext: stripHtml(item.content_html || ""),
          url: item.url || "",
          author: item.author?.name || "",
          subreddit: extractSubreddit(item.url || "", subreddit),
          created_utc: isoToUnixTimestamp(item.date_published || ""),
        };
      }).filter((post: RedditPost) => post.id && post.title); // Filter out invalid posts

      const mapTime = Date.now() - mapStart;

      logger.debug("REDDIT_FETCH", `Parsed JSON Feed response in ${parseTime}ms`, {
        itemsCount: data.items.length,
        validPostsCount: posts.length
      });
      logger.debug("REDDIT_FETCH", `Mapped ${posts.length} posts in ${mapTime}ms`);
      logger.redditResponse(subreddit, posts.length, Date.now() - requestStart);

      // Success! Return posts
      return posts;

    } catch (err) {
      // If timeout or network error, try next bridge
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("aborted") || errorMsg.includes("timeout")) {
        logger.redditError(subreddit, `Bridge ${bridge} timed out. Trying next bridge...`);
      } else {
        logger.redditError(subreddit, `Bridge ${bridge} connection failed: ${errorMsg}. Trying next bridge...`);
      }
      // Continue to next bridge (0ms delay)
      continue;
    }
  }

  // All bridges failed for this subreddit
  logger.redditError(subreddit, `All bridges failed for r/${subreddit}. No posts fetched.`);
  return [];
}

export async function fetchSubredditPosts(
  subreddits: string[]
): Promise<RedditPost[]> {
  const timer = logger.startTimer("REDDIT_FETCH");

  try {
    logger.step("REDDIT_FETCH", `Starting fetch for subreddits: ${subreddits.join(", ")}`);

    // Early return if subreddits array is empty
    if (subreddits.length === 0) {
      logger.warn("REDDIT_FETCH", "Empty subreddits array provided");
      return [];
    }

    // Track total time to avoid Vercel timeout (30 second budget)
    const overallStart = Date.now();
    const MAX_TOTAL_TIME = 30000; // 30 seconds total budget

    // Fetch posts for each subreddit sequentially (to respect time budget)
    const allPosts: RedditPost[] = [];

    for (const subreddit of subreddits) {
      // Check if we're running out of time budget before starting next subreddit
      const elapsed = Date.now() - overallStart;
      if (elapsed > MAX_TOTAL_TIME) {
        logger.warn("REDDIT_FETCH", `Time budget exceeded (${elapsed}ms). Stopping subreddit fetches.`);
        break;
      }

      const posts = await fetchSingleSubreddit(subreddit, overallStart, MAX_TOTAL_TIME);
      allPosts.push(...posts);
    }

    timer.end();

    if (allPosts.length === 0) {
      logger.redditError(subreddits.join(", "), "No posts fetched from any subreddit.");
    } else {
      logger.info("REDDIT_FETCH", `Successfully fetched ${allPosts.length} total posts from ${subreddits.length} subreddit(s)`);
    }

    return allPosts;

  } catch (error) {
    // Critical error outside the subreddit loop
    logger.redditError(subreddits.join(", "), error);
    timer.end();
    return [];
  }
}
