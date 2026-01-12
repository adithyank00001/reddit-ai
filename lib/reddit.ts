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

// Proxy services to mask Vercel IP (try in order for each mirror)
const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
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

      // Try each proxy service for this mirror
      let mirrorSucceeded = false;
      for (const proxy of PROXIES) {
        try {
          // Create target URL with timestamp to bust cache
          const targetUrl = `${mirror}/r/${subredditStr}/new.json?limit=100&t=${Date.now()}`;
          
          // Wrap in proxy to mask Vercel IP
          const proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
          
          const requestStart = Date.now();

          // Log which mirror and proxy we are trying
          logger.redditRequest(subredditStr, proxyUrl);

          // Create AbortController for timeout (3 seconds per attempt for faster failures)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const res = await fetch(proxyUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
              "Accept": "application/json",
            },
            cache: "no-store",
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const requestTime = Date.now() - requestStart;

          logger.apiResponse("GET", proxyUrl, res.status, res.statusText, requestTime);

          // If this proxy attempt failed, try next proxy for same mirror
          if (!res.ok) {
            logger.redditError(subredditStr, `Proxy ${proxy} + Mirror ${mirror} returned HTTP ${res.status} ${res.statusText}. Trying next proxy...`);
            continue; // Try next proxy
          }

          // Safety check: Detect HTML responses (Cloudflare challenges) before parsing JSON
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("text/html")) {
            logger.warn("REDDIT_FETCH", `Proxy ${proxy} + Mirror ${mirror} sent HTML (likely Cloudflare block). Trying next proxy...`);
            continue; // Try next proxy
          }

          // Parse JSON response
          const parseStart = Date.now();
          const data = await res.json();
          const parseTime = Date.now() - parseStart;

          // Validate response structure
          if (!data?.data?.children) {
            logger.redditError(subredditStr, `Proxy ${proxy} + Mirror ${mirror} returned invalid JSON structure. Trying next proxy...`);
            continue; // Try next proxy
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

          // Success! Return posts
          mirrorSucceeded = true;
          return posts;

        } catch (err) {
          // If timeout or network error, try next proxy for same mirror
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (errorMsg.includes("aborted") || errorMsg.includes("timeout")) {
            logger.redditError(subredditStr, `Proxy ${proxy} + Mirror ${mirror} timed out. Trying next proxy...`);
          } else {
            logger.redditError(subredditStr, `Proxy ${proxy} + Mirror ${mirror} connection failed: ${errorMsg}. Trying next proxy...`);
          }
          // Continue to next proxy (0ms delay)
          continue;
        }
      }

      // If all proxies failed for this mirror, move to next mirror
      if (!mirrorSucceeded) {
        logger.warn("REDDIT_FETCH", `All proxies failed for mirror ${mirror}. Trying next mirror...`);
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
