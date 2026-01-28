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

// ============================================================================
// POLITE SCRAPER: Identity and throttling to avoid Reddit rate limits / bans
// ============================================================================
/** User-Agent sent to Reddit RSS – generic RSS reader pattern for maximum safety */
const REDDIT_USER_AGENT = "Mozilla/5.0 (compatible; RSS Reader/1.0)";
/** Pause (ms) after a failed fetch before trying the next subreddit */
const SMART_PAUSE_MS = 5000;
/** Abort entire run after this many consecutive subreddit fetch failures */
const CIRCUIT_BREAKER_THRESHOLD = 3;

// ============================================================================
// OWNER MONITORING: Discord alerts for failures / rate limits
// ============================================================================
/**
 * Script Properties key for your ERROR Discord webhook URL.
 * Set this in: File > Project Settings > Script Properties
 */
const ERROR_DISCORD_URL_KEY = "ERROR_DISCORD_URL";
/**
 * Script Properties key for end-of-run execution report (report card).
 * User requested key name: LOG_DISCORD_URL (caps)
 */
const LOG_DISCORD_URL_KEY = "LOG_DISCORD_URL";

/** Severity levels for monitoring */
const SEVERITY = {
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
};

function safeString(value) {
  try {
    return value === null || value === undefined ? "" : String(value);
  } catch (e) {
    return "";
  }
}

function truncate(str, maxLen) {
  const s = safeString(str);
  if (s.length <= maxLen) return s;
  return s.substring(0, maxLen - 3) + "...";
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch (e) {
    return safeString(new Date());
  }
}

/**
 * Send a Discord webhook alert to the owner channel.
 *
 * Notes:
 * - We only send for ERROR/CRITICAL by default to avoid spam.
 * - We include lots of context (run id, subreddit, HTTP codes, counters, stack).
 */
function notifyOwnerDiscord(config, alert) {
  try {
    const webhookUrl = config && config.errorDiscordUrl;
    if (!webhookUrl) {
      // Monitoring not configured; do nothing.
      return;
    }

    const severity = alert && alert.severity ? alert.severity : SEVERITY.ERROR;
    const shouldSend = severity === SEVERITY.ERROR || severity === SEVERITY.CRITICAL;
    if (!shouldSend) return;

    const title = `[${severity}] Worker 1 Monitor Alert`;
    const code = safeString(alert.code || "UNKNOWN");
    const message = truncate(alert.message || "", 1800);

    const fields = [];
    const addField = (name, value) => {
      const v = truncate(value, 1024);
      if (!v) return;
      fields.push({ name: truncate(name, 256), value: v, inline: false });
    };

    addField("code", code);
    addField("time", nowIso());
    addField("run_id", safeString(config.runId || ""));
    addField("subreddit", safeString(alert.subreddit || ""));
    addField("http_status", safeString(alert.httpStatus || ""));
    addField("consecutive_failures", safeString(alert.consecutiveFailures || ""));
    addField("total_errors", safeString(alert.totalErrors || ""));
    addField("total_posts_saved", safeString(alert.totalProcessed || ""));
    addField("action_taken", safeString(alert.actionTaken || ""));
    addField("details", safeString(alert.details || ""));

    // Stack traces can be huge; keep it short
    const stack = truncate(alert.stack || "", 900);
    if (stack) {
      addField("stack (truncated)", "```" + stack + "```");
    }

    const payload = {
      username: "Worker 1 Monitor",
      embeds: [
        {
          title: title,
          description: message,
          color:
            severity === SEVERITY.CRITICAL
              ? 16711680
              : severity === SEVERITY.ERROR
                ? 16753920
                : 16776960,
          fields: fields.slice(0, 24),
          timestamp: new Date().toISOString(),
        },
      ],
    };

    UrlFetchApp.fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": REDDIT_USER_AGENT, // keep a consistent UA on all outgoing requests
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (e) {
    // Never crash the worker because monitoring failed
    Logger.log(`WARNING: Failed to send owner Discord alert: ${e.message}`);
  }
}

/**
 * Send a FINAL EXECUTION REPORT to the log Discord webhook.
 * This is sent at the end of every run (success or partial failure) so you can monitor health.
 *
 * Format requirement: use a code block (```text) to look like terminal output.
 */
function sendExecutionReport(config, stats, startTime, endTime, durationSeconds) {
  try {
    const webhookUrl = config && config.logDiscordUrl;
    if (!webhookUrl) return; // not configured

    const total = stats.totalSubreddits || 0;
    const success = stats.successCount || 0;
    const fail = stats.failCount || 0;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : "0.0";

    const postsFound = stats.postsFound || 0;
    const postsSaved = stats.postsSaved || 0;
    const savedRate = postsFound > 0 ? ((postsSaved / postsFound) * 100).toFixed(1) : "0.0";

    const startStr = startTime ? formatTimestamp(startTime) : "";
    const endStr = endTime ? formatTimestamp(endTime) : "";
    const durationStr = typeof durationSeconds === "number" ? durationSeconds.toFixed(2) : safeString(durationSeconds);

    let failedBlock = "None";
    if (stats.failedList && stats.failedList.length > 0) {
      const lines = [];
      lines.push("SUBREDDIT                      | REASON");
      lines.push("--------------------------------+----------------------------------------");
      stats.failedList.slice(0, 25).forEach((f) => {
        const name = truncate(f.name || "", 30).padEnd(30, " ");
        const reason = truncate(f.reason || "", 40);
        lines.push(`${name} | ${reason}`);
      });
      if (stats.failedList.length > 25) {
        lines.push(`... and ${stats.failedList.length - 25} more`);
      }
      failedBlock = lines.join("\n");
    }

    const reportLines = [];
    reportLines.push("📊 FINAL EXECUTION REPORT");
    reportLines.push("");
    reportLines.push("⏱️ TIMING");
    reportLines.push(`  Start   : ${startStr}`);
    reportLines.push(`  End     : ${endStr}`);
    reportLines.push(`  Duration: ${durationStr}s`);
    reportLines.push("");
    reportLines.push("📈 STATISTICS");
    reportLines.push(`  Subreddits (total)   : ${total}`);
    reportLines.push(`  Fetch success (200)  : ${success}`);
    reportLines.push(`  Fetch failures       : ${fail}`);
    reportLines.push(`  Success rate         : ${successRate}%`);
    reportLines.push(`  Posts found (RSS)    : ${postsFound}`);
    reportLines.push(`  Posts saved (matches): ${postsSaved}`);
    reportLines.push(`  Save rate            : ${savedRate}%`);
    reportLines.push(`  Keywords (total)     : ${stats.keywordCount || 0}`);
    reportLines.push(`  Subreddits (unique)  : ${stats.uniqueSubreddits || total}`);
    if (stats.abortReason) {
      reportLines.push("");
      reportLines.push("🛑 ABORT");
      reportLines.push(`  Reason: ${truncate(stats.abortReason, 250)}`);
    }
    reportLines.push("");
    reportLines.push("❌ FAILED SUBREDDITS");
    reportLines.push(failedBlock);

    const content = "```text\n" + reportLines.join("\n") + "\n```";

    UrlFetchApp.fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": REDDIT_USER_AGENT,
      },
      payload: JSON.stringify({ content: content }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log(`WARNING: Failed to send execution report: ${e.message}`);
  }
}

/**
 * Main function to run the Multi-Tenant Scout process
 * This should be set up as a time-driven trigger in Google Apps Script
 */
function runSmartScout() {
  const startTime = new Date();
  Logger.log(`[${formatTimestamp(startTime)}] Worker 1 (Multi-Tenant Scout) started`);

  // Execution report state tracking (per run)
  let stats = {
    totalSubreddits: 0,
    successCount: 0,
    failCount: 0,
    postsFound: 0,
    postsSaved: 0,
    failedList: [],
    keywordCount: 0,
    uniqueSubreddits: 0,
    abortReason: "",
  };

  let configForReport = null;
  let reportSent = false;

  try {
    // Get configuration
    const config = getConfig();
    if (!config) {
      Logger.log("ERROR: Configuration missing. Please set script properties.");
      return;
    }
    configForReport = config;
    // Add run id for correlation in monitoring
    try {
      config.runId = Utilities.getUuid();
    } catch (e) {
      config.runId = `${new Date().getTime()}`;
    }

    // Step 1: Fetch the "Map" - all active alerts and project settings
    Logger.log("\n=== Step 1: Fetching Multi-Tenant Configuration ===");
    const subredditMap = fetchMultiTenantMap(config);
    
    if (!subredditMap || Object.keys(subredditMap).length === 0) {
      Logger.log("WARNING: No active alerts found. Nothing to process.");
      return;
    }

    const uniqueSubreddits = Object.keys(subredditMap);
    stats.totalSubreddits = uniqueSubreddits.length;
    stats.uniqueSubreddits = uniqueSubreddits.length;
    // Count total unique keywords across all users (for the report)
    try {
      const kwSet = new Set();
      uniqueSubreddits.forEach((sr) => {
        const watchers = subredditMap[sr] || [];
        watchers.forEach((u) => {
          const kws = u.keywords || [];
          kws.forEach((k) => {
            const s = safeString(k).trim().toLowerCase();
            if (s) kwSet.add(s);
          });
        });
      });
      stats.keywordCount = kwSet.size;
    } catch (e) {
      // ignore
    }
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
    let consecutiveFailures = 0; // Circuit breaker: abort after this many in a row
    let aborted = false;

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
        // If we got here, fetch was HTTP 200 (success)
        stats.successCount++;

        if (!posts || posts.length === 0) {
          Logger.log(`No posts found for r/${subreddit}`);
          consecutiveFailures = 0; // Empty feed is success, not failure
          continue;
        }

        Logger.log(`Found ${posts.length} post(s) from r/${subreddit}`);
        stats.postsFound += posts.length;

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
                stats.postsSaved = totalProcessed;
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

        consecutiveFailures = 0; // Success – reset circuit breaker counter

        if (limitReached) {
          break;
        }

      } catch (error) {
        consecutiveFailures++;
        totalErrors++;
        stats.failCount++;
        stats.failedList.push({
          name: `r/${subreddit}`,
          reason: safeString(error && error.message ? error.message : "Unknown error"),
        });
        Logger.log(`✗ Error processing r/${subreddit}: ${error.message}`);
        Logger.log(error.stack);

        // Classify Reddit failures for monitoring
        const status = error && error.httpStatus ? error.httpStatus : error && error.statusCode ? error.statusCode : "";
        const message = safeString(error && error.message ? error.message : "Unknown error");
        let code = "REDDIT_FETCH_FAILED";
        let severity = SEVERITY.ERROR;
        if (status === 429 || message.indexOf("HTTP 429") >= 0) {
          code = "REDDIT_RATE_LIMIT_429";
          severity = SEVERITY.ERROR;
        } else if (status === 403 || message.indexOf("HTTP 403") >= 0) {
          code = "REDDIT_FORBIDDEN_403";
          severity = SEVERITY.CRITICAL; // often indicates blocking/banning
        } else if (typeof status === "number" && status >= 500) {
          code = "REDDIT_SERVER_5XX";
          severity = SEVERITY.ERROR;
        } else if (message.toLowerCase().indexOf("xml") >= 0 || message.toLowerCase().indexOf("parse") >= 0) {
          code = "REDDIT_PARSE_ERROR";
          severity = SEVERITY.ERROR;
        }

        if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          Logger.log(`CRITICAL: Circuit breaker triggered – ${consecutiveFailures} consecutive failures. Aborting run to protect IP.`);
          aborted = true;
          stats.abortReason = `Circuit breaker: ${consecutiveFailures} consecutive failures (kill switch). Last subreddit: r/${subreddit}`;
          notifyOwnerDiscord(config, {
            severity: SEVERITY.CRITICAL,
            code: "CIRCUIT_BREAKER_TRIGGERED",
            message: "Worker 1 aborted due to repeated subreddit failures (kill switch).",
            subreddit: subreddit,
            httpStatus: status,
            consecutiveFailures: `${consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD}`,
            totalErrors: totalErrors,
            totalProcessed: totalProcessed,
            actionTaken: "ABORT_RUN",
            details: `Last error code: ${code}. Last error message: ${message}`,
            stack: error && error.stack ? error.stack : "",
          });
          break;
        }

        Logger.log(`WARNING: Smart Pause – waiting ${SMART_PAUSE_MS / 1000}s before next subreddit (consecutive failures: ${consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD}).`);
        // Notify owner on important failures (rate limit / forbidden / server errors)
        notifyOwnerDiscord(config, {
          severity: severity,
          code: code,
          message: `Worker 1 hit an error fetching Reddit RSS. Smart Pause triggered (${SMART_PAUSE_MS / 1000}s).`,
          subreddit: subreddit,
          httpStatus: status,
          consecutiveFailures: `${consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD}`,
          totalErrors: totalErrors,
          totalProcessed: totalProcessed,
          actionTaken: `SMART_PAUSE_${SMART_PAUSE_MS}ms`,
          details: message,
          stack: error && error.stack ? error.stack : "",
        });
        Utilities.sleep(SMART_PAUSE_MS);
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

    // Always send execution report at end of run
    stats.postsSaved = totalProcessed;
    sendExecutionReport(config, stats, startTime, endTime, duration);
    reportSent = true;

    // Preserve existing behavior: if we aborted, stop here (after reporting)
    if (aborted) {
      return;
    }

  } catch (error) {
    Logger.log(`FATAL ERROR: ${error.message}`);
    Logger.log(error.stack);
    // Try to alert owner if we can still read config
    try {
      const config = getConfig();
      if (config) {
        notifyOwnerDiscord(config, {
          severity: SEVERITY.CRITICAL,
          code: "RUN_FATAL_ERROR",
          message: "Worker 1 crashed with an unhandled (fatal) error.",
          details: safeString(error.message),
          stack: error.stack,
          actionTaken: "CRASH",
        });
      }
    } catch (e) {
      // ignore
    }
  } finally {
    // If we returned early (e.g., no alerts) we won't have sent a report.
    // Send a minimal report if config is available.
    try {
      if (configForReport && !reportSent) {
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        // If stats.totalSubreddits was never set, keep it as-is (0)
        if (!stats.postsSaved) stats.postsSaved = 0;
        if (!stats.postsFound) stats.postsFound = 0;
        sendExecutionReport(configForReport, stats, startTime, endTime, duration);
      }
    } catch (e) {
      // ignore
    }
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
  const errorDiscordUrl = props.getProperty(ERROR_DISCORD_URL_KEY);
  const logDiscordUrl = props.getProperty(LOG_DISCORD_URL_KEY);

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
    errorDiscordUrl: errorDiscordUrl ? errorDiscordUrl.trim() : "",
    logDiscordUrl: logDiscordUrl ? logDiscordUrl.trim() : "",
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
        "User-Agent": REDDIT_USER_AGENT,
      },
      muteHttpExceptions: true,
    });

    const alertsStatusCode = alertsResponse.getResponseCode();
    const alertsResponseText = alertsResponse.getContentText();

    if (alertsStatusCode !== 200) {
      Logger.log(`ERROR: Supabase API returned ${alertsStatusCode} when fetching alerts`);
      Logger.log(`Response: ${alertsResponseText}`);
      notifyOwnerDiscord(config, {
        severity: SEVERITY.ERROR,
        code: "SUPABASE_ALERTS_FETCH_FAILED",
        message: "Worker 1 could not fetch alerts from Supabase.",
        httpStatus: alertsStatusCode,
        details: truncate(alertsResponseText, 500),
        actionTaken: "RETURN_EMPTY_MAP",
      });
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
        "User-Agent": REDDIT_USER_AGENT,
      },
      muteHttpExceptions: true,
    });

    const settingsStatusCode = settingsResponse.getResponseCode();
    const settingsResponseText = settingsResponse.getContentText();

    if (settingsStatusCode !== 200) {
      Logger.log(`ERROR: Supabase API returned ${settingsStatusCode} when fetching project_settings`);
      Logger.log(`Response: ${settingsResponseText}`);
      notifyOwnerDiscord(config, {
        severity: SEVERITY.ERROR,
        code: "SUPABASE_SETTINGS_FETCH_FAILED",
        message: "Worker 1 could not fetch project_settings from Supabase.",
        httpStatus: settingsStatusCode,
        details: truncate(settingsResponseText, 500),
        actionTaken: "RETURN_EMPTY_MAP",
      });
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
 * Fetch Reddit posts from a subreddit using RSS feed
 * RSS feeds are more stable for Google Apps Script than JSON API
 * Uses a polite bot User-Agent and throws on HTTP/network/parse failure so the loop can throttle/abort.
 */
function fetchRedditPosts(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/new.rss?limit=100`;

  const response = UrlFetchApp.fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": REDDIT_USER_AGENT,
      "Accept": "application/rss+xml,application/xml,text/xml,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode !== 200) {
    Logger.log(`ERROR: Reddit RSS returned ${statusCode} for r/${subreddit}`);
    Logger.log(`Response: ${responseText.substring(0, 200)}`);
    const err = new Error(`Reddit RSS HTTP ${statusCode}`);
    err.statusCode = statusCode;
    err.httpStatus = statusCode;
    err.subreddit = subreddit;
    err.responseSnippet = responseText ? responseText.substring(0, 200) : "";
    throw err;
  }

  try {

    // Parse XML using XmlService
    const document = XmlService.parse(responseText);
    const root = document.getRootElement();
    
    // Reddit RSS uses Atom format, so entries are in atom:entry elements
    // Namespace handling for Atom feeds
    const atomNamespace = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    const entries = root.getChildren('entry', atomNamespace);
    
    if (!entries || entries.length === 0) {
      // Empty feed is normal (e.g. no new posts) – not a failure; do not throw
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
    Logger.log(`ERROR fetching Reddit posts for r/${subreddit}: ${error.message}`);
    Logger.log(error.stack);
    throw error; // rethrow so caller can apply Smart Pause / Circuit Breaker
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
        "Prefer": "return=minimal",
        "User-Agent": REDDIT_USER_AGENT,
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
      // Only notify owner for high-signal Supabase issues (avoid spamming per post)
      if ((statusCode === 401 || statusCode === 403) && !config._notifiedSupabaseAuthError) {
        config._notifiedSupabaseAuthError = true;
        notifyOwnerDiscord(config, {
          severity: SEVERITY.CRITICAL,
          code: "SUPABASE_AUTH_ERROR",
          message: "Worker 1 cannot write leads to Supabase (auth error).",
          httpStatus: statusCode,
          details: truncate(responseText, 700),
          actionTaken: "CONTINUING_BUT_WRITES_WILL_FAIL",
        });
      }
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
  props.setProperty(ERROR_DISCORD_URL_KEY, "https://discord.com/api/webhooks/xxxxx/xxxxx");
  props.setProperty(LOG_DISCORD_URL_KEY, "https://discord.com/api/webhooks/xxxxx/xxxxx");
  
  Logger.log("Configuration set. Please update the values with your actual credentials.");
  Logger.log("⚠️ IMPORTANT: SUPABASE_KEY must be the SERVICE_ROLE_KEY (not anon key) to bypass RLS");
  Logger.log("You can also set these manually in File > Project Settings > Script Properties");
}
