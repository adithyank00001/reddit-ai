import { RedditPost } from "@/types";
import { logger } from "./logger";

const MIRRORS = [
  // Teddit Instances (Different frontend, often lighter/less strict)
  "https://teddit.net",
  "https://teddit.zaggy.nl",
  "https://teddit.namazso.eu",
  "https://t.sneed.network",
  "https://teddit.pussthecat.org",
  "https://teddit.adminforge.de",
  "https://teddit.hostux.net",
  
  // Redlib / Libreddit Instances
  "https://redlib.tux.pizza",
  "https://redlib.perennialte.ch",
  "https://libreddit.kavin.rocks",
  "https://redlib.kylrth.com",
  "https://snoo.habedieeh.re",
  "https://redlib.vsls.cz",
  "https://redlib.dnav.no",
  "https://libreddit.privacy.com.de"
];

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

    // Try mirrors one by one (no delay between attempts)
    // Track total time to avoid Vercel timeout (30 second budget)
    const overallStart = Date.now();
    const MAX_TOTAL_TIME = 30000; // 30 seconds total budget

    for (const mirror of MIRRORS) {
      // Check if we're running out of time budget
      const elapsed = Date.now() - overallStart;
      if (elapsed > MAX_TOTAL_TIME) {
        logger.warn("REDDIT_FETCH", `Time budget exceeded (${elapsed}ms). Stopping mirror attempts.`);
        break;
      }

      try {
        const url = `${mirror}/r/${subredditStr}/new.json?limit=100`;
        const requestStart = Date.now();

        // Log which mirror we are trying
        logger.redditRequest(subredditStr, url);

        // Create AbortController for timeout (3 seconds per mirror for faster failures)
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

        // If this mirror failed, try next one immediately
        if (!res.ok) {
          logger.redditError(subredditStr, `Mirror ${mirror} returned HTTP ${res.status} ${res.statusText}. Trying next mirror...`);
          continue;
        }

        // Safety check: Detect HTML responses (Cloudflare challenges) before parsing JSON
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          logger.warn("REDDIT_FETCH", `Mirror ${mirror} sent HTML (likely Cloudflare block). Trying next mirror...`);
          continue;
        }

        // Parse JSON response
        const parseStart = Date.now();
        const data = await res.json();
        const parseTime = Date.now() - parseStart;

        // Validate response structure
        if (!data?.data?.children) {
          logger.redditError(subredditStr, `Mirror ${mirror} returned invalid JSON structure. Trying next mirror...`);
          continue;
        }

        // Map Reddit API response to our RedditPost interface
        const mapStart = Date.now();
        const posts: RedditPost[] = data.data.children.map((child: any) => {
          const permalink = child.data.permalink.startsWith("/")
            ? child.data.permalink
            : `/${child.data.permalink}`;

          return {
            id: child.data.name,
            title: child.data.title,
            selftext: child.data.selftext || "",
            url: `https://www.reddit.com${permalink}`, // Force Real Reddit Link
            author: child.data.author,
            subreddit: child.data.subreddit,
            created_utc: child.data.created_utc,
          };
        });
        const mapTime = Date.now() - mapStart;

        logger.debug("REDDIT_FETCH", `Parsed JSON response in ${parseTime}ms`, {
          childrenCount: posts.length
        });
        logger.debug("REDDIT_FETCH", `Mapped ${posts.length} posts in ${mapTime}ms`);
        logger.redditResponse(subredditStr, posts.length, Date.now() - requestStart);
        timer.end();

        return posts;

      } catch (err) {
        // If timeout or network error, try next mirror immediately
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes("aborted") || errorMsg.includes("timeout")) {
          logger.redditError(subredditStr, `Mirror ${mirror} timed out. Trying next mirror...`);
        } else {
          logger.redditError(subredditStr, `Mirror ${mirror} connection failed: ${errorMsg}. Trying next mirror...`);
        }
        // Continue to next mirror (0ms delay)
        continue;
      }
    }

    // All mirrors failed
    logger.redditError(subredditStr, "All mirrors failed. No posts fetched.");
    timer.end();
    return [];

  } catch (error) {
    // Critical error outside the mirror loop
    logger.redditError(subredditStr, error);
    timer.end();
    return [];
  }
}
