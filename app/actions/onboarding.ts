"use server";

import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Saves onboarding step 1 data (website URL and product description) to database
 */
export async function saveOnboardingStep1(
  websiteUrl: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use service role client to bypass RLS for server-side operations
    const supabase = supabaseServiceRole;

    // Get real user from Supabase auth
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to saveOnboardingStep1", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    // Validate inputs
    const trimmedUrl = websiteUrl.trim();
    const trimmedDescription = description.trim();

    if (!trimmedUrl) {
      return { success: false, error: "Website URL is required" };
    }

    if (!trimmedDescription || trimmedDescription.length < 10) {
      return {
        success: false,
        error: "Product description must be at least 10 characters",
      };
    }

    logger.info("ONBOARDING_STEP1_SAVE", "Saving onboarding step 1", {
      userId,
      urlLength: trimmedUrl.length,
      descriptionLength: trimmedDescription.length,
    });

    // Upsert to project_settings table
    const { error: settingsError } = await supabase
      .from("project_settings")
      .upsert(
        {
          user_id: userId,
          website_url: trimmedUrl,
          product_description_raw: trimmedDescription,
        },
        { onConflict: "user_id" }
      );

    if (settingsError) {
      logger.error(
        "ONBOARDING_STEP1_ERROR",
        "Failed to save onboarding step 1",
        {
          message: settingsError.message,
          code: (settingsError as any).code,
        }
      );
      return {
        success: false,
        error: "Failed to save onboarding data. Please try again.",
      };
    }

    logger.info("ONBOARDING_STEP1_SUCCESS", "Onboarding step 1 saved successfully", {
      userId,
    });

    revalidatePath("/onboarding");
    return { success: true };
  } catch (error) {
    logger.error("ONBOARDING_STEP1_ERROR", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Saves onboarding step 2 data (keywords) to database
 */
export async function saveOnboardingStep2(
  keywords: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use service role client to bypass RLS for server-side operations
    const supabase = supabaseServiceRole;

    // Get real user from Supabase auth
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to saveOnboardingStep2", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    // Validate keywords array
    if (!Array.isArray(keywords)) {
      return { success: false, error: "Keywords must be an array" };
    }

    // Clean and validate keywords
    const cleanedKeywords = keywords
      .map((k) => String(k).trim())
      .filter((k) => k.length >= 2);

    if (cleanedKeywords.length === 0) {
      return { success: false, error: "At least one keyword is required" };
    }

    if (cleanedKeywords.length > 10) {
      return {
        success: false,
        error: "Maximum 10 keywords allowed for onboarding",
      };
    }

    logger.info("ONBOARDING_STEP2_SAVE", "Saving onboarding step 2", {
      userId,
      keywordCount: cleanedKeywords.length,
      keywords: cleanedKeywords,
    });

    // Upsert to project_settings table
    const { error: settingsError } = await supabase
      .from("project_settings")
      .upsert(
        {
          user_id: userId,
          keywords: cleanedKeywords,
        },
        { onConflict: "user_id" }
      );

    if (settingsError) {
      logger.error(
        "ONBOARDING_STEP2_ERROR",
        "Failed to save onboarding step 2",
        {
          message: settingsError.message,
          code: (settingsError as any).code,
        }
      );
      return {
        success: false,
        error: "Failed to save keywords. Please try again.",
      };
    }

    logger.info("ONBOARDING_STEP2_SUCCESS", "Onboarding step 2 saved successfully", {
      userId,
      keywordCount: cleanedKeywords.length,
    });

    revalidatePath("/onboarding");
    return { success: true };
  } catch (error) {
    logger.error("ONBOARDING_STEP2_ERROR", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Saves complete onboarding data (all steps) to database
 * This is called when onboarding is fully complete
 */
export async function saveCompleteOnboarding(
  websiteUrl: string,
  description: string,
  keywords: string[],
  subreddits: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use service role client to bypass RLS for server-side operations
    const supabase = supabaseServiceRole;

    // Get real user from Supabase auth
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to saveCompleteOnboarding", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    // Validate inputs
    const trimmedUrl = websiteUrl.trim();
    const trimmedDescription = description.trim();

    if (!trimmedUrl) {
      return { success: false, error: "Website URL is required" };
    }

    if (!trimmedDescription || trimmedDescription.length < 10) {
      return {
        success: false,
        error: "Product description must be at least 10 characters",
      };
    }

    // Validate keywords array
    if (!Array.isArray(keywords)) {
      return { success: false, error: "Keywords must be an array" };
    }

    // Clean and validate keywords
    const cleanedKeywords = keywords
      .map((k) => String(k).trim())
      .filter((k) => k.length >= 2);

    if (cleanedKeywords.length === 0) {
      return { success: false, error: "At least one keyword is required" };
    }

    if (cleanedKeywords.length > 10) {
      return {
        success: false,
        error: "Maximum 10 keywords allowed for onboarding",
      };
    }

    // Validate subreddits array
    if (!Array.isArray(subreddits)) {
      return { success: false, error: "Subreddits must be an array" };
    }

    // Normalize and deduplicate subreddits
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

    if (cleanedSubreddits.length === 0) {
      return { success: false, error: "At least one subreddit is required" };
    }

    logger.info("ONBOARDING_COMPLETE_SAVE", "Saving complete onboarding data", {
      userId,
      urlLength: trimmedUrl.length,
      descriptionLength: trimmedDescription.length,
      keywordCount: cleanedKeywords.length,
      subredditCount: cleanedSubreddits.length,
    });

    // Upsert all data to project_settings table
    // Clear reply_mode to null when completing step 3, so step 4 can be shown
    // This ensures users who previously skipped step 4 can see it again
    const { error: settingsError } = await supabase
      .from("project_settings")
      .upsert(
        {
          user_id: userId,
          website_url: trimmedUrl,
          product_description_raw: trimmedDescription,
          keywords: cleanedKeywords,
          reply_mode: null, // Clear to allow step 4 to be shown (null = not visited)
        },
        { onConflict: "user_id" }
      );

    if (settingsError) {
      logger.error(
        "ONBOARDING_COMPLETE_ERROR",
        "Failed to save complete onboarding data",
        {
          message: settingsError.message,
          code: (settingsError as any).code,
        }
      );
      return {
        success: false,
        error: "Failed to save onboarding data. Please try again.",
      };
    }

    // Save subreddits to alerts table (same sync logic as in settings.ts)
    // Fetch existing active alerts for this user
    const { data: existingAlerts = [] } = await supabase
      .from("alerts")
      .select("id, subreddit")
      .eq("user_id", userId)
      .eq("is_active", true);

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

    // Mark removed alerts as inactive instead of deleting (to avoid foreign key constraint with leads table)
    if (!alertsError && toDelete.length > 0) {
      const idsToDeactivate = toDelete.map((a) => a.id);

      // Mark as inactive instead of deleting (alerts with leads can't be deleted due to foreign key constraint)
      const { error } = await supabase
        .from("alerts")
        .update({ is_active: false })
        .in("id", idsToDeactivate);

      if (error) {
        alertsError = error;
      }
    }

    if (alertsError) {
      logger.error("ONBOARDING_COMPLETE_ERROR", "Failed to save alerts", {
        message: alertsError.message,
        code: (alertsError as any).code,
      });
      return {
        success: false,
        error: "Failed to save subreddit settings. Please try again.",
      };
    }

    logger.info("ONBOARDING_COMPLETE_SUCCESS", "Complete onboarding data saved successfully", {
      userId,
      keywordCount: cleanedKeywords.length,
      subredditCount: cleanedSubreddits.length,
    });

    // Revalidate paths to ensure fresh data on next navigation
    revalidatePath("/onboarding");
    revalidatePath("/onboarding/step-3");
    revalidatePath("/onboarding/step-4");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    logger.error("ONBOARDING_COMPLETE_ERROR", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Marks step 4 (Reply Intelligence) as skipped by setting reply_mode to 'skipped'
 * This uses the existing reply_mode column to track that step 4 has been handled
 * Note: Does NOT mark onboarding as complete since step 5 still remains
 */
export async function markStep4Skipped(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Use service role client to bypass RLS for server-side operations
    const supabase = supabaseServiceRole;

    // Get real user from Supabase auth
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to markStep4Skipped", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    logger.info("ONBOARDING_STEP4_SKIP", "Marking step 4 as skipped", {
      userId,
    });

    // Set reply_mode to "skipped" to indicate step 4 was explicitly skipped
    // Do NOT set onboarding_completed yet as step 5 still remains
    const { error: updateError } = await supabase
      .from("project_settings")
      .upsert(
        {
          user_id: userId,
          reply_mode: "skipped", // Explicit skip value
          custom_instructions: null,
          voice_examples: [],
        },
        { onConflict: "user_id" }
      );

    if (updateError) {
      logger.error(
        "ONBOARDING_STEP4_SKIP_ERROR",
        "Failed to mark step 4 as skipped",
        {
          message: updateError.message,
          code: (updateError as any).code,
        }
      );
      return {
        success: false,
        error: "Failed to save skip status. Please try again.",
      };
    }

    logger.info("ONBOARDING_STEP4_SKIP_SUCCESS", "Step 4 marked as skipped successfully", {
      userId,
    });

    revalidatePath("/onboarding/step-4");
    revalidatePath("/onboarding/step-5");
    return { success: true };
  } catch (error) {
    logger.error("ONBOARDING_STEP4_SKIP_ERROR", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Marks step 5 (Notification Settings) as skipped
 * This marks onboarding as complete since step 5 is the final step
 */
export async function markStep5Skipped(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Use service role client to bypass RLS for server-side operations
    const supabase = supabaseServiceRole;

    // Get real user from Supabase auth
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to markStep5Skipped", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    logger.info("ONBOARDING_STEP5_SKIP", "Marking step 5 as skipped", {
      userId,
    });

    // Mark onboarding as completed since step 5 is the final step
    const { error: updateError } = await supabase
      .from("project_settings")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);

    if (updateError) {
      logger.error(
        "ONBOARDING_STEP5_SKIP_ERROR",
        "Failed to mark step 5 as skipped",
        {
          message: updateError.message,
          code: (updateError as any).code,
        }
      );
      return {
        success: false,
        error: "Failed to save skip status. Please try again.",
      };
    }

    logger.info("ONBOARDING_STEP5_SKIP_SUCCESS", "Step 5 marked as skipped successfully", {
      userId,
    });

    revalidatePath("/onboarding/step-5");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    logger.error("ONBOARDING_STEP5_SKIP_ERROR", "Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
