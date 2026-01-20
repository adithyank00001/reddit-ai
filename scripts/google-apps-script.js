/**
 * Worker 1: The Scout - Google Apps Script
 * 
 * Fetches Reddit posts from manually specified subreddits, filters by keywords,
 * and saves matching posts directly to Supabase leads table.
 * 
 * Configuration (set via PropertiesService):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_KEY: Supabase Service Role key (required to bypass RLS)
 */

// ============================================================================
// MANUAL CONFIGURATION: Edit this list to add/remove subreddits
// ============================================================================
const TARGET_SUBREDDITS = ['saas', 'entrepreneur'];

// ============================================================================
// COST CONTROL: Limit posts saved per run to control OpenAI costs
// ============================================================================
const ENABLE_LIMIT = true; // Set to false to disable the limit
const MAX_POSTS_PER_RUN = 10; // Max number of posts to save total

/**
 * Main function to run the Smart Scout process
 * This should be set up as a time-driven trigger in Google Apps Script
 */
function runSmartScout() {
  const startTime = new Date();
  Logger.log(`[${formatTimestamp(startTime)}] Worker 1 (The Scout) started`);

  try {
    // Get configuration
    const config = getConfig();
    if (!config) {
      Logger.log("ERROR: Configuration missing. Please set script properties.");
      return;
    }

    // Fetch keywords from database
    Logger.log("Fetching keywords from project_settings...");
    const keywords = fetchKeywords(config);
    
    if (!keywords || keywords.length === 0) {
      Logger.log("WARNING: No keywords found in project_settings. Stopping to avoid fetching everything.");
      Logger.log("Please add keywords to the project_settings table (id=1) before running again.");
      return;
    }

    Logger.log(`Found ${keywords.length} keyword(s): ${keywords.join(', ')}`);

    // Cost control setup
    if (ENABLE_LIMIT) {
      Logger.log(`Cost limit enabled: Max ${MAX_POSTS_PER_RUN} posts per run`);
    }

    // Process each subreddit in manual list
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    let limitReached = false;

    for (const subreddit of TARGET_SUBREDDITS) {
      // Check if cost limit has been reached
      if (ENABLE_LIMIT && totalProcessed >= MAX_POSTS_PER_RUN) {
        Logger.log("\n⚠️ Cost limit reached. Stopping further processing.");
        limitReached = true;
        break;
      }

      try {
        Logger.log(`\nProcessing r/${subreddit}...`);
        
        // Find alert_id for this subreddit
        const alertId = findAlertId(config, subreddit);
        if (!alertId) {
          Logger.log(`No active alert found for r/${subreddit}. Skipping.`);
          totalSkipped++;
          continue;
        }

        Logger.log(`Found alert_id: ${alertId} for r/${subreddit}`);
        
        // Fetch Reddit posts
        const posts = fetchRedditPosts(subreddit);
        
        if (!posts || posts.length === 0) {
          Logger.log(`No posts found for r/${subreddit}`);
          continue;
        }

        Logger.log(`Found ${posts.length} post(s) from r/${subreddit}`);

        // Filter posts by keywords
        const filteredPosts = filterPostsByKeywords(posts, keywords);
        Logger.log(`After keyword filtering: ${filteredPosts.length} post(s) match`);

        if (filteredPosts.length === 0) {
          Logger.log(`No posts match keywords for r/${subreddit}`);
          continue;
        }

        // Calculate remaining limit
        const remainingLimit = ENABLE_LIMIT ? MAX_POSTS_PER_RUN - totalProcessed : null;

        // Save matching posts to Supabase (respects limit)
        const saved = savePostsToSupabase(config, filteredPosts, alertId, subreddit, remainingLimit);
        totalProcessed += saved.success;
        totalErrors += saved.errors;

        // Check if limit was reached during this save operation
        if (ENABLE_LIMIT && totalProcessed >= MAX_POSTS_PER_RUN) {
          Logger.log("\n⚠️ Cost limit reached. Stopping further processing.");
          limitReached = true;
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
    Logger.log(`Subreddits skipped: ${totalSkipped}`);
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
 * Fetch keywords from project_settings table
 * Returns the keywords array or empty array if not found
 */
function fetchKeywords(config) {
  const url = `${config.supabaseUrl}/rest/v1/project_settings?id=eq.1&select=keywords`;
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log(`ERROR: Supabase API returned ${statusCode}`);
      Logger.log(`Response: ${responseText}`);
      return [];
    }

    const result = JSON.parse(responseText);
    if (!Array.isArray(result) || result.length === 0) {
      Logger.log("No project_settings found with id=1");
      return [];
    }

    const keywords = result[0].keywords;
    return Array.isArray(keywords) ? keywords : [];
  } catch (error) {
    Logger.log(`ERROR fetching keywords: ${error.message}`);
    return [];
  }
}

/**
 * Find alert_id for a given subreddit
 * Returns the first active alert's ID, or null if not found
 */
function findAlertId(config, subreddit) {
  const url = `${config.supabaseUrl}/rest/v1/alerts?subreddit=eq.${encodeURIComponent(subreddit)}&is_active=eq.true&select=id&limit=1`;
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log(`ERROR: Supabase API returned ${statusCode}`);
      Logger.log(`Response: ${responseText}`);
      return null;
    }

    const result = JSON.parse(responseText);
    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }

    return result[0].id;
  } catch (error) {
    Logger.log(`ERROR finding alert_id: ${error.message}`);
    return null;
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
 * Filter posts by keywords (case-insensitive)
 * A post matches if its title OR body contains at least one keyword
 */
function filterPostsByKeywords(posts, keywords) {
  if (!keywords || keywords.length === 0) {
    return posts; // No keywords = no filtering
  }

  // Convert keywords to lowercase for case-insensitive matching
  const lowerKeywords = keywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 0);

  return posts.filter(post => {
    const title = (post.title || "").toLowerCase();
    const body = (post.body || "").toLowerCase();
    
    // Check if any keyword appears in title or body
    return lowerKeywords.some(keyword => {
      return title.includes(keyword) || body.includes(keyword);
    });
  });
}

/**
 * Save posts to Supabase leads table
 * Handles duplicates gracefully (logs and continues)
 * 
 * @param {Object} config - Configuration object with supabaseUrl and supabaseKey
 * @param {Array} posts - Array of post objects to save
 * @param {string} alertId - The alert ID to associate with these posts
 * @param {string} subreddit - The subreddit name
 * @param {number|null} remainingLimit - Optional limit on how many posts to save (null = no limit)
 * @returns {Object} Object with success count and error count
 */
function savePostsToSupabase(config, posts, alertId, subreddit, remainingLimit) {
  if (!posts || posts.length === 0) {
    return { success: 0, errors: 0 };
  }

  let successCount = 0;
  let errorCount = 0;

  for (const post of posts) {
    // Check if we've reached the limit (if enabled)
    if (remainingLimit !== null && successCount >= remainingLimit) {
      Logger.log(`Cost limit reached (${remainingLimit} posts). Stopping save operation.`);
      break;
    }

    try {
      // Extract short post ID
      const redditPostId = extractRedditPostId(post.id);
      
      if (!redditPostId) {
        Logger.log(`Warning: Could not extract post ID from: ${post.id}`);
        errorCount++;
        continue;
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
        successCount++;
        Logger.log(`✓ Saved post: ${redditPostId} (${post.title.substring(0, 50)}...)`);
      } else if (statusCode === 409 || statusCode === 23505) {
        // Duplicate key error (UNIQUE constraint violation)
        Logger.log(`Post already exists, skipping: ${redditPostId}`);
        // Don't count as error, just continue
      } else {
        Logger.log(`✗ Failed to save post ${redditPostId}: HTTP ${statusCode}`);
        Logger.log(`Response: ${responseText.substring(0, 200)}`);
        errorCount++;
      }
    } catch (error) {
      Logger.log(`✗ Error saving post: ${error.message}`);
      errorCount++;
    }
  }

  return { success: successCount, errors: errorCount };
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
  Logger.log("\n📝 Don't forget to edit TARGET_SUBREDDITS at the top of the script!");
}
