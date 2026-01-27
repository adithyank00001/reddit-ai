"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { createErrorResponse, getUserMessage } from "@/lib/error-codes";

/**
 * Settings update action
 * Updates project_settings, alerts, and client_profiles (first available row)
 */
export async function updateSettings(formData: FormData) {
  // Direct console.log to ensure we see this even if logger fails
  console.log("[DEBUG] updateSettings FUNCTION CALLED - NEW CODE VERSION", new Date().toISOString());
  
  try {
    logger.info("AI_DEBUG", "updateSettings FUNCTION CALLED - NEW CODE VERSION", {
      timestamp: new Date().toISOString(),
    });
  } catch (loggerError) {
    console.error("[DEBUG] Logger error:", loggerError);
  }
  
  // Use service role client to bypass RLS for server-side operations
  const supabase = supabaseServiceRole;
  
  console.log("[DEBUG] Supabase client initialized");

  // Get real user from Supabase auth
  const authClient = await createClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  
  if (authError || !user) {
    logger.error("AUTH_ERROR", "Unauthorized access to updateSettings", {
      error: authError?.message,
    });
    return createErrorResponse("AUTH_REQUIRED", { authError: authError?.message });
  }
  
  const userId = user.id;
  
  logger.info("AI_DEBUG", "updateSettings USER ID CHECK", {
    hasUserId: !!userId,
    userId: userId || "none",
  });

  // Extract form data (check if keys exist to determine which sections to update)
  const hasProductDescription = formData.has("productDescription");
  const hasKeywords = formData.has("keywords");
  const hasSubreddits = formData.has("subreddits");
  const hasSlackWebhook = formData.has("slackWebhookUrl");
  const hasDiscordWebhook = formData.has("discordWebhookUrl");
  const hasNotificationEmail = formData.has("notificationEmail");
  const hasEmailNotifications = formData.has("emailNotificationsEnabled");
  const hasSlackNotifications = formData.has("slackNotificationsEnabled");
  const hasDiscordNotifications = formData.has("discordNotificationsEnabled");
  const hasWebsiteUrl = formData.has("websiteUrl");

  const rawDescription = hasProductDescription ? String(formData.get("productDescription") || "") : "";
  const keywordsJson = hasKeywords ? String(formData.get("keywords") || "[]") : "[]";
  const subredditsJson = hasSubreddits ? String(formData.get("subreddits") || "[]") : "[]";
  const slackWebhookUrl = hasSlackWebhook ? String(formData.get("slackWebhookUrl") || "") : "";
  const discordWebhookUrl = hasDiscordWebhook ? String(formData.get("discordWebhookUrl") || "") : "";
  const notificationEmail = hasNotificationEmail ? String(formData.get("notificationEmail") || "").trim() : "";
  const emailNotificationsEnabled = hasEmailNotifications ? formData.get("emailNotificationsEnabled") === "true" : undefined;
  const slackNotificationsEnabled = hasSlackNotifications ? formData.get("slackNotificationsEnabled") === "true" : undefined;
  const discordNotificationsEnabled = hasDiscordNotifications ? formData.get("discordNotificationsEnabled") === "true" : undefined;
  const websiteUrl = hasWebsiteUrl ? String(formData.get("websiteUrl") || "").trim() : "";
  
  console.log("[DEBUG] Form data extracted:", {
    rawDescriptionLength: rawDescription.length,
    rawDescriptionPreview: rawDescription.substring(0, 50),
    hasDescription: !!rawDescription,
  });
  
  logger.info("AI_DEBUG", "updateSettings FORM DATA EXTRACTED", {
    rawDescriptionLength: rawDescription.length,
    rawDescriptionPreview: rawDescription.substring(0, 50),
    hasDescription: !!rawDescription,
    trimmedLength: rawDescription.trim().length,
  });

  // Parse keywords array (now sent as JSON like subreddits)
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(keywordsJson);
    if (!Array.isArray(keywords)) keywords = [];
  } catch (error) {
    // Fallback: try parsing as comma-separated string for backward compatibility
    const keywordsString = keywordsJson;
    if (keywordsString && !keywordsString.startsWith("[")) {
      keywords = keywordsString
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length >= 2);
    }
  }

  // Parse subreddits array
  let subreddits: string[] = [];
  try {
    subreddits = JSON.parse(subredditsJson);
    if (!Array.isArray(subreddits)) subreddits = [];
  } catch (error) {
    logger.error("PARSE_SUBREDDITS_ERROR", "Failed to parse subreddits JSON", {
      error: error instanceof Error ? error.message : String(error),
      subredditsJson,
    });
    subreddits = [];
  }

  // Log parsed subreddits for debugging
  logger.info("PARSED_SUBREDDITS", "Parsed subreddits from form", {
    userId,
    subredditsCount: subreddits.length,
    subreddits,
    subredditsJson,
    hasSubreddits,
  });

  logger.info("SETTINGS_UPDATE_START", "Settings form received", {
    userId,
    descriptionLength: rawDescription.length,
    keywordsCount: keywords.length,
    subredditsCount: subreddits.length,
    hasWebhook: !!slackWebhookUrl,
  });

  // Clean and validate keywords
  const cleanedKeywords = keywords
    .map((k) => String(k).trim())
    .filter((k) => k.length >= 2);

  const maxKeywords = 10;
  const limitedKeywords =
    cleanedKeywords.length > maxKeywords
      ? cleanedKeywords.slice(0, maxKeywords)
      : cleanedKeywords;

  try {
    // Update project_settings if any project settings fields are provided
    if (hasKeywords || hasProductDescription || hasWebsiteUrl || hasSlackWebhook || hasDiscordWebhook || hasNotificationEmail || hasEmailNotifications || hasSlackNotifications || hasDiscordNotifications) {
      const settingsPayload: {
        user_id: string;
        product_description_raw?: string;
        keywords?: string[];
        website_url?: string;
        slack_webhook_url?: string | null;
        discord_webhook_url?: string | null;
        notification_email?: string | null;
        email_notifications_enabled?: boolean;
        slack_notifications_enabled?: boolean;
        discord_notifications_enabled?: boolean;
      } = {
        user_id: userId,
      };
      
      if (hasProductDescription) {
        settingsPayload.product_description_raw = rawDescription;
      }
      
      if (hasKeywords) {
        settingsPayload.keywords = limitedKeywords;
      }
      
      if (hasWebsiteUrl) {
        settingsPayload.website_url = websiteUrl || null;
      }

      // Notification settings
      if (hasSlackWebhook) {
        settingsPayload.slack_webhook_url = slackWebhookUrl.trim() || null;
      }

      if (hasDiscordWebhook) {
        settingsPayload.discord_webhook_url = discordWebhookUrl.trim() || null;
      }

      if (hasNotificationEmail) {
        settingsPayload.notification_email = notificationEmail || null;
      }

      if (hasEmailNotifications) {
        settingsPayload.email_notifications_enabled = emailNotificationsEnabled;
      }

      if (hasSlackNotifications) {
        settingsPayload.slack_notifications_enabled = slackNotificationsEnabled;
      }

      if (hasDiscordNotifications) {
        settingsPayload.discord_notifications_enabled = discordNotificationsEnabled;
      }
      
      logger.info("SETTINGS_UPDATE", "Upserting settings to database", {
        userId,
        descriptionLength: rawDescription.length,
        keywordCount: limitedKeywords.length,
        operation: "upsert",
      });

      const { error: settingsError } = await supabase
        .from("project_settings")
        .upsert(settingsPayload, { onConflict: "user_id" });
      
      logger.info("AI_DEBUG", "updateSettings AFTER DB SAVE", {
        hasError: !!settingsError,
        errorMessage: settingsError?.message || "none",
        errorCode: settingsError?.code || "none",
      });

      if (settingsError) {
        logger.error(
          "SETTINGS_UPDATE_ERROR",
          "Failed to update project_settings",
          {
            message: settingsError.message,
            code: (settingsError as any).code,
          }
        );
        return createErrorResponse("SETTINGS_SAVE_FAILED", {
          dbError: settingsError.message,
          code: (settingsError as any).code,
        });
      }
    }

    // Update alerts for this user if subreddits are provided
    // Sync alerts table with submitted subreddits:
    // - New subreddit in list  -> INSERT
    // - Subreddit removed      -> SET is_active = false (can't delete due to foreign key with leads)
    // - Existing               -> Do nothing
    // Note: Process subreddits if the key exists (even if array is empty, to allow removing all)
    if (hasSubreddits) {
      // Normalize and deduplicate submitted subreddits
      const cleanedSubreddits = Array.from(
        new Set(
          subreddits
            .map((s) => {
              let clean = String(s || "").trim().toLowerCase();
              if (clean.startsWith("r/")) {
                clean = clean.slice(2);
              }
              return clean;
            })
            .filter((s) => s.length > 0)
        )
      );

      // Fetch existing alerts for this user (including inactive ones to properly sync)
      const { data: existingAlerts = [] } = await supabase
        .from("alerts")
        .select("id, subreddit, is_active")
        .eq("user_id", userId);

      // Helper function to normalize subreddit names (same as cleaning logic)
      const normalizeSubreddit = (subreddit: string): string => {
        let clean = String(subreddit || "").trim().toLowerCase();
        if (clean.startsWith("r/")) {
          clean = clean.slice(2);
        }
        return clean;
      };

      // Separate active and inactive alerts
      const activeAlerts = existingAlerts.filter((a) => a.is_active === true);
      const inactiveAlerts = existingAlerts.filter((a) => a.is_active === false);

      // Normalize existing alerts for comparison (handle any "r/" prefix or casing differences)
      const activeSet = new Set(
        activeAlerts.map((a) => normalizeSubreddit(a.subreddit))
      );
      const inactiveSet = new Set(
        inactiveAlerts.map((a) => normalizeSubreddit(a.subreddit))
      );
      const desiredSet = new Set(cleanedSubreddits);

      // Find subreddits to add:
      // - If not in active set AND not in inactive set -> truly new, need to INSERT
      // - If in inactive set -> reactivate existing alert
      // Note: cleanedSubreddits are already normalized, so direct comparison works
      const toInsert = cleanedSubreddits.filter(
        (s) => !activeSet.has(s) && !inactiveSet.has(s)
      );
      const toReactivate = cleanedSubreddits.filter(
        (s) => inactiveSet.has(s)
      );

      // Find alerts to remove (only active ones that are not in desired list)
      // Use normalized comparison to handle any casing or "r/" prefix differences
      const toRemove = activeAlerts.filter(
        (a) => !desiredSet.has(normalizeSubreddit(a.subreddit))
      );

      // Debug logging
      logger.info("SUBREDDIT_SYNC_DEBUG", "Subreddit sync analysis", {
        userId,
        cleanedSubreddits,
        existingAlertsCount: existingAlerts.length,
        activeAlertsCount: activeAlerts.length,
        inactiveAlertsCount: inactiveAlerts.length,
        activeAlerts: activeAlerts.map(a => ({ id: a.id, subreddit: a.subreddit, is_active: a.is_active })),
        toInsert,
        toReactivate,
        toRemove: toRemove.map(a => ({ id: a.id, subreddit: a.subreddit })),
        desiredSet: Array.from(desiredSet),
      });

      let alertsError: any = null;

      // Reactivate previously deactivated alerts that are now in the list
      // Do this FIRST before inserting new ones to avoid duplicates
      if (toReactivate.length > 0) {
        const subredditsToReactivate = new Set(toReactivate); // Already normalized
        const idsToReactivate = inactiveAlerts
          .filter((a) => subredditsToReactivate.has(normalizeSubreddit(a.subreddit)))
          .map((a) => a.id);

        if (idsToReactivate.length > 0) {
          const { error } = await supabase
            .from("alerts")
            .update({ is_active: true })
            .in("id", idsToReactivate);

          if (error) {
            alertsError = error;
          }
        }
      }

      // Insert new alerts (only truly new ones that don't exist at all)
      if (!alertsError && toInsert.length > 0) {
        const insertPayload = toInsert.map((subreddit) => ({
          user_id: userId,
          subreddit,
          is_active: true,
        }));

        const { error } = await supabase
          .from("alerts")
          .insert(insertPayload);

        if (error) {
          alertsError = error;
        }
      }

      // Mark removed alerts as inactive instead of deleting (to preserve data and avoid foreign key constraint issues)
      // This ensures data integrity and allows users to reactivate subreddits later if needed
      if (!alertsError && toRemove.length > 0) {
        const idsToRemove = toRemove.map((a) => a.id);

        logger.info("DEACTIVATING_ALERTS", "Setting alerts to inactive", {
          userId,
          idsToRemove,
          subreddits: toRemove.map(a => a.subreddit),
        });

        // Always set is_active = false instead of deleting (alerts with leads can't be deleted due to foreign key constraint)
        // This also preserves historical data for better tracking
        const { error: deactivateError } = await supabase
          .from("alerts")
          .update({ is_active: false })
          .in("id", idsToRemove);

        if (deactivateError) {
          logger.error("DEACTIVATE_ALERTS_ERROR", "Failed to deactivate alerts", {
            userId,
            error: deactivateError.message,
            code: deactivateError.code,
            idsToRemove,
          });
          alertsError = deactivateError;
        } else {
          logger.info("DEACTIVATE_ALERTS_SUCCESS", "Successfully deactivated alerts", {
            userId,
            count: idsToRemove.length,
            idsToRemove,
          });
        }
      } else if (toRemove.length === 0) {
        logger.info("NO_ALERTS_TO_REMOVE", "No alerts need to be deactivated", {
          userId,
          cleanedSubreddits,
          activeAlertsCount: activeAlerts.length,
        });
      }

      if (alertsError) {
        logger.error("SETTINGS_UPDATE_ERROR", "Failed to update alerts", {
          message: alertsError.message,
          code: (alertsError as any).code,
        });
        return createErrorResponse("DB_UPDATE_FAILED", {
          dbError: alertsError.message,
          code: (alertsError as any).code,
        });
      }
    }


    logger.info("SETTINGS_UPDATE_SUCCESS", "All settings updated successfully", {
      descriptionLength: rawDescription.length,
      keywordCount: limitedKeywords.length,
      subredditsCount: subreddits.length,
    });

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    logger.error("SETTINGS_UPDATE_ERROR", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResponse("UNKNOWN_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Test email by calling Google Apps Script (gas-worker-3.js) with a test payload.
 * This uses the same server-side Resend integration as production.
 */
export async function testEmailViaWorker(
  notificationEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const gasWebhookUrl =
      process.env.GAS_WEBHOOK_URL ||
      "https://script.google.com/macros/s/AKfycbyQkkWQ9OODI4o-yBMfFsmqJWETyY6IVuElnEExQtWEfgfxK0jLPtRC-TqaCLgyCzfy_Q/exec";

    if (!notificationEmail) {
      return createErrorResponse("MISSING_REQUIRED_FIELD");
    }

    const testPayload = {
      test: true,
      type: "email",
      notificationEmail: notificationEmail.trim(),
    };

    logger.info("EMAIL_TEST_START", "Testing email via gas-worker", {
      notificationEmail,
    });

    const response = await fetch(gasWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      logger.error("EMAIL_TEST_ERROR", "Failed to call gas-worker", {
        status: response.status,
        statusText: response.statusText,
      });
      return createErrorResponse("NOTIFICATION_SERVICE_UNAVAILABLE", {
        status: response.status,
        statusText: response.statusText,
      });
    }

    const result = await response.json();

    if (result.success) {
      logger.info("EMAIL_TEST_SUCCESS", "Test email sent successfully", {
        notificationEmail,
      });
      return { success: true };
    } else {
      logger.error("EMAIL_TEST_ERROR", "Test email failed", {
        error: result.error || result.message,
      });
      
      // Check if it's a configuration issue (RESEND_API_KEY missing)
      if (result.error?.includes("RESEND_API_KEY") || result.error?.includes("not configured")) {
        return createErrorResponse("EMAIL_SERVICE_NOT_CONFIGURED", {
          error: result.error || result.message,
        });
      }
      
      return createErrorResponse("EMAIL_TEST_FAILED", {
        error: result.error || result.message,
      });
    }
  } catch (error) {
    logger.error("EMAIL_TEST_ERROR", "Unexpected error testing email", {
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResponse("EMAIL_TEST_FAILED", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Fetch current settings (first available row)
 */
export async function getSettings() {
  const supabase = await createClient();

  // Get real user from Supabase auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    logger.error("AUTH_ERROR", "Unauthorized access to getSettings", {
      error: authError?.message,
    });
    // Keep the original return shape for this function: { error: string }
    return { error: getUserMessage("AUTH_REQUIRED") };
  }
  
  const userId = user.id;

  try {
    // Fetch project settings and alerts (notification settings now in project_settings)
    const [settingsResult] = await Promise.all([
      supabase
        .from("project_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    // Get all user's active alerts (multiple subreddits)
    // Only return active alerts - deactivated ones are hidden
    const { data: userAlerts } = await supabase
      .from("alerts")
      .select("subreddit")
      .eq("user_id", userId)
      .eq("is_active", true);

    return {
      projectSettings: settingsResult.data || null,
      alerts: userAlerts || [], // Array of { subreddit: string }
    };
  } catch (error) {
    logger.error("SETTINGS_FETCH_ERROR", "Failed to fetch settings", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Keep the original return shape for this function: { error: string }
    return { error: getUserMessage("SETTINGS_LOAD_FAILED") };
  }
}

/**
 * Test webhook by calling Google Apps Script with test payload
 * This uses the same gas-worker-3.js code path as production notifications
 */
export async function testWebhookViaWorker(
  webhookUrl: string,
  type: "slack" | "discord"
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Google Apps Script URL from environment variable or use default
    const gasWebhookUrl = process.env.GAS_WEBHOOK_URL || 
      "https://script.google.com/macros/s/AKfycbyQkkWQ9OODI4o-yBMfFsmqJWETyY6IVuElnEExQtWEfgfxK0jLPtRC-TqaCLgyCzfy_Q/exec";
    
    if (!webhookUrl || !type) {
      return createErrorResponse("MISSING_REQUIRED_FIELD");
    }
    
    // Create test payload that gas-worker-3.js will recognize
    const testPayload = {
      test: true,
      webhookUrl: webhookUrl.trim(),
      type: type
    };
    
    logger.info("WEBHOOK_TEST_START", "Testing webhook via gas-worker", {
      type,
      webhookUrlPreview: webhookUrl.substring(0, 50) + "...",
    });
    
    const response = await fetch(gasWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });
    
    if (!response.ok) {
      logger.error("WEBHOOK_TEST_ERROR", "Failed to call gas-worker", {
        status: response.status,
        statusText: response.statusText,
      });
      return createErrorResponse("NOTIFICATION_SERVICE_UNAVAILABLE", {
        status: response.status,
        statusText: response.statusText,
      });
    }
    
    const result = await response.json();
    
    if (result.success) {
      logger.info("WEBHOOK_TEST_SUCCESS", "Test notification sent successfully", {
        type,
      });
      return { success: true };
    } else {
      logger.error("WEBHOOK_TEST_ERROR", "Test notification failed", {
        error: result.error || result.message,
      });
      // Determine which webhook failed based on type
      const errorKey = type === "slack" ? "SLACK_WEBHOOK_FAILED" : "DISCORD_WEBHOOK_FAILED";
      return createErrorResponse(errorKey, {
        error: result.error || result.message,
      });
    }
  } catch (error) {
    logger.error("WEBHOOK_TEST_ERROR", "Unexpected error testing webhook", {
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResponse("WEBHOOK_TEST_FAILED", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
