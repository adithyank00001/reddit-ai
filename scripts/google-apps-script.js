/**
 * Smart Scout - Google Apps Script
 * 
 * Fetches active alerts from Supabase, retrieves Reddit posts for each alert,
 * and sends them to the Vercel backend for processing.
 * 
 * Configuration (set via PropertiesService):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_KEY: Supabase anon or service role key
 * - VERCEL_ENDPOINT: Full URL to your Vercel /api/cron endpoint
 * - CRON_SECRET: Secret token for authenticating with Vercel
 */

/**
 * Main function to run the Smart Scout process
 * This should be set up as a time-driven trigger in Google Apps Script
 */
function runSmartScout() {
  const startTime = new Date();
  Logger.log(`[${formatTimestamp(startTime)}] Smart Scout started`);

  try {
    // Get configuration
    const config = getConfig();
    if (!config) {
      Logger.log("ERROR: Configuration missing. Please set script properties.");
      return;
    }

    // Fetch active alerts from Supabase
    Logger.log("Fetching active alerts from Supabase...");
    const alerts = fetchActiveAlerts(config);
    
    if (!alerts || alerts.length === 0) {
      Logger.log("No active alerts found. Exiting.");
      return;
    }

    Logger.log(`Found ${alerts.length} active alert(s)`);

    // Process each alert
    let totalProcessed = 0;
    let totalErrors = 0;

    for (const alert of alerts) {
      try {
        Logger.log(`\nProcessing alert: ${alert.id} (r/${alert.subreddit})`);
        
        // Fetch Reddit posts
        const posts = fetchRedditPosts(alert.subreddit);
        
        if (!posts || posts.length === 0) {
          Logger.log(`No posts found for r/${alert.subreddit}`);
          continue;
        }

        Logger.log(`Found ${posts.length} post(s) from r/${alert.subreddit}`);

        // Map posts to expected format
        const mappedPosts = mapRedditPosts(posts, alert.subreddit);

        // Send to Vercel
        const result = sendToVercel(config, alert.id, alert.subreddit, mappedPosts);
        
        if (result.success) {
          Logger.log(`✓ Successfully sent ${mappedPosts.length} post(s) to Vercel`);
          totalProcessed += mappedPosts.length;
        } else {
          Logger.log(`✗ Failed to send posts: ${result.error}`);
          totalErrors++;
        }
      } catch (error) {
        Logger.log(`✗ Error processing alert ${alert.id}: ${error.message}`);
        totalErrors++;
        // Continue with next alert
      }
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    Logger.log(`\n[${formatTimestamp(endTime)}] Smart Scout completed`);
    Logger.log(`Duration: ${duration.toFixed(2)}s`);
    Logger.log(`Total posts processed: ${totalProcessed}`);
    Logger.log(`Errors: ${totalErrors}`);

  } catch (error) {
    Logger.log(`FATAL ERROR: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Get configuration from Script Properties
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  
  const supabaseUrl = props.getProperty("SUPABASE_URL");
  const supabaseKey = props.getProperty("SUPABASE_KEY");
  const vercelEndpoint = props.getProperty("VERCEL_ENDPOINT");
  const cronSecret = props.getProperty("CRON_SECRET");

  if (!supabaseUrl || !supabaseKey || !vercelEndpoint || !cronSecret) {
    Logger.log("Missing configuration properties:");
    Logger.log(`  SUPABASE_URL: ${supabaseUrl ? "✓" : "✗"}`);
    Logger.log(`  SUPABASE_KEY: ${supabaseKey ? "✓" : "✗"}`);
    Logger.log(`  VERCEL_ENDPOINT: ${vercelEndpoint ? "✓" : "✗"}`);
    Logger.log(`  CRON_SECRET: ${cronSecret ? "✓" : "✗"}`);
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseKey: supabaseKey.trim(),
    vercelEndpoint: vercelEndpoint.trim(),
    cronSecret: cronSecret.trim(),
  };
}

/**
 * Fetch active alerts from Supabase
 */
function fetchActiveAlerts(config) {
  const url = `${config.supabaseUrl}/rest/v1/alerts?select=id,subreddit&is_active=eq.true`;
  
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

    const alerts = JSON.parse(responseText);
    return Array.isArray(alerts) ? alerts : [];
  } catch (error) {
    Logger.log(`ERROR fetching alerts: ${error.message}`);
    return [];
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
        selftext: selftext,
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
 * Map Reddit post data to expected format
 * Since fetchRedditPosts now handles the mapping (XML to Object),
 * this function simply returns the posts array as-is (pass-through)
 */
function mapRedditPosts(redditPosts, subreddit) {
  // Posts are already mapped in fetchRedditPosts, so just return them
  return redditPosts;
}

/**
 * Send posts to Vercel backend
 */
function sendToVercel(config, alertId, subreddit, posts) {
  if (!posts || posts.length === 0) {
    return { success: false, error: "No posts to send" };
  }

  const payload = {
    alert_id: alertId,
    subreddit: subreddit,
    posts: posts,
  };

  try {
    const response = UrlFetchApp.fetch(config.vercelEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.cronSecret}`,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: "Success (no JSON response)" };
      }
      
      Logger.log(`Vercel response: ${JSON.stringify(result)}`);
      return { success: true, result: result };
    } else {
      const errorMsg = `HTTP ${statusCode}: ${responseText.substring(0, 200)}`;
      Logger.log(`ERROR: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    Logger.log(`ERROR sending to Vercel: ${error.message}`);
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
  props.setProperty("VERCEL_ENDPOINT", "https://your-app.vercel.app/api/cron");
  props.setProperty("CRON_SECRET", "your-cron-secret");
  
  Logger.log("Configuration set. Please update the values with your actual credentials.");
  Logger.log("⚠️ IMPORTANT: SUPABASE_KEY must be the SERVICE_ROLE_KEY (not anon key) to bypass RLS");
  Logger.log("You can also set these manually in File > Project Settings > Script Properties");
}
