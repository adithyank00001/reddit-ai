"use server";

import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Multi-tenant settings update action
 * Updates project_settings, alerts, and client_profiles for the authenticated user
 */
export async function updateSettings(formData: FormData) {
  // Get authenticated user
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logger.error("SETTINGS_UPDATE_AUTH_ERROR", "User not authenticated", {
      error: authError?.message,
    });
    return { success: false, error: "Not authenticated" };
  }

  // Extract form data
  const rawDescription = String(formData.get("productDescription") || "");
  const keywordsString = String(formData.get("keywords") || "");
  const subreddit = String(formData.get("subreddit") || "");
  const slackWebhookUrl = String(formData.get("slackWebhookUrl") || "");

  logger.info("SETTINGS_UPDATE_START", "Settings form received", {
    userId: user.id,
    descriptionLength: rawDescription.length,
    keywordsRaw: keywordsString,
    subreddit,
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
    // Update project_settings (upsert by user_id)
    // First try to update, if no rows affected, insert
    const { data: existingSettings } = await supabase
      .from("project_settings")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const settingsPayload = {
      user_id: user.id,
      product_description_raw: rawDescription,
      keywords: limitedKeywords,
    };

    const { error: settingsError } = existingSettings
      ? await supabase
          .from("project_settings")
          .update(settingsPayload)
          .eq("user_id", user.id)
      : await supabase.from("project_settings").insert(settingsPayload);

    if (settingsError) {
      logger.error(
        "SETTINGS_UPDATE_ERROR",
        "Failed to update project_settings",
        {
          userId: user.id,
          message: settingsError.message,
          code: (settingsError as any).code,
        }
      );
      return { success: false, error: "Failed to update project settings" };
    }

    // Update alerts (upsert by user_id - assuming one alert per user)
    // First try to update, if no rows affected, insert
    const { data: existingAlert } = await supabase
      .from("alerts")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const alertPayload = {
      user_id: user.id,
      subreddit: subreddit.trim(),
    };

    const { error: alertsError } = existingAlert
      ? await supabase
          .from("alerts")
          .update(alertPayload)
          .eq("user_id", user.id)
      : await supabase.from("alerts").insert(alertPayload);

    if (alertsError) {
      logger.error("SETTINGS_UPDATE_ERROR", "Failed to update alerts", {
        userId: user.id,
        message: alertsError.message,
        code: (alertsError as any).code,
      });
      return { success: false, error: "Failed to update alert settings" };
    }

    // Update client_profiles (upsert by user_id)
    // First try to update, if no rows affected, insert
    const { data: existingProfile } = await supabase
      .from("client_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const profilePayload = {
      user_id: user.id,
      slack_webhook_url: slackWebhookUrl.trim() || null,
    };

    const { error: profilesError } = existingProfile
      ? await supabase
          .from("client_profiles")
          .update(profilePayload)
          .eq("user_id", user.id)
      : await supabase.from("client_profiles").insert(profilePayload);

    if (profilesError) {
      logger.error(
        "SETTINGS_UPDATE_ERROR",
        "Failed to update client_profiles",
        {
          userId: user.id,
          message: profilesError.message,
          code: (profilesError as any).code,
        }
      );
      return { success: false, error: "Failed to update notification settings" };
    }

    logger.info("SETTINGS_UPDATE_SUCCESS", "All settings updated successfully", {
      userId: user.id,
      descriptionLength: rawDescription.length,
      keywordCount: limitedKeywords.length,
      subreddit,
    });

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    logger.error("SETTINGS_UPDATE_ERROR", "Unexpected error", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Fetch current settings for the authenticated user
 */
export async function getSettings() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated" };
  }

  try {
    // Fetch all settings in parallel
    const [settingsResult, alertsResult, profilesResult] = await Promise.all([
      supabase
        .from("project_settings")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single(),
    ]);

    return {
      projectSettings: settingsResult.data || null,
      alert: alertsResult.data || null,
      clientProfile: profilesResult.data || null,
    };
  } catch (error) {
    logger.error("SETTINGS_FETCH_ERROR", "Failed to fetch settings", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "Failed to fetch settings" };
  }
}
