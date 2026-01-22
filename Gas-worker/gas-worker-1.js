/**
 * Worker 1: The Multi-Tenant Scout - Google Apps Script
 * 
 * Fetches Reddit posts from subreddits based on active alerts,
 * filters by user-specific keywords, and saves matching posts
 * to Supabase leads table for each matching user.
 * 
 * Multi-Tenant Architecture:
 * - Fetches all active alerts (subreddit, user_id, alert_id)
 * - Fetches all project_settings (user_id, keywords)
 * - Groups by subreddit to scrape each subreddit only once
 * - For each post, checks against all users watching that subreddit
 * - Inserts leads with the appropriate alert_id for each matching user
 * 
 * Configuration (set via PropertiesService):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_KEY: Supabase Service Role key (required to bypass RLS)
 */

// ============================================================================
// COST CONTROL: Limit posts saved per run to control OpenAI costs
// ============================================================================
const ENABLE_LIMIT = true; // Set to false to disable the limit
const MAX_POSTS_PER_RUN = 10; // Max number of posts to save total

/**
 * Main function to run the Multi-Tenant Scout process
 * This should be set up as a time-driven trigger in Google Apps Script
 */
function runSmartScout() {
  const startTime = new Date();
  Logger.log(`[${formatTimestamp(startTime)}] Worker 1 (Multi-Tenant Scout) started`);

  try {
    // Get configuration
    const config = getConfig();
    if (!config) {
      Logger.log("ERROR: Configuration missing. Please set script properties.");
      return;
    }

    // Step 1: Fetch the "Map" - all active alerts and project settings
    Logger.log("\n=== Step 1: Fetching Multi-Tenant Configuration ===");
    const subredditMap = fetchMultiTenantMap(config);
    
    if (!subredditMap || Object.keys(subredditMap).length === 0) {
      Logger.log("WARNING: No active alerts found. Nothing to process.");
      return;
    }

    const uniqueSubreddits = Object.keys(subredditMap);
    Logger.log(`Found ${uniqueSubreddits.length} unique subreddit(s) with active alerts:`);
    uniqueSubreddits.forEach(subreddit => {
      const userCount = subredditMap[subreddit].length;
      Logger.log(`  - r/${subreddit}: ${userCount} user(s) watching`);
    });

    // Cost control setup
    if (ENABLE_LIMIT) {
      Logger.log(`\nCost limit enabled: Max ${MAX_POSTS_PER_RUN} posts per run`);
    }

    // Step 2: Scrape Loop - Process each unique subreddit once
    Logger.log("\n=== Step 2: Scraping Reddit Feeds ===");
    let totalProcessed = 0;
    let totalErrors = 0;
    let limitReached = false;

    for (const subreddit of uniqueSubreddits) {
      // Check if cost limit has been reached
      if (ENABLE_LIMIT && totalProcessed >= MAX_POSTS_PER_RUN) {
        Logger.log("\n⚠️ Cost limit reached. Stopping further processing.");
        limitReached = true;
        break;
      }

      try {
        Logger.log(`\nProcessing r/${subreddit}...`);
        
        // Fetch Reddit posts (scrape once per subreddit)
        const posts = fetchRedditPosts(subreddit);
        
        if (!posts || posts.length === 0) {
          Logger.log(`No posts found for r/${subreddit}`);
          continue;
        }

        Logger.log(`Found ${posts.length} post(s) from r/${subreddit}`);

        // Step 3: Distribution Logic - Check each post against all users watching this subreddit
        Logger.log(`Checking posts against ${subredditMap[subreddit].length} user(s) watching r/${subreddit}...`);
        
        const usersWatching = subredditMap[subreddit];
        let subredditProcessed = 0;
        let subredditErrors = 0;

        for (const post of posts) {
          // Check if we've reached the global limit
          if (ENABLE_LIMIT && totalProcessed >= MAX_POSTS_PER_RUN) {
            Logger.log(`\n⚠️ Cost limit reached. Stopping further processing.`);
            limitReached = true;
            break;
          }

          // Check this post against each user watching this subreddit
          for (const userConfig of usersWatching) {
            // Check if post matches this user's keywords
            if (matchesKeywords(post, userConfig.keywords)) {
              // Calculate remaining limit
              const remainingLimit = ENABLE_LIMIT ? MAX_POSTS_PER_RUN - totalProcessed : null;
              
              // Save post as lead for this user
              const result = savePostToSupabase(config, post, userConfig.alertId, subreddit, remainingLimit);
              
              if (result.success) {
                totalProcessed++;
                subredditProcessed++;
                Logger.log(`✓ Saved post for user ${userConfig.userId.substring(0, 8)}... (alert: ${userConfig.alertId.substring(0, 8)}...)`);
                
                // If limit was reached, break out of all loops
                if (ENABLE_LIMIT && totalProcessed >= MAX_POSTS_PER_RUN) {
                  limitReached = true;
                  break;
                }
              } else if (result.error) {
                totalErrors++;
                subredditErrors++;
              }
              // If duplicate (409), result.success is false but result.error is null - just skip
            }
          }

          if (limitReached) {
            break;
          }
        }

        Logger.log(`r/${subreddit}: ${subredditProcessed} post(s) saved, ${subredditErrors} error(s)`);

        if (limitReached) {
          break;
        }

      } catch (error) {
        Logger.log(`✗ Error processing r/${subreddit}: ${error.message}`);
        Logger.log(error.stack);
        totalErrors++;
      }
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    Logger.log(`\n[${formatTimestamp(endTime)}] Worker 1 completed`);
    Logger.log(`Duration: ${duration.toFixed(2)}s`);
    Logger.log(`Total posts saved: ${totalProcessed}${ENABLE_LIMIT ? ` (limit: ${MAX_POSTS_PER_RUN})` : ''}`);
    if (limitReached) {
      Logger.log(`⚠️ Cost limit was reached during this run`);
    }
    Logger.log(`Errors: ${totalErrors}`);

  } catch (error) {
    Logger.log(`FATAL ERROR: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Get configuration from Script Properties
 * 
 * Reads from Google Apps Script Properties:
 * - SUPABASE_URL: Your Supabase project URL (e.g., https://xxxxx.supabase.co)
 * - SUPABASE_KEY: Your Supabase Service Role key (JWT token)
 * 
 * To set these: File > Project Settings > Script Properties
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  
  // Read from Script Properties (set in File > Project Settings > Script Properties)
  const supabaseUrl = props.getProperty("SUPABASE_URL");
  const supabaseKey = props.getProperty("SUPABASE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    Logger.log("Missing configuration properties:");
    Logger.log(`  SUPABASE_URL: ${supabaseUrl ? "✓" : "✗"}`);
    Logger.log(`  SUPABASE_KEY: ${supabaseKey ? "✓" : "✗"}`);
    Logger.log("Please set these in: File > Project Settings > Script Properties");
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseKey: supabaseKey.trim(),
  };
}

/**
 * Fetch Multi-Tenant Map
 * 
 * Fetches all active alerts and project_settings, then joins them by user_id
 * and groups by subreddit.
 * 
 * Returns a map structure:
 * {
 *   "saas": [
 *     { userId: "uuid-A", alertId: "alert-1", keywords: ["seo", "marketing"] },
 *     { userId: "uuid-B", alertId: "alert-2", keywords: ["saas"] }
 *   ],
 *   "entrepreneur": [
 *     { userId: "uuid-A", alertId: "alert-3", keywords: ["seo", "marketing"] }
 *   ]
 * }
 */
function fetchMultiTenantMap(config) {
  try {
    // Fetch all active alerts
    Logger.log("Fetching active alerts...");
    const alertsUrl = `${config.supabaseUrl}/rest/v1/alerts?is_active=eq.true&select=id,subreddit,user_id`;
    const alertsResponse = UrlFetchApp.fetch(alertsUrl, {
      method: "GET",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const alertsStatusCode = alertsResponse.getResponseCode();
    const alertsResponseText = alertsResponse.getContentText();

    if (alertsStatusCode !== 200) {
      Logger.log(`ERROR: Supabase API returned ${alertsStatusCode} when fetching alerts`);
      Logger.log(`Response: ${alertsResponseText}`);
      return {};
    }

    const alerts = JSON.parse(alertsResponseText);
    if (!Array.isArray(alerts) || alerts.length === 0) {
      Logger.log("No active alerts found");
      return {};
    }

    Logger.log(`Found ${alerts.length} active alert(s)`);

    // Fetch all project_settings
    Logger.log("Fetching project settings...");
    const settingsUrl = `${config.supabaseUrl}/rest/v1/project_settings?select=user_id,keywords`;
    const settingsResponse = UrlFetchApp.fetch(settingsUrl, {
      method: "GET",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const settingsStatusCode = settingsResponse.getResponseCode();
    const settingsResponseText = settingsResponse.getContentText();

    if (settingsStatusCode !== 200) {
      Logger.log(`ERROR: Supabase API returned ${settingsStatusCode} when fetching project_settings`);
      Logger.log(`Response: ${settingsResponseText}`);
      return {};
    }

    const settings = JSON.parse(settingsResponseText);
    if (!Array.isArray(settings)) {
      Logger.log("ERROR: project_settings response is not an array");
      return {};
    }

    Logger.log(`Found ${settings.length} project setting(s)`);

    // Create a map of user_id -> keywords for quick lookup
    const userKeywordsMap = {};
    for (const setting of settings) {
      if (setting.user_id && setting.keywords && Array.isArray(setting.keywords)) {
        userKeywordsMap[setting.user_id] = setting.keywords.filter(k => k && k.trim().length > 0);
      }
    }

    Logger.log(`Mapped keywords for ${Object.keys(userKeywordsMap).length} user(s)`);

    // Join alerts with project_settings by user_id and group by subreddit
    const subredditMap = {};

    for (const alert of alerts) {
      // Skip alerts without required fields
      if (!alert.id || !alert.subreddit || !alert.user_id) {
        continue;
      }

      // Get keywords for this user
      const keywords = userKeywordsMap[alert.user_id] || [];
      
      // Skip if user has no keywords (avoid fetching everything)
      if (keywords.length === 0) {
        Logger.log(`Skipping alert ${alert.id} - user ${alert.user_id} has no keywords`);
        continue;
      }

      // Normalize subreddit name (remove 'r/' prefix if present, lowercase)
      const subreddit = alert.subreddit.replace(/^r\//, '').toLowerCase();

      // Initialize subreddit array if needed
      if (!subredditMap[subreddit]) {
        subredditMap[subreddit] = [];
      }

      // Add user configuration to this subreddit
      subredditMap[subreddit].push({
        userId: alert.user_id,
        alertId: alert.id,
        keywords: keywords
      });
    }

    return subredditMap;
  } catch (error) {
    Logger.log(`ERROR fetching multi-tenant map: ${error.message}`);
    Logger.log(error.stack);
    return {};
  }
}

/**
 * Generate a randomized Chrome User-Agent to avoid bot detection
 * Randomizes Chrome version slightly to make each request look unique
 */
function generateStealthUserAgent() {
  // Base Chrome version (current stable: 131.x)
  const baseVersion = 131;
  // Randomize the build number to make each request unique (format: 131.0.XXXX.YY)
  const buildNumber = 6000 + Math.floor(Math.random() * 1000); // 6000-6999 (realistic build range)
  const patchNumber = Math.floor(Math.random() * 100); // 0-99
  
  // Randomly choose between Windows and Mac
  const isWindows = Math.random() > 0.5;
  
  if (isWindows) {
    // Windows Chrome User-Agent
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${baseVersion}.0.${buildNumber}.${patchNumber} Safari/537.36`;
  } else {
    // Mac Chrome User-Agent
    const macVersion = `10_${15 + Math.floor(Math.random() * 2)}_${Math.floor(Math.random() * 10)}`;
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${baseVersion}.0.${buildNumber}.${patchNumber} Safari/537.36`;
  }
}

/**
 * Fetch Reddit posts from a subreddit using RSS feed
 * RSS feeds are more stable for Google Apps Script than JSON API
 */
function fetchRedditPosts(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/new.rss?limit=100`;
  
  try {
    // Generate a randomized User-Agent for each request
    const userAgent = generateStealthUserAgent();
    
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        "Accept": "application/rss+xml,application/xml,text/xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log(`ERROR: Reddit RSS returned ${statusCode}`);
      Logger.log(`Response: ${responseText.substring(0, 200)}`);
      return [];
    }

    // Parse XML using XmlService
    const document = XmlService.parse(responseText);
    const root = document.getRootElement();
    
    // Reddit RSS uses Atom format, so entries are in atom:entry elements
    // Namespace handling for Atom feeds
    const atomNamespace = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    const entries = root.getChildren('entry', atomNamespace);
    
    if (!entries || entries.length === 0) {
      Logger.log("ERROR: No entries found in RSS feed");
      return [];
    }

    // Map XML entries to post objects
    const posts = entries.map((entry) => {
      // Extract title
      const titleElement = entry.getChild('title', atomNamespace);
      const title = titleElement ? titleElement.getText() : "";
      
      // Extract content (selftext) and strip HTML tags
      const contentElement = entry.getChild('content', atomNamespace);
      let selftext = "";
      if (contentElement) {
        const contentText = contentElement.getText();
        // Strip HTML tags using regex
        selftext = contentText.replace(/<[^>]*>/g, "").trim();
      }
      
      // Extract URL from link element (href attribute)
      const linkElement = entry.getChild('link', atomNamespace);
      let url = "";
      if (linkElement) {
        url = linkElement.getAttribute('href') ? linkElement.getAttribute('href').getValue() : "";
      }
      
      // Extract author name
      const authorElement = entry.getChild('author', atomNamespace);
      let author = "[deleted]";
      if (authorElement) {
        const nameElement = authorElement.getChild('name', atomNamespace);
        if (nameElement) {
          author = nameElement.getText();
        }
      }
      
      // Extract ID
      const idElement = entry.getChild('id', atomNamespace);
      const id = idElement ? idElement.getText() : "";
      
      // Extract updated date and convert to Unix timestamp
      const updatedElement = entry.getChild('updated', atomNamespace);
      let created_utc = Math.floor(Date.now() / 1000); // Default to current time
      if (updatedElement) {
        const updatedText = updatedElement.getText();
        // Parse ISO 8601 date (e.g., "2024-01-15T10:30:00+00:00")
        try {
          const date = new Date(updatedText);
          created_utc = Math.floor(date.getTime() / 1000);
        } catch (e) {
          Logger.log(`Warning: Could not parse date: ${updatedText}`);
        }
      }
      
      return {
        id: id,
        title: title,
        body: selftext, // Using 'body' to match database schema
        url: url,
        author: author,
        subreddit: subreddit,
        created_utc: created_utc,
      };
    }).filter((post) => {
      // Filter out posts missing required fields
      return post.id && post.title && post.author && post.created_utc;
    });

    return posts;
  } catch (error) {
    Logger.log(`ERROR fetching Reddit posts: ${error.message}`);
    Logger.log(error.stack);
    return [];
  }
}

/**
 * Extract short Reddit post ID from full Reddit URL/ID
 * Reddit RSS provides full URLs like: https://www.reddit.com/r/saas/comments/abc123/title/
 * We need just the short ID: abc123
 */
function extractRedditPostId(redditId) {
  if (!redditId) return "";
  
  // Reddit ID format in RSS: https://www.reddit.com/r/subreddit/comments/SHORT_ID/title/
  // We need to extract the SHORT_ID part
  const match = redditId.match(/\/comments\/([^\/]+)\//);
  if (match && match[1]) {
    return match[1];
  }
  
  // If it's already a short ID (just letters/numbers), return as-is
  if (/^[a-z0-9]+$/i.test(redditId)) {
    return redditId;
  }
  
  // Fallback: try to extract from any URL pattern
  const parts = redditId.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'comments' && parts[i + 1]) {
      return parts[i + 1];
    }
  }
  
  // Last resort: return the last meaningful part
  return redditId.split('/').pop() || redditId;
}

/**
 * Check if a post matches any of the given keywords (case-insensitive)
 * A post matches if its title OR body contains at least one keyword
 * 
 * @param {Object} post - Post object with title and body
 * @param {Array} keywords - Array of keyword strings
 * @returns {boolean} True if post matches any keyword
 */
function matchesKeywords(post, keywords) {
  if (!keywords || keywords.length === 0) {
    return false; // No keywords = no match (safety check)
  }

  // Convert keywords to lowercase for case-insensitive matching
  const lowerKeywords = keywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 0);
  
  if (lowerKeywords.length === 0) {
    return false;
  }

  const title = (post.title || "").toLowerCase();
  const body = (post.body || "").toLowerCase();
  
  // Check if any keyword appears in title or body
  return lowerKeywords.some(keyword => {
    return title.includes(keyword) || body.includes(keyword);
  });
}

/**
 * Save a single post to Supabase leads table
 * Handles duplicates gracefully (logs and continues)
 * 
 * @param {Object} config - Configuration object with supabaseUrl and supabaseKey
 * @param {Object} post - Post object to save
 * @param {string} alertId - The alert ID to associate with this post
 * @param {string} subreddit - The subreddit name
 * @param {number|null} remainingLimit - Optional limit check (null = no limit)
 * @returns {Object} Object with success boolean and error message (if any)
 */
function savePostToSupabase(config, post, alertId, subreddit, remainingLimit) {
  // Check limit if enabled
  if (remainingLimit !== null && remainingLimit <= 0) {
    return { success: false, error: "Limit reached" };
  }

  try {
    // Extract short post ID
    const redditPostId = extractRedditPostId(post.id);
    
    if (!redditPostId) {
      Logger.log(`Warning: Could not extract post ID from: ${post.id}`);
      return { success: false, error: "Invalid post ID" };
    }

    // Prepare data for Supabase
    const leadData = {
      reddit_post_id: redditPostId,
      alert_id: alertId,
      title: post.title || "",
      body: post.body || "",
      url: post.url || "",
      author: post.author || "[deleted]",
      subreddit: subreddit,
      created_utc: post.created_utc || Math.floor(Date.now() / 1000),
      processing_status: 'new',
      status: 'new'
    };

    // Insert into Supabase
    const url = `${config.supabaseUrl}/rest/v1/leads`;
    const response = UrlFetchApp.fetch(url, {
      method: "POST",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      payload: JSON.stringify(leadData),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode === 201 || statusCode === 200) {
      return { success: true, error: null };
    } else if (statusCode === 409 || statusCode === 23505) {
      // Duplicate key error (UNIQUE constraint violation)
      // This is expected - post already exists for this or another user
      return { success: false, error: null }; // Not an error, just skip
    } else {
      Logger.log(`✗ Failed to save post ${redditPostId}: HTTP ${statusCode}`);
      Logger.log(`Response: ${responseText.substring(0, 200)}`);
      return { success: false, error: `HTTP ${statusCode}` };
    }
  } catch (error) {
    Logger.log(`✗ Error saving post: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Format timestamp for logging
 */
function formatTimestamp(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

/**
 * Setup function - run this once to configure script properties
 * You can also set these manually in the Script Editor:
 * File > Project Settings > Script Properties
 * 
 * IMPORTANT: Use SUPABASE_SERVICE_ROLE_KEY (not anon key) to bypass RLS policies
 */
function setupConfig() {
  const props = PropertiesService.getScriptProperties();
  
  // Set these values (you'll need to replace with your actual values)
  // CRITICAL: Use SERVICE_ROLE_KEY, not anon key, to bypass RLS (Row Level Security)
  props.setProperty("SUPABASE_URL", "https://your-project.supabase.co");
  props.setProperty("SUPABASE_KEY", "your-supabase-SERVICE-ROLE-key"); // Must be service role key!
  
  Logger.log("Configuration set. Please update the values with your actual credentials.");
  Logger.log("⚠️ IMPORTANT: SUPABASE_KEY must be the SERVICE_ROLE_KEY (not anon key) to bypass RLS");
  Logger.log("You can also set these manually in File > Project Settings > Script Properties");
}
