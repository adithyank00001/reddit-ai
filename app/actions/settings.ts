"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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
    return { success: false, error: "Unauthorized. Please log in." };
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

  const rawDescription = hasProductDescription ? String(formData.get("productDescription") || "") : "";
  const keywordsString = hasKeywords ? String(formData.get("keywords") || "") : "";
  const subredditsJson = hasSubreddits ? String(formData.get("subreddits") || "[]") : "[]";
  const slackWebhookUrl = hasSlackWebhook ? String(formData.get("slackWebhookUrl") || "") : "";
  
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

  // Parse subreddits array
  let subreddits: string[] = [];
  try {
    subreddits = JSON.parse(subredditsJson);
    if (!Array.isArray(subreddits)) subreddits = [];
  } catch (error) {
    subreddits = [];
  }

  logger.info("SETTINGS_UPDATE_START", "Settings form received", {
    userId,
    descriptionLength: rawDescription.length,
    keywordsRaw: keywordsString,
    subredditsCount: subreddits.length,
    hasWebhook: !!slackWebhookUrl,
  });

  // Clean keywords
  const cleanedKeywords = keywordsString
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);

  const maxKeywords = 20;
  const limitedKeywords =
    cleanedKeywords.length > maxKeywords
      ? cleanedKeywords.slice(0, maxKeywords)
      : cleanedKeywords;

  try {
    // Update project_settings only if keywords or productDescription are provided
    if (hasKeywords || hasProductDescription) {
      const settingsPayload = {
        user_id: userId,
        product_description_raw: rawDescription,
        keywords: limitedKeywords,
      };
      
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
        return { success: false, error: "Failed to update project settings" };
      }
    }

    // Update alerts for this user only if subreddits are provided
    // Sync alerts table with submitted subreddits:
    // - New subreddit in list  -> INSERT
    // - Subreddit removed      -> DELETE
    // - Existing               -> Do nothing
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

      // Fetch existing alerts for this user
      const { data: existingAlerts = [] } = await supabase
        .from("alerts")
        .select("id, subreddit")
        .eq("user_id", userId);

      const existingSet = new Set(
        existingAlerts.map((a) => a.subreddit.toLowerCase())
      );
      const desiredSet = new Set(cleanedSubreddits);

      const toInsert = cleanedSubreddits.filter(
        (s) => !existingSet.has(s.toLowerCase())
      );
      const toDelete = existingAlerts.filter(
        (a) => !desiredSet.has(a.subreddit.toLowerCase())
      );

      let alertsError: any = null;

      // Insert new alerts (if any)
      if (toInsert.length > 0) {
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

      // Delete removed alerts (if any)
      if (!alertsError && toDelete.length > 0) {
        const idsToDelete = toDelete.map((a) => a.id);

        const { error } = await supabase
          .from("alerts")
          .delete()
          .in("id", idsToDelete);

        if (error) {
          alertsError = error;
        }
      }

      if (alertsError) {
        logger.error("SETTINGS_UPDATE_ERROR", "Failed to update alerts", {
          message: alertsError.message,
          code: (alertsError as any).code,
        });
        return { success: false, error: "Failed to update alert settings" };
      }
    }

    // Update client_profiles only if slackWebhookUrl is provided
    if (hasSlackWebhook) {
      // First try to get user's profile, if exists update it, otherwise insert
      const { data: existingProfile } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const profilePayload = {
        user_id: userId,
        slack_webhook_url: slackWebhookUrl.trim() || null,
      };

      const { error: profilesError } = existingProfile
        ? await supabase
            .from("client_profiles")
            .update(profilePayload)
            .eq("id", existingProfile.id)
        : await supabase.from("client_profiles").insert(profilePayload);

      if (profilesError) {
        logger.error(
          "SETTINGS_UPDATE_ERROR",
          "Failed to update client_profiles",
          {
            message: profilesError.message,
            code: (profilesError as any).code,
          }
        );
        return { success: false, error: "Failed to update notification settings" };
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
    return { success: false, error: "An unexpected error occurred" };
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
    return { error: "Unauthorized. Please log in." };
  }
  
  const userId = user.id;

  try {
    // Fetch all settings in parallel (filtered by mock user ID)
    const [settingsResult, profilesResult] = await Promise.all([
      supabase
        .from("project_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    // Get all user's alerts (multiple subreddits)
    const { data: userAlerts } = await supabase
      .from("alerts")
      .select("subreddit")
      .eq("user_id", userId);

    return {
      projectSettings: settingsResult.data || null,
      alerts: userAlerts || [], // Array of { subreddit: string }
      clientProfile: profilesResult.data || null,
    };
  } catch (error) {
    logger.error("SETTINGS_FETCH_ERROR", "Failed to fetch settings", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "Failed to fetch settings" };
  }
}
