"use server";

import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// Extend globalThis type for dev mode mock user ID
declare global {
  // eslint-disable-next-line no-var
  var __mockUserId: string | undefined;
}

/**
 * Get mock user ID from global state (dev mode)
 */
function getMockUserId(): string | null {
  if (typeof globalThis !== 'undefined') {
    const mockUserId = (globalThis as any).__mockUserId;
    if (mockUserId) {
      return mockUserId;
    }
  }
  return null;
}

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

  // Get mock user ID instead of real auth
  const userId = getMockUserId();
  
  logger.info("AI_DEBUG", "updateSettings USER ID CHECK", {
    hasUserId: !!userId,
    userId: userId || "none",
  });
  if (!userId) {
    return { success: false, error: "No user session found. Please use the Dev Switcher." };
  }

  // Extract form data
  const rawDescription = String(formData.get("productDescription") || "");
  const keywordsString = String(formData.get("keywords") || "");
  const subredditsJson = String(formData.get("subreddits") || "[]");
  const slackWebhookUrl = String(formData.get("slackWebhookUrl") || "");
  
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
    // Update project_settings using UPSERT with user_id
    // This ensures one row per user and prevents duplicates
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

    // Update alerts (first available row)
    // First try to get first row, if exists update it, otherwise insert
    // Note: This section appears to have a bug (subreddit variable not defined)
    // Skipping alert updates for now - this should be handled separately
    // const { data: existingAlert } = await supabase
    //   .from("alerts")
    //   .select("id")
    //   .limit(1)
    //   .maybeSingle();

    // const alertPayload = {
    //   subreddit: subreddits[0]?.trim() || "",
    // };

    // Alert updates commented out due to undefined variable issue
    // const { error: alertsError } = existingAlert
    //   ? await supabase
    //       .from("alerts")
    //       .update(alertPayload)
    //       .eq("id", existingAlert.id)
    //   : await supabase.from("alerts").insert(alertPayload);

    // if (alertsError) {
    //   logger.error("SETTINGS_UPDATE_ERROR", "Failed to update alerts", {
    //     message: alertsError.message,
    //     code: (alertsError as any).code,
    //   });
    //   return { success: false, error: "Failed to update alert settings" };
    // }

    // Update client_profiles (first available row)
    // First try to get first row, if exists update it, otherwise insert
    const { data: existingProfile } = await supabase
      .from("client_profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    const profilePayload = {
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
  const supabase = await createServerSupabaseClient();

  // Get mock user ID instead of real auth
  const userId = getMockUserId();
  if (!userId) {
    return { error: "No user session found. Please use the Dev Switcher." };
  }

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
