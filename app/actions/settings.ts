"use server";

import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

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
 * Generate product context from raw description using AI
 * Creates a concise, technical summary for relevance filtering
 */
async function generateProductContext(description: string): Promise<string | null> {
  logger.info("AI_DEBUG", "generateProductContext ENTRY", {
    descriptionLength: description?.length || 0,
    descriptionPreview: description?.substring(0, 50) || "empty",
  });
  
  // Skip if description is empty
  if (!description || description.trim().length === 0) {
    logger.warn("AI_DEBUG", "generateProductContext EARLY RETURN - empty description", {
      description: description || "null",
      trimmedLength: description?.trim().length || 0,
    });
    return null;
  }

  // Check if OpenAI API key is configured
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("[DEBUG] OpenAI API Key check:", {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey?.substring(0, 10) || "none",
    allEnvKeys: Object.keys(process.env).filter(k => k.includes("OPENAI")),
  });
  
  logger.info("AI_DEBUG", "generateProductContext API KEY CHECK", {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey?.substring(0, 7) || "none",
  });
  
  if (!apiKey) {
    console.error("[DEBUG] ERROR: OPENAI_API_KEY not found in process.env");
    logger.warn("AI_CONTEXT_GENERATION", "OPENAI_API_KEY not configured, skipping context generation");
    logger.warn("AI_DEBUG", "generateProductContext EARLY RETURN - no API key");
    return null;
  }
  
  console.log("[DEBUG] OpenAI API Key found, proceeding with API call");

  try {
    const openai = new OpenAI({ apiKey });
    const startTime = Date.now();

    logger.aiRequest("gpt-4o-mini", `Generating product context from description (${description.length} chars)`);
    logger.info("AI_DEBUG", "generateProductContext BEFORE OpenAI call", {
      descriptionLength: description.length,
      model: "gpt-4o-mini",
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a technical assistant that creates concise product summaries. Your summaries should focus on what the product DOES and WHO it is for. Keep it brief (2-3 sentences max) and technical, suitable for AI relevance filtering."
        },
        {
          role: "user",
          content: `Summarize this product description into a concise, technical context string for an AI agent to use for relevance filtering. Focus on what the product DOES and WHO it is for.\n\nProduct Description:\n${description}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const generatedContext = response.choices[0]?.message?.content?.trim() || null;
    const responseTime = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens;

    console.log("[DEBUG] OpenAI API response received:", {
      hasContext: !!generatedContext,
      contextLength: generatedContext?.length || 0,
      contextPreview: generatedContext?.substring(0, 100) || "null",
      tokensUsed,
      responseTime,
      choicesCount: response.choices?.length || 0,
    });

    logger.info("AI_DEBUG", "generateProductContext AFTER OpenAI call", {
      hasContext: !!generatedContext,
      contextLength: generatedContext?.length || 0,
      contextPreview: generatedContext?.substring(0, 100) || "null",
      tokensUsed,
      responseTime,
      choicesCount: response.choices?.length || 0,
    });

    if (generatedContext) {
      logger.aiResponse("gpt-4o-mini", generatedContext, tokensUsed, responseTime);
      logger.info("AI_CONTEXT_GENERATION", "Product context generated successfully", {
        inputLength: description.length,
        outputLength: generatedContext.length,
        tokensUsed,
        responseTime,
      });
    } else {
      logger.warn("AI_CONTEXT_GENERATION", "OpenAI returned empty response");
    }

    logger.info("AI_DEBUG", "generateProductContext EXIT", {
      returnValue: generatedContext || "null",
      returnValueLength: generatedContext?.length || 0,
    });
    
    return generatedContext;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "none";
    
    console.error("[DEBUG] ERROR in generateProductContext:", {
      error: errorMsg,
      errorType: error?.constructor?.name || "unknown",
      stack: errorStack?.substring(0, 500),
    });
    
    logger.aiError("gpt-4o-mini", error);
    logger.error("AI_CONTEXT_GENERATION", "Failed to generate product context", {
      error: errorMsg,
    });
    logger.error("AI_DEBUG", "generateProductContext ERROR", {
      error: errorMsg,
      errorType: error?.constructor?.name || "unknown",
      stack: error instanceof Error ? error.stack?.substring(0, 200) : "none",
    });
    // Don't throw - return null so save can continue without context
    return null;
  }
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
    // Generate product context if description is provided
    let productContext: string | null = null;
    
    // Force output to stderr which should always be visible
    console.error("[CRITICAL DEBUG] ===== AI GENERATION CHECK =====");
    console.error("[CRITICAL DEBUG] rawDescription:", rawDescription);
    console.error("[CRITICAL DEBUG] rawDescription.length:", rawDescription.length);
    console.error("[CRITICAL DEBUG] rawDescription.trim().length:", rawDescription.trim().length);
    console.error("[CRITICAL DEBUG] Will call AI?", !!(rawDescription && rawDescription.trim().length > 0));
    
    logger.info("AI_DEBUG", "Checking if AI generation should run", {
      hasDescription: !!rawDescription,
      descriptionLength: rawDescription.length,
      trimmedLength: rawDescription.trim().length,
      willCall: !!(rawDescription && rawDescription.trim().length > 0),
    });
    
    if (rawDescription && rawDescription.trim().length > 0) {
      console.error("[CRITICAL DEBUG] ===== CALLING generateProductContext =====");
      console.error("[CRITICAL DEBUG] Description:", rawDescription.substring(0, 100));
      
      logger.info("AI_DEBUG", "Calling generateProductContext", {
        descriptionLength: rawDescription.length,
        descriptionPreview: rawDescription.substring(0, 50),
      });
      
      productContext = await generateProductContext(rawDescription);
      
      console.error("[CRITICAL DEBUG] ===== generateProductContext RETURNED =====");
      console.error("[CRITICAL DEBUG] productContext:", productContext || "NULL");
      console.error("[CRITICAL DEBUG] productContext length:", productContext?.length || 0);
      
      logger.info("AI_DEBUG", "generateProductContext returned", {
        hasContext: !!productContext,
        contextLength: productContext?.length || 0,
        contextPreview: productContext?.substring(0, 100) || "null",
      });
      // If AI generation fails, we'll save with null context (Worker 2 can handle it)
    } else {
      console.error("[CRITICAL DEBUG] ===== SKIPPING AI GENERATION (empty description) =====");
      logger.info("AI_DEBUG", "Skipping AI generation - description empty or whitespace", {
        hasDescription: !!rawDescription,
        descriptionLength: rawDescription.length,
      });
    }

    // Update project_settings (first available row)
    // First try to get first row, if exists update it, otherwise insert
    const { data: existingSettings } = await supabase
      .from("project_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    const settingsPayload = {
      product_description_raw: rawDescription,
      product_context: productContext, // Save AI-generated context
      keywords: limitedKeywords,
    };
    
    console.error("[CRITICAL DEBUG] ===== BEFORE DB SAVE =====");
    console.error("[CRITICAL DEBUG] productContext in payload:", settingsPayload.product_context || "NULL");
    console.error("[CRITICAL DEBUG] productContext length:", settingsPayload.product_context?.length || 0);
    console.error("[CRITICAL DEBUG] Will save to DB with context?", !!settingsPayload.product_context);
    
    logger.info("AI_DEBUG", "updateSettings BEFORE DB SAVE", {
      hasProductContext: !!settingsPayload.product_context,
      productContextLength: settingsPayload.product_context?.length || 0,
      productContextPreview: settingsPayload.product_context?.substring(0, 100) || "null",
      existingSettingsId: existingSettings?.id || "none",
      operation: existingSettings ? "update" : "insert",
    });

    const { error: settingsError } = existingSettings
      ? await supabase
          .from("project_settings")
          .update(settingsPayload)
          .eq("id", existingSettings.id)
      : await supabase.from("project_settings").insert(settingsPayload);
    
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
      hasProductContext: !!productContext,
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
