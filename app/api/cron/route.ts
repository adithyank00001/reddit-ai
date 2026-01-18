import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { analyzeOpportunity } from "@/lib/ai";
import { sendNotification } from "@/lib/notifications";
import { RedditPost } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface CronPayload {
  alert_id: string;
  subreddit: string;
  posts: RedditPost[];
}

/**
 * Smart Scout Cron Endpoint
 * 
 * Receives alert_id and posts from Google Apps Script.
 * Trusts the alert_id without database lookup.
 * Processes posts: deduplicates, analyzes with AI, saves leads, and sends notifications.
 */
export async function POST(req: Request) {
  const requestStart = Date.now();
  logger.apiRequest("POST", "/api/cron");

  try {
    // Step 1: Validate Authorization
    const authHeader = req.headers.get("authorization");
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn("CRON_AUTH", "Authorization failed", {
        provided: authHeader ? "present" : "missing",
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    logger.step("CRON_AUTH", "Authorization successful");

    // Step 2: Parse and validate payload
    let payload: CronPayload;
    try {
      payload = await req.json();
    } catch (error) {
      logger.error("CRON_PARSE", "Failed to parse JSON body", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!payload.alert_id || !payload.subreddit || !Array.isArray(payload.posts)) {
      logger.error("CRON_VALIDATION", "Missing required fields", {
        hasAlertId: !!payload.alert_id,
        hasSubreddit: !!payload.subreddit,
        hasPosts: Array.isArray(payload.posts),
        postCount: Array.isArray(payload.posts) ? payload.posts.length : 0,
      });
      return NextResponse.json(
        { error: "Missing required fields: alert_id, subreddit, or posts" },
        { status: 400 }
      );
    }

    logger.info("CRON_PAYLOAD", "📥 Received payload from GAS", {
      alertId: payload.alert_id,
      subreddit: payload.subreddit,
      postCount: payload.posts.length,
    });
    
    // Log sample posts for visibility
    if (payload.posts.length > 0) {
      logger.info("CRON_SAMPLE_POSTS", "Sample posts received", {
        sample1: {
          id: payload.posts[0].id,
          title: payload.posts[0].title.substring(0, 60) + "...",
          author: payload.posts[0].author,
        },
        sample2: payload.posts.length > 1 ? {
          id: payload.posts[1].id,
          title: payload.posts[1].title.substring(0, 60) + "...",
          author: payload.posts[1].author,
        } : null,
      });
    }

    // Step 3: Fetch global product context and keywords (single DB call)
    logger.dbQuery("SELECT", "project_settings", { operation: "fetch_global_context" });
    const { data: settings, error: settingsError } = await supabase
      .from("project_settings")
      .select("product_context, keywords")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      logger.dbError("SELECT", "project_settings", settingsError);
      logger.warn("CRON_CONTEXT", "Failed to fetch product context, using empty string", {
        error: settingsError.message,
      });
    }

    const productContext = settings?.product_context || "";
    const keywords = Array.isArray(settings?.keywords) && settings.keywords.length > 0 
      ? settings.keywords 
      : [];
    
    logger.info("CRON_CONTEXT", "Product context loaded", {
      hasContext: !!productContext,
      contextLength: productContext.length,
      keywordCount: keywords.length,
    });

    // Step 4: Batch deduplication - check which posts already exist
    const postIds = payload.posts.map((post) => post.id);
    
    if (postIds.length === 0) {
      logger.info("CRON_EMPTY", "No posts to process");
      return NextResponse.json({
        status: "success",
        processed: 0,
        new: 0,
        duplicates: 0,
      });
    }

    logger.dbQuery("SELECT", "leads", { operation: "batch_deduplication", postCount: postIds.length });
    const { data: existingLeads, error: dedupeError } = await supabase
      .from("leads")
      .select("reddit_post_id")
      .in("reddit_post_id", postIds);

    if (dedupeError) {
      logger.dbError("SELECT", "leads", dedupeError);
      return NextResponse.json(
        { error: "Failed to check for duplicates", detail: dedupeError.message },
        { status: 500 }
      );
    }

    const existingPostIds = new Set(existingLeads?.map((lead) => lead.reddit_post_id) || []);
    const newPosts = payload.posts.filter((post) => !existingPostIds.has(post.id));

    logger.info("CRON_DEDUPE", "🔍 Deduplication complete", {
      total: payload.posts.length,
      duplicates: existingPostIds.size,
      new: newPosts.length,
      duplicatePercentage: ((existingPostIds.size / payload.posts.length) * 100).toFixed(1) + "%",
    });

    if (newPosts.length === 0) {
      logger.info("CRON_NO_NEW", "All posts are duplicates");
      return NextResponse.json({
        status: "success",
        processed: payload.posts.length,
        new: 0,
        duplicates: payload.posts.length,
      });
    }

    // Step 4.5: Keyword filtering - filter posts that match keywords
    logger.step("CRON_FILTER_START", "🔍 Starting keyword filtering", {
      newPostsCount: newPosts.length,
      keywordCount: keywords.length,
      keywords: keywords.length > 0 ? keywords : "none",
    });

    // If keywords array is empty or null, stop execution to save costs
    if (keywords.length === 0) {
      logger.warn("CRON_FILTER_EMPTY_KEYWORDS", "No keywords defined in settings. Stopping execution to save costs.", {
        totalPosts: payload.posts.length,
        duplicates: existingPostIds.size,
        newPosts: newPosts.length,
      });
      return NextResponse.json({
        status: "skipped",
        reason: "No keywords defined",
      });
    }

    // Filter posts: a post is relevant if title OR selftext contains at least one keyword (case-insensitive)
    const relevantPosts = newPosts.filter((post) => {
      const titleLower = post.title.toLowerCase();
      const selftextLower = post.selftext.toLowerCase();
      
      return keywords.some((keyword) => {
        const keywordLower = keyword.toLowerCase();
        return titleLower.includes(keywordLower) || selftextLower.includes(keywordLower);
      });
    });

    logger.info("CRON_FILTER_COMPLETE", "✅ Keyword filtering complete", {
      before: newPosts.length,
      after: relevantPosts.length,
      filtered: newPosts.length - relevantPosts.length,
      filterPercentage: ((relevantPosts.length / newPosts.length) * 100).toFixed(1) + "%",
    });

    // Early return if no posts match keywords
    if (relevantPosts.length === 0) {
      logger.info("CRON_FILTER_NO_MATCH", "No posts match keywords, skipping AI analysis", {
        totalPosts: payload.posts.length,
        duplicates: existingPostIds.size,
        newPosts: newPosts.length,
        filteredOut: newPosts.length,
      });
      return NextResponse.json({
        status: "success",
        processed: payload.posts.length,
        new: 0,
        duplicates: existingPostIds.size,
      });
    }

    // Step 5: Process relevant posts with AI analysis
    logger.step("CRON_AI_START", "🤖 Starting AI analysis", {
      postCount: relevantPosts.length,
      productContextLength: productContext.length,
    });

    const leadsToInsert: any[] = [];
    const leadsForNotification: any[] = [];
    const aiResults: any[] = []; // Track AI results for summary

    for (let i = 0; i < relevantPosts.length; i++) {
      const post = relevantPosts[i];
      try {
        logger.info("CRON_AI_ANALYZING", `Analyzing post ${i + 1}/${relevantPosts.length}`, {
          postId: post.id,
          title: post.title.substring(0, 80) + (post.title.length > 80 ? "..." : ""),
          author: post.author,
        });

        // Run AI analysis
        const opportunity = await analyzeOpportunity(
          post.title,
          post.selftext,
          productContext
        );

        // Track AI result
        aiResults.push({
          isOpportunity: opportunity.is_opportunity,
          score: opportunity.score,
          type: opportunity.opportunity_type,
        });

        // Build lead object
        const lead = {
          reddit_post_id: post.id,
          alert_id: payload.alert_id,
          title: post.title,
          body: post.selftext,
          url: post.url,
          author: post.author,
          subreddit: post.subreddit,
          created_utc: post.created_utc,
          status: "new",
          opportunity_score: opportunity.is_opportunity ? opportunity.score : null,
          opportunity_type: opportunity.is_opportunity ? opportunity.opportunity_type : null,
          opportunity_reason: opportunity.is_opportunity ? opportunity.short_reason : null,
          suggested_angle: opportunity.is_opportunity ? opportunity.suggested_angle : null,
        };

        leadsToInsert.push(lead);

        // Collect leads for notification (score >= 70)
        if (opportunity.is_opportunity && opportunity.score >= 70) {
          leadsForNotification.push(lead);
          logger.info("CRON_AI_HIGH_SCORE", "⭐ High-scoring opportunity found", {
            postId: post.id,
            score: opportunity.score,
            type: opportunity.opportunity_type,
            reason: opportunity.short_reason,
            title: post.title.substring(0, 60) + "...",
          });
        }

        logger.info("CRON_AI_POST_RESULT", "Post analysis result", {
          postId: post.id,
          isOpportunity: opportunity.is_opportunity,
          score: opportunity.score,
          type: opportunity.opportunity_type,
          willNotify: opportunity.is_opportunity && opportunity.score >= 70,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("CRON_AI_ERROR", "AI analysis failed for post", {
          postId: post.id,
          error: errorMsg,
        });
        // Continue processing other posts even if one fails
      }
    }

    // Summary statistics
    const opportunities = aiResults.filter(r => r.isOpportunity).length;
    const avgScore = aiResults.length > 0
      ? (aiResults.reduce((sum, r) => sum + (r.score || 0), 0) / aiResults.length).toFixed(1)
      : "0";
    const highScores = aiResults.filter(r => r.isOpportunity && r.score >= 70).length;
    const typeBreakdown = aiResults
      .filter(r => r.isOpportunity)
      .reduce((acc: any, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {});

    logger.info("CRON_AI_COMPLETE", "✅ AI analysis complete - Summary", {
      totalAnalyzed: leadsToInsert.length,
      opportunitiesFound: opportunities,
      opportunitiesPercentage: ((opportunities / aiResults.length) * 100).toFixed(1) + "%",
      averageScore: avgScore,
      highScores: highScores,
      typeBreakdown: typeBreakdown,
      notificationsToSend: leadsForNotification.length,
    });

    // Step 6: Batch insert leads
    if (leadsToInsert.length > 0) {
      logger.step("CRON_INSERT_START", "💾 Inserting leads into database", {
        count: leadsToInsert.length,
      });
      
      logger.dbQuery("INSERT", "leads", { operation: "batch_insert", count: leadsToInsert.length });
      const { error: insertError } = await supabase
        .from("leads")
        .insert(leadsToInsert);

      if (insertError) {
        logger.dbError("INSERT", "leads", insertError);
        return NextResponse.json(
          { error: "Failed to insert leads", detail: insertError.message },
          { status: 500 }
        );
      }

      logger.info("CRON_INSERT", "✅ Leads inserted successfully", {
        count: leadsToInsert.length,
        withScores: leadsToInsert.filter(l => l.opportunity_score !== null).length,
        withoutScores: leadsToInsert.filter(l => l.opportunity_score === null).length,
      });
    } else {
      logger.info("CRON_INSERT", "⏭️ No leads to insert (all were duplicates or failed analysis)");
    }

    // Step 7: Send notifications for high-scoring leads (score >= 70)
    if (leadsForNotification.length > 0) {
      logger.step("CRON_NOTIFY_START", "Starting notifications", {
        count: leadsForNotification.length,
      });

      // Fetch all inserted lead IDs in a single batch query
      const notificationPostIds = leadsForNotification.map((lead) => lead.reddit_post_id);
      logger.dbQuery("SELECT", "leads", { operation: "fetch_notification_ids", count: notificationPostIds.length });
      const { data: insertedLeads, error: fetchError } = await supabase
        .from("leads")
        .select("id, reddit_post_id")
        .in("reddit_post_id", notificationPostIds);

      if (fetchError) {
        logger.dbError("SELECT", "leads", fetchError);
        logger.warn("CRON_NOTIFY_FETCH", "Failed to fetch lead IDs for notifications", {
          error: fetchError.message,
        });
      } else {
        // Create a map of reddit_post_id -> database id
        const leadIdMap = new Map(
          (insertedLeads || []).map((lead) => [lead.reddit_post_id, lead.id])
        );

        // Send notifications in parallel (fire-and-forget)
        const notificationPromises = leadsForNotification.map(async (lead) => {
          try {
            const dbId = leadIdMap.get(lead.reddit_post_id);
            if (!dbId) {
              logger.warn("CRON_NOTIFY_MISSING", "Lead ID not found for notification", {
                postId: lead.reddit_post_id,
              });
              return;
            }

            // Convert to Post type for notification function
            const postForNotification: any = {
              id: dbId,
              reddit_post_id: lead.reddit_post_id,
              alert_id: lead.alert_id,
              title: lead.title,
              body: lead.body,
              url: lead.url,
              author: lead.author,
              subreddit: lead.subreddit,
              created_utc: lead.created_utc,
              status: lead.status,
              opportunity_score: lead.opportunity_score,
              opportunity_type: lead.opportunity_type,
              opportunity_reason: lead.opportunity_reason,
              suggested_angle: lead.suggested_angle,
            };

            await sendNotification(postForNotification, ["discord"]);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error("CRON_NOTIFY_ERROR", "Notification failed", {
              postId: lead.reddit_post_id,
              error: errorMsg,
            });
            // Continue with other notifications
          }
        });

        // Wait for all notifications to be attempted (but don't fail if some fail)
        await Promise.allSettled(notificationPromises);

        logger.info("CRON_NOTIFY_COMPLETE", "Notifications processed", {
          count: leadsForNotification.length,
        });
      }
    }

    const responseTime = Date.now() - requestStart;
    
    // Final summary
    logger.step("CRON_COMPLETE", "🎉 Processing complete - Final Summary", {
      totalTime: `${(responseTime / 1000).toFixed(2)}s`,
      totalPosts: payload.posts.length,
      newLeads: leadsToInsert.length,
      duplicates: existingPostIds.size,
      notificationsSent: leadsForNotification.length,
      subreddit: payload.subreddit,
      alertId: payload.alert_id,
    });

    logger.apiResponse("POST", "/api/cron", 200, "OK", responseTime, {
      processed: payload.posts.length,
      new: leadsToInsert.length,
      duplicates: existingPostIds.size,
      notifications: leadsForNotification.length,
    });

    return NextResponse.json({
      status: "success",
      processed: payload.posts.length,
      new: leadsToInsert.length,
      duplicates: existingPostIds.size,
      notifications: leadsForNotification.length,
      summary: {
        totalPosts: payload.posts.length,
        newLeads: leadsToInsert.length,
        duplicates: existingPostIds.size,
        highScoreLeads: leadsForNotification.length,
        processingTime: `${(responseTime / 1000).toFixed(2)}s`,
      },
    });
  } catch (err) {
    const responseTime = Date.now() - requestStart;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    logger.error("CRON_ERROR", "Unhandled error", {
      error: errorMessage,
      stack: errorStack,
    });
    logger.apiResponse("POST", "/api/cron", 500, "Internal Server Error", responseTime);
    
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}
