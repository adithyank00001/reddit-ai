"use server";

import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * Settings update action
 * Updates project_settings, alerts, and client_profiles (first available row)
 */
export async function updateSettings(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  // Extract form data
  const rawDescription = String(formData.get("productDescription") || "");
  const keywordsString = String(formData.get("keywords") || "");
  const subreddit = String(formData.get("subreddit") || "");
  const slackWebhookUrl = String(formData.get("slackWebhookUrl") || "");

  logger.info("SETTINGS_UPDATE_START", "Settings form received", {
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
    // Update project_settings (first available row)
    // First try to get first row, if exists update it, otherwise insert
    const { data: existingSettings } = await supabase
      .from("project_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    const settingsPayload = {
      product_description_raw: rawDescription,
      keywords: limitedKeywords,
    };

    const { error: settingsError } = existingSettings
      ? await supabase
          .from("project_settings")
          .update(settingsPayload)
          .eq("id", existingSettings.id)
      : await supabase.from("project_settings").insert(settingsPayload);

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
    const { data: existingAlert } = await supabase
      .from("alerts")
      .select("id")
      .limit(1)
      .maybeSingle();

    const alertPayload = {
      subreddit: subreddit.trim(),
    };

    const { error: alertsError } = existingAlert
      ? await supabase
          .from("alerts")
          .update(alertPayload)
          .eq("id", existingAlert.id)
      : await supabase.from("alerts").insert(alertPayload);

    if (alertsError) {
      logger.error("SETTINGS_UPDATE_ERROR", "Failed to update alerts", {
        message: alertsError.message,
        code: (alertsError as any).code,
      });
      return { success: false, error: "Failed to update alert settings" };
    }

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
      subreddit,
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

  try {
    // Fetch all settings in parallel (first available row)
    const [settingsResult, alertsResult, profilesResult] = await Promise.all([
      supabase
        .from("project_settings")
        .select("*")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("alerts")
        .select("*")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("client_profiles")
        .select("*")
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      projectSettings: settingsResult.data || null,
      alert: alertsResult.data || null,
      clientProfile: profilesResult.data || null,
    };
  } catch (error) {
    logger.error("SETTINGS_FETCH_ERROR", "Failed to fetch settings", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "Failed to fetch settings" };
  }
}
