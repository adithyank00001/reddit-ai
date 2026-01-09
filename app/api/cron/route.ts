import { NextResponse } from "next/server";
import { fetchSubredditPosts } from "@/lib/reddit";
import { containsKeyword } from "@/lib/scanner";
import { analyzeIntent } from "@/lib/ai";
import { supabase } from "@/lib/supabase";
import { promises as fs } from "fs";
import * as fsSync from "fs";
import path from "path";
import { logger } from "@/lib/logger";

export const runtime = "nodejs"; // ensure Node runtime (needed for supabase-js with service role)
export const maxDuration = 300; // 5 minutes to avoid timeouts on long sequential work

type AlertRecord = {
  id: string;
  subreddit: string;
  keywords: string[] | null;
  active?: boolean;
};

type PostInsert = {
  reddit_post_id: string;
  alert_id: string;
  title: string;
  body: string;
  url: string;
  author: string;
  subreddit: string;
  created_utc: number;
};

const ALERT_TABLE_CANDIDATES = ["Alert", "alert", "alerts"];
const POST_TABLE_CANDIDATES = [
  "leads",  // Primary table for storing leads (has all columns including alert_id)
  "Lead",
  "lead",
  "Post",
  "post",
  "posts",
  "processed_posts",  // Only for deduplication, not for inserts
];
const POST_ID_COLUMN_CANDIDATES = [
  "reddit_post_id",
  "reddit_id",
  "post_id",
  "id",
];

// Legacy log function for backward compatibility - now uses logger
function log(step: string, message: string) {
  logger.step(step, message);
}

async function logDebug(payload: Record<string, any>) {
  const enriched = {
    sessionId: "debug-session",
    runId: payload.runId ?? "pre-fix",
    hypothesisId: payload.hypothesisId ?? "HX",
    timestamp: Date.now(),
    ...payload,
  };

  fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enriched),
  }).catch(() => {});

  try {
    const logPath = path.join(process.cwd(), ".cursor", "debug.log");
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, JSON.stringify(enriched) + "\n");
  } catch (err) {
    log("LOG_DEBUG", `append failed: ${err}`);
  }
}

async function resolveTableName(
  candidates: string[],
  selectColumnsList: string[]
): Promise<{ name?: string; error?: Error; usedSelectColumns?: string }> {
  logger.step("TABLE_RESOLUTION", `Resolving table name from ${candidates.length} candidates`);
  
  for (const candidate of candidates) {
    for (const selectColumns of selectColumnsList) {
      logger.debug("TABLE_RESOLUTION", `Testing candidate: ${candidate} with columns: ${selectColumns}`);
      // #region agent log
      logDebug({
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "app/api/cron/route.ts:resolveTableName:before",
        message: "Testing candidate table",
        data: { candidate, selectColumns },
      });
      // #endregion

      logger.dbQuery("SELECT", candidate, { operation: "table_resolution", columns: selectColumns });
      const { error } = await supabase
        .from(candidate)
        .select(selectColumns)
        .limit(1);

      // #region agent log
      logDebug({
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "app/api/cron/route.ts:resolveTableName:after",
        message: "Candidate query result",
        data: {
          candidate,
          selectColumns,
          hasError: !!error,
          errorMessage: error?.message,
        },
      });
      // #endregion

      if (!error) {
        logger.info("TABLE_RESOLUTION", `Table resolved: ${candidate}`, { columns: selectColumns });
        return { name: candidate, usedSelectColumns: selectColumns };
      }
      const msg = (error?.message || "").toLowerCase();
      const isMissingTable =
        msg.includes("does not exist") ||
        msg.includes("not exist") ||
        msg.includes("unknown") ||
        msg.includes("undefined") ||
        msg.includes("could not find");
      const isMissingColumn = msg.includes("column");

      if (isMissingColumn) {
        // try next selectColumns variant (fallback without missing column)
        continue;
      }

      if (!isMissingTable) {
        return {
          error: new Error(`Table ${candidate} query failed: ${error.message}`),
        };
      }
      // table missing: move to next candidate
      break;
    }
  }
  return {
    error: new Error(
      "No matching table found for candidates: " + candidates.join(", ")
    ),
  };
}

export async function POST(req: Request) {
  const requestStart = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.apiRequest("POST", "/api/cron", {
    "content-type": req.headers.get("content-type") || "none",
    "user-agent": req.headers.get("user-agent") || "none"
  });
  
  logger.step("CRON_START", `Cron job started | Request ID: ${requestId}`);
  
  // #region agent log
  logDebug({
    runId: "pre-fix",
    hypothesisId: "H2",
    location: "app/api/cron/route.ts:POST:start",
    message: "Cron POST invoked",
    data: { requestId },
  });
  // #endregion

  const authHeader = req.headers.get("authorization");
  logger.debug("AUTH", "Checking authorization", {
    hasHeader: !!authHeader,
    headerPrefix: authHeader ? authHeader.substring(0, 20) + "..." : "none"
  });
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.error("AUTH", "Authorization failed", {
      provided: authHeader ? "present" : "missing",
      expected: `Bearer ${process.env.CRON_SECRET ? "***" : "MISSING"}`
    });
    // #region agent log
    logDebug({
      runId: "pre-fix",
      hypothesisId: "H2",
      location: "app/api/cron/route.ts:POST:auth",
      message: "Auth failed",
      data: { provided: authHeader ? "present" : "missing" },
    });
    // #endregion
    const responseTime = Date.now() - requestStart;
    logger.apiResponse("POST", "/api/cron", 401, "Unauthorized", responseTime);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("AUTH", "Authorization successful");
  const startedAt = new Date().toISOString();
  log("START", `Cron job started at ${startedAt}`);

  // Resolve table names defensively (handles case differences)
  // Try is_active first (actual column name), then active, then without
  const alertTableResult = await resolveTableName(ALERT_TABLE_CANDIDATES, [
    "id, subreddit, keywords, is_active",
    "id, subreddit, keywords, active",
    "id, subreddit, keywords",
  ]);
  if (alertTableResult.error || !alertTableResult.name) {
    log("ERROR", `Failed to resolve Alert table: ${alertTableResult.error?.message || "Unknown error"}`);
    // #region agent log
    logDebug({
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "app/api/cron/route.ts:POST:alertTableFail",
      message: "Alert table resolution failed",
      data: { error: alertTableResult.error?.message },
    });
    // #endregion
    return NextResponse.json(
      {
        error: "Failed to resolve Alert table",
        detail: alertTableResult.error?.message,
      },
      { status: 500 }
    );
  }

  const postTableResult = await resolveTableName(POST_TABLE_CANDIDATES, [
    POST_ID_COLUMN_CANDIDATES[0],
    POST_ID_COLUMN_CANDIDATES[1],
    POST_ID_COLUMN_CANDIDATES[2],
    POST_ID_COLUMN_CANDIDATES[3],
  ]);
  if (postTableResult.error || !postTableResult.name) {
    log("ERROR", `Failed to resolve Post table: ${postTableResult.error?.message || "Unknown error"}`);
    return NextResponse.json(
      {
        error: "Failed to resolve Post table",
        detail: postTableResult.error?.message,
      },
      { status: 500 }
    );
  }

  const alertTable = alertTableResult.name;
  const alertSelectColumns =
    alertTableResult.usedSelectColumns || "id, subreddit, keywords, is_active";
  const alertHasActive = alertSelectColumns.includes("is_active") || alertSelectColumns.includes("active");
  const postTable = postTableResult.name;
  const postIdColumn =
    postTableResult.usedSelectColumns || POST_ID_COLUMN_CANDIDATES[0];
  
  log("TABLES_RESOLVED", `Using table: ${postTable} with column: ${postIdColumn} for storing leads`);

  // #region agent log
  logDebug({
    runId: "pre-fix",
    hypothesisId: "H4",
    location: "app/api/cron/route.ts:POST:tablesResolved",
    message: "Resolved tables/columns",
    data: {
      alertTable,
      alertSelectColumns,
      alertHasActive,
      postTable,
      postIdColumn,
    },
  });
  // #endregion

  // Fetch all alerts (prefer active ones if that column exists)
  log("FETCH_ALERTS", `Fetching alerts from table: ${alertTable} with columns: ${alertSelectColumns}`);
  logger.dbQuery("SELECT", alertTable, { columns: alertSelectColumns });
  const dbStart = Date.now();
  const { data: alerts, error: alertsError } = await supabase
    .from(alertTable)
    .select(alertSelectColumns);
  const dbTime = Date.now() - dbStart;

  if (alertsError) {
    logger.dbError("SELECT", alertTable, alertsError);
    log("ERROR", `Failed to load alerts: ${alertsError.message}`);
    // #region agent log
    logDebug({
      runId: "pre-fix",
      hypothesisId: "H4",
      location: "app/api/cron/route.ts:POST:alertsLoadFail",
      message: "Failed to load alerts",
      data: { error: alertsError.message },
    });
    // #endregion
    return NextResponse.json(
      { error: "Failed to load alerts", detail: alertsError.message },
      { status: 500 }
    );
  }

  const alertRows = (alerts ?? []) as unknown as AlertRecord[];
  log("ALERTS_LOADED", `Loaded ${alertRows.length} alerts from database`);
  
  if (alertRows.length > 0) {
    log("ALERTS_LOADED", `First alert sample: ${JSON.stringify(alertRows[0])}`);
  }

  const activeAlerts = alertRows.filter((a: any) => {
    if (!alertHasActive) {
      return true; // no active column, treat as active
    }
    // Check both is_active and active columns (handle both naming conventions)
    const isActive = (a as any).is_active ?? (a as any).active;
    return isActive === undefined || isActive === true;
  });

  log("ALERTS_FILTERED", `Active alerts count: ${activeAlerts.length}`);

  // #region agent log
  logDebug({
    runId: "pre-fix",
    hypothesisId: "H4",
    location: "app/api/cron/route.ts:POST:alertsFetched",
    message: "Fetched alerts",
    data: { 
      total: alertRows.length, 
      active: activeAlerts.length,
      alertTable,
      alertSelectColumns,
      alertHasActive,
      sampleAlert: alertRows[0] || null,
    },
  });
  // #endregion

  // Early return if no alerts found
  if (activeAlerts.length === 0) {
    log("NO_ALERTS", `No active alerts found. Total alerts in DB: ${alertRows.length}`);
    const finishedAt = new Date().toISOString();
    return NextResponse.json({
      success: true,
      alertsProcessed: 0,
      totalNewLeads: 0,
      startedAt,
      finishedAt,
      message: alertRows.length === 0 
        ? "No alerts found in database. Please create alerts first." 
        : "No active alerts found. All alerts may be inactive.",
      debug: {
        alertTable,
        alertSelectColumns,
        totalAlertsInDb: alertRows.length,
        alertHasActiveColumn: alertHasActive,
      },
    });
  }

  let totalNewLeads = 0;
  let alertsProcessed = 0;

  for (const alert of activeAlerts) {
    alertsProcessed += 1;
    log("PROCESS_ALERT", `Processing alert ${alert.id} (subreddit: ${alert.subreddit})`);

    try {
      // #region agent log
      logDebug({
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "app/api/cron/route.ts:POST:alertStart",
        message: "Processing alert",
        data: { alertId: alert.id, subreddit: alert.subreddit },
      });
      // #endregion

      // Step A: Fetch recent posts for this alert's subreddit
      const posts = await fetchSubredditPosts([alert.subreddit]);
      log("FETCH_POSTS", `Alert ${alert.id} fetched ${posts.length} posts from r/${alert.subreddit}`);

      // Step B: Filter by keywords (text[])
      const keywords = Array.isArray(alert.keywords) ? alert.keywords : [];
      const filteredByKeyword = posts.filter((post) =>
        containsKeyword(`${post.title} ${post.selftext}`, keywords)
      );
      log("KEYWORD_FILTER", `Alert ${alert.id}: ${filteredByKeyword.length} posts matched keywords`);

      if (filteredByKeyword.length === 0) {
        continue;
      }

      // Step C: Bulk dedupe against Post table by reddit_post_id
      const candidateIds = filteredByKeyword.map((p) => p.id);
      logger.dbQuery("SELECT", postTable, {
        operation: "dedupe_check",
        column: postIdColumn,
        idsCount: candidateIds.length
      });
      const dedupeStart = Date.now();
      const { data: existingRows, error: existingError } = await supabase
        .from(postTable)
        .select(postIdColumn)
        .in(postIdColumn, candidateIds);
      const dedupeTime = Date.now() - dedupeStart;
      logger.debug("DB", `Dedupe query completed in ${dedupeTime}ms`, {
        existingCount: existingRows?.length || 0
      });

      if (existingError) {
        logger.dbError("SELECT", postTable, existingError);
        log("ERROR", `Alert ${alert.id} dedupe lookup failed: ${existingError.message}`);
        // #region agent log
        logDebug({
          runId: "pre-fix",
          hypothesisId: "H4",
          location: "app/api/cron/route.ts:POST:dedupeError",
          message: "Dedupe query failed",
          data: { alertId: alert.id, error: existingError.message },
        });
        // #endregion
        continue; // Skip this alert but do not stop the whole cron
      }

      const existingIds = new Set(
        (existingRows || []).map(
          (row: Record<string, any>) => row[postIdColumn]
        )
      );
      const toProcess = filteredByKeyword.filter(
        (post) => !existingIds.has(post.id)
      );
      const skippedCount = filteredByKeyword.length - toProcess.length;
      if (skippedCount > 0) {
        log("DEDUPE_SKIP", `Alert ${alert.id}: Skipped ${skippedCount} posts (already exist in database)`);
      }
      log("DEDUPE", `Alert ${alert.id}: ${toProcess.length} new posts after dedupe (out of ${filteredByKeyword.length} keyword matches)`);

      if (toProcess.length === 0) {
        continue;
      }

      // Step D/E: Sequentially analyze intent and insert leads
      log("AI_ANALYSIS_START", `Alert ${alert.id}: Starting AI analysis for ${toProcess.length} posts`);
      for (const post of toProcess) {
        const hasIntent = await analyzeIntent(post.title, post.selftext);
        if (!hasIntent) {
          log("AI_REJECTED", `Alert ${alert.id}: AI rejected post ${post.id} - no buying intent detected`);
          continue;
        }
        
        log("AI_APPROVED", `Alert ${alert.id}: AI approved post ${post.id} - proceeding to insert`);

        const newPost: Record<string, any> = {
          alert_id: alert.id,
          title: post.title,
          body: post.selftext,
          url: post.url,
          author: post.author,
          subreddit: post.subreddit,
          created_utc: post.created_utc,
        };
        newPost[postIdColumn] = post.id;

        logger.dbQuery("INSERT", postTable, {
          postId: post.id,
          alertId: alert.id,
          title: post.title.substring(0, 50)
        });
        const insertStart = Date.now();
        const { error: insertError, data: insertData } = await supabase
          .from(postTable)
          .insert(newPost);
        const insertTime = Date.now() - insertStart;

        if (insertError) {
          logger.dbError("INSERT", postTable, insertError);
          log("ERROR", `Alert ${alert.id} failed to insert post ${post.id}: ${insertError.message}`);
          // #region agent log
          logDebug({
            runId: "pre-fix",
            hypothesisId: "H4",
            location: "app/api/cron/route.ts:POST:insertError",
            message: "Insert failed",
            data: {
              alertId: alert.id,
              postId: post.id,
              error: insertError.message,
            },
          });
          // #endregion
          continue;
        }

        totalNewLeads += 1;
        logger.dbQuery("INSERT", postTable, { success: true, insertTime }, insertData);
        log("LEAD_INSERTED", `Alert ${alert.id} inserted new lead reddit_post_id=${post.id} in ${insertTime}ms`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log("ERROR", `Alert ${alert.id} failed: ${errorMessage}`);
      // Continue to next alert
      continue;
    }
  }

  const finishedAt = new Date().toISOString();
  const totalTime = Date.now() - requestStart;
  
  if (totalNewLeads === 0) {
    log("FINISH", `Cron job finished at ${finishedAt} | alertsProcessed=${alertsProcessed} | totalNewLeads=${totalNewLeads} | NOTE: No new leads found (posts may have been rejected by AI or already exist in database)`);
  } else {
    log("FINISH", `Cron job finished at ${finishedAt} | alertsProcessed=${alertsProcessed} | totalNewLeads=${totalNewLeads}`);
  }
  
  logger.step("CRON_FINISH", `Cron job completed`, {
    totalTime: `${totalTime}ms`,
    alertsProcessed,
    totalNewLeads,
    startedAt,
    finishedAt
  });
  
  logger.apiResponse("POST", "/api/cron", 200, "OK", totalTime, {
    success: true,
    alertsProcessed,
    totalNewLeads,
    startedAt,
    finishedAt
  });

  return NextResponse.json({
    success: true,
    alertsProcessed,
    totalNewLeads,
    startedAt,
    finishedAt,
  });
}
