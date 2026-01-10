import { logger } from "./logger";
import { Post } from "@/types";

/**
 * Notification service for sending real-time alerts about high-value leads.
 * Currently supports Discord webhooks (fire-and-forget pattern).
 */

type NotificationChannel = "discord" | "slack" | "email";

interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  responseTime?: number;
  error?: string;
}

/**
 * Formats a lead into a Discord webhook message payload.
 * Creates a rich embed with all relevant lead information.
 */
function formatDiscordMessage(lead: Post): {
  content?: string;
  embeds: Array<{
    title: string;
    description: string;
    color: number;
    fields: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    timestamp?: string;
    url?: string;
  }>;
} {
  logger.debug("NOTIFICATION", "Formatting Discord message", {
    leadId: lead.id,
    redditPostId: lead.reddit_post_id,
    title: lead.title.substring(0, 50),
    score: lead.opportunity_score,
  });

  const score = lead.opportunity_score ?? 0;
  const scoreColor = score >= 90 ? 0x00ff00 : score >= 80 ? 0xffaa00 : 0xff6b00; // Green, Orange, Red-orange

  // Truncate long fields for Discord (2000 char limit per field)
  const truncate = (text: string, maxLength: number = 1000): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };

  const fields = [
    {
      name: "🎯 Opportunity Score",
      value: `${score}/100`,
      inline: true,
    },
    {
      name: "📊 Type",
      value: lead.opportunity_type || "N/A",
      inline: true,
    },
    {
      name: "📍 Subreddit",
      value: `r/${lead.subreddit}`,
      inline: true,
    },
  ];

  if (lead.opportunity_reason) {
    fields.push({
      name: "💡 Reason",
      value: truncate(lead.opportunity_reason, 500),
      inline: false,
    });
  }

  if (lead.suggested_angle) {
    fields.push({
      name: "🎨 Suggested Angle",
      value: truncate(lead.suggested_angle, 500),
      inline: false,
    });
  }

  // Add draft reply if available
  if (lead.reply_draft && lead.reply_draft.trim().length > 0) {
    // Format as code block for better readability in Discord
    // Discord field value limit is 1024 characters, so we need to truncate if needed
    const draftForDiscord = truncate(lead.reply_draft, 900); // Leave room for code block markers
    const draftFieldValue = `\`\`\`text\n${draftForDiscord}\n\`\`\``;
    
    fields.push({
      name: "💬 Draft Reply",
      value: draftFieldValue,
      inline: false,
    });

    logger.debug("NOTIFICATION_DRAFT_INCLUDED", "Draft reply included in Discord notification", {
      leadId: lead.id,
      redditPostId: lead.reddit_post_id,
      draftLength: lead.reply_draft.length,
      draftFieldLength: draftFieldValue.length,
      wasTruncated: lead.reply_draft.length > 900,
    });
  } else {
    logger.debug("NOTIFICATION_DRAFT_MISSING", "Draft reply not available for notification", {
      leadId: lead.id,
      redditPostId: lead.reddit_post_id,
      hasReplyDraft: !!lead.reply_draft,
      replyDraftLength: lead.reply_draft?.length || 0,
    });
  }

  fields.push({
    name: "👤 Author",
    value: lead.author || "Unknown",
    inline: true,
  });

  fields.push({
    name: "🔗 Link",
    value: `[View Post](${lead.url})`,
    inline: true,
  });

  const embed = {
    title: truncate(lead.title, 256),
    description: truncate(lead.body || "No body text", 2000),
    color: scoreColor,
    fields,
    timestamp: lead.created_at || new Date().toISOString(),
    url: lead.url,
  };

  logger.debug("NOTIFICATION", "Discord message formatted", {
    leadId: lead.id,
    embedTitle: embed.title.substring(0, 50),
    fieldCount: fields.length,
    embedColor: scoreColor,
  });

  return {
    content: `🚨 **New High-Value Lead Detected!**`,
    embeds: [embed],
  };
}

/**
 * Sends a notification to Discord via webhook.
 * Uses fire-and-forget pattern - errors are logged but don't throw.
 */
async function sendDiscordNotification(lead: Post): Promise<NotificationResult> {
  const startTime = Date.now();
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  logger.step("NOTIFICATION_DISCORD_START", "Starting Discord notification", {
    leadId: lead.id,
    redditPostId: lead.reddit_post_id,
    score: lead.opportunity_score,
    hasWebhookUrl: !!webhookUrl,
  });

  // Check if webhook URL is configured
  if (!webhookUrl) {
    logger.warn("NOTIFICATION", "Discord webhook URL not configured", {
      leadId: lead.id,
      envVar: "DISCORD_WEBHOOK_URL",
      message: "Skipping notification - webhook URL missing",
    });
    return {
      success: false,
      channel: "discord",
      error: "DISCORD_WEBHOOK_URL environment variable not set",
    };
  }

  logger.debug("NOTIFICATION", "Discord webhook URL found", {
    leadId: lead.id,
    urlLength: webhookUrl.length,
    urlPrefix: webhookUrl.substring(0, 30) + "...",
  });

  // Validate webhook URL format
  if (!webhookUrl.startsWith("https://discord.com/api/webhooks/") && 
      !webhookUrl.startsWith("https://discordapp.com/api/webhooks/")) {
    logger.error("NOTIFICATION", "Invalid Discord webhook URL format", {
      leadId: lead.id,
      urlPrefix: webhookUrl.substring(0, 50),
      expectedPrefix: "https://discord.com/api/webhooks/",
    });
    return {
      success: false,
      channel: "discord",
      error: "Invalid webhook URL format",
    };
  }

  // Format the message
  let payload;
  try {
    payload = formatDiscordMessage(lead);
    logger.debug("NOTIFICATION", "Discord payload prepared", {
      leadId: lead.id,
      hasContent: !!payload.content,
      embedCount: payload.embeds.length,
      payloadSize: JSON.stringify(payload).length,
    });
  } catch (formatError) {
    const errorMsg = formatError instanceof Error ? formatError.message : String(formatError);
    logger.error("NOTIFICATION", "Failed to format Discord message", {
      leadId: lead.id,
      error: errorMsg,
      stack: formatError instanceof Error ? formatError.stack : undefined,
    });
    return {
      success: false,
      channel: "discord",
      error: `Format error: ${errorMsg}`,
    };
  }

  // Send the webhook request
  logger.apiRequest("POST", "Discord Webhook", {
    "Content-Type": "application/json",
  }, {
    leadId: lead.id,
    embedTitle: payload.embeds[0]?.title?.substring(0, 50),
  });

  try {
    const requestStart = Date.now();
    logger.debug("NOTIFICATION", "Sending Discord webhook request", {
      leadId: lead.id,
      webhookUrl: webhookUrl.substring(0, 50) + "...",
      payloadSize: JSON.stringify(payload).length,
    });

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseTime = Date.now() - requestStart;
    const responseStatus = response.status;
    const responseStatusText = response.statusText;

    logger.debug("NOTIFICATION", "Discord webhook response received", {
      leadId: lead.id,
      status: responseStatus,
      statusText: responseStatusText,
      responseTime,
      headers: Object.fromEntries(response.headers.entries()),
    });

    // Read response body for logging
    let responseBody: string | null = null;
    try {
      responseBody = await response.text();
      logger.debug("NOTIFICATION", "Discord webhook response body", {
        leadId: lead.id,
        bodyLength: responseBody.length,
        bodyPreview: responseBody.substring(0, 200),
      });
    } catch (bodyError) {
      logger.warn("NOTIFICATION", "Failed to read Discord response body", {
        leadId: lead.id,
        error: bodyError instanceof Error ? bodyError.message : String(bodyError),
      });
    }

    const totalTime = Date.now() - startTime;

    if (!response.ok) {
      logger.error("NOTIFICATION", "Discord webhook returned error status", {
        leadId: lead.id,
        status: responseStatus,
        statusText: responseStatusText,
        responseBody: responseBody?.substring(0, 500),
        responseTime,
        totalTime,
      });

      logger.apiResponse("POST", "Discord Webhook", responseStatus, responseStatusText, responseTime, {
        error: true,
        responseBody: responseBody?.substring(0, 200),
      });

      return {
        success: false,
        channel: "discord",
        responseTime: totalTime,
        error: `HTTP ${responseStatus}: ${responseStatusText}`,
      };
    }

    // Success!
    logger.info("NOTIFICATION", "Discord notification sent successfully", {
      leadId: lead.id,
      redditPostId: lead.reddit_post_id,
      score: lead.opportunity_score,
      status: responseStatus,
      responseTime,
      totalTime,
    });

    logger.apiResponse("POST", "Discord Webhook", responseStatus, responseStatusText, responseTime, {
      success: true,
      leadId: lead.id,
    });

    logger.step("NOTIFICATION_DISCORD_SUCCESS", "Discord notification completed", {
      leadId: lead.id,
      totalTime,
      responseTime,
    });

    return {
      success: true,
      channel: "discord",
      responseTime: totalTime,
    };
  } catch (fetchError) {
    const totalTime = Date.now() - startTime;
    const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    const errorStack = fetchError instanceof Error ? fetchError.stack : undefined;

    logger.error("NOTIFICATION", "Discord webhook request failed", {
      leadId: lead.id,
      error: errorMsg,
      errorName: fetchError instanceof Error ? fetchError.name : "UnknownError",
      stack: errorStack,
      totalTime,
    });

    logger.apiResponse("POST", "Discord Webhook", 0, "Network Error", totalTime, {
      error: errorMsg,
    });

    return {
      success: false,
      channel: "discord",
      responseTime: totalTime,
      error: errorMsg,
    };
  }
}

/**
 * Main notification function.
 * Sends notifications via configured channels (currently Discord only).
 * Uses fire-and-forget pattern - never throws, always logs errors.
 * 
 * @param lead - The lead/post to notify about
 * @param channels - Array of channels to notify (defaults to ["discord"])
 * @returns Promise that resolves when all notifications are attempted (but doesn't wait for them)
 */
export async function sendNotification(
  lead: Post,
  channels: NotificationChannel[] = ["discord"]
): Promise<void> {
  const notificationStart = Date.now();
  
  logger.step("NOTIFICATION_START", "Starting notification process", {
    leadId: lead.id,
    redditPostId: lead.reddit_post_id,
    title: lead.title.substring(0, 50),
    score: lead.opportunity_score,
    channels: channels.join(", "),
    channelCount: channels.length,
  });

  // Validate lead has required fields
  if (!lead.id || !lead.title) {
    logger.error("NOTIFICATION", "Invalid lead data - missing required fields", {
      leadId: lead.id || "MISSING",
      hasTitle: !!lead.title,
      leadKeys: Object.keys(lead),
    });
    return;
  }

  logger.debug("NOTIFICATION", "Lead validation passed", {
    leadId: lead.id,
    hasScore: lead.opportunity_score !== null && lead.opportunity_score !== undefined,
    score: lead.opportunity_score,
    hasType: !!lead.opportunity_type,
    hasReason: !!lead.opportunity_reason,
  });

  // Process each channel
  const results: NotificationResult[] = [];
  
  for (const channel of channels) {
    logger.debug("NOTIFICATION", "Processing notification channel", {
      leadId: lead.id,
      channel,
      channelIndex: channels.indexOf(channel),
      totalChannels: channels.length,
    });

    try {
      let result: NotificationResult;

      switch (channel) {
        case "discord":
          result = await sendDiscordNotification(lead);
          break;
        case "slack":
          // TODO: Implement Slack notifications
          logger.warn("NOTIFICATION", "Slack notifications not yet implemented", {
            leadId: lead.id,
            channel,
          });
          result = {
            success: false,
            channel: "slack",
            error: "Not implemented",
          };
          break;
        case "email":
          // TODO: Implement email notifications
          logger.warn("NOTIFICATION", "Email notifications not yet implemented", {
            leadId: lead.id,
            channel,
          });
          result = {
            success: false,
            channel: "email",
            error: "Not implemented",
          };
          break;
        default:
          logger.error("NOTIFICATION", "Unknown notification channel", {
            leadId: lead.id,
            channel,
            validChannels: ["discord", "slack", "email"],
          });
          result = {
            success: false,
            channel,
            error: `Unknown channel: ${channel}`,
          };
      }

      results.push(result);

      logger.debug("NOTIFICATION", "Channel notification completed", {
        leadId: lead.id,
        channel,
        success: result.success,
        responseTime: result.responseTime,
        error: result.error,
      });
    } catch (channelError) {
      const errorMsg = channelError instanceof Error ? channelError.message : String(channelError);
      logger.error("NOTIFICATION", "Unexpected error in channel notification", {
        leadId: lead.id,
        channel,
        error: errorMsg,
        stack: channelError instanceof Error ? channelError.stack : undefined,
      });

      results.push({
        success: false,
        channel,
        error: errorMsg,
      });
    }
  }

  const totalTime = Date.now() - notificationStart;
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  logger.step("NOTIFICATION_COMPLETE", "All notifications processed", {
    leadId: lead.id,
    totalChannels: channels.length,
    successCount,
    failureCount,
    totalTime,
    results: results.map((r) => ({
      channel: r.channel,
      success: r.success,
      responseTime: r.responseTime,
      hasError: !!r.error,
    })),
  });

  if (successCount > 0) {
    logger.info("NOTIFICATION", "Notification sent successfully", {
      leadId: lead.id,
      successCount,
      totalChannels: channels.length,
      totalTime,
    });
  }

  if (failureCount > 0) {
    logger.warn("NOTIFICATION", "Some notifications failed", {
      leadId: lead.id,
      failureCount,
      totalChannels: channels.length,
      failedChannels: results.filter((r) => !r.success).map((r) => r.channel),
      totalTime,
    });
  }
}
