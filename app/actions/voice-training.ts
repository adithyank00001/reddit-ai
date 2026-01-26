"use server";

import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { AI_USE_CASES } from "@/lib/ai-config";
import { revalidatePath } from "next/cache";

/**
 * Generates a simulated Reddit post for voice training
 * Fetches user's product description and keywords, then generates a realistic Reddit post
 * Does NOT save to database - only returns the generated post
 */
export async function generateSimulatedPost(): Promise<{
  success: boolean;
  post?: { title: string; body: string; subreddit?: string };
  error?: string;
}> {
  try {
    // Get authenticated user
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to generateSimulatedPost", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    // Fetch user's product description and keywords from project_settings
    const supabase = supabaseServiceRole;
    const { data: settings, error: settingsError } = await supabase
      .from("project_settings")
      .select("product_description_raw, keywords")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsError) {
      logger.error(
        "VOICE_TRAINING_ERROR",
        "Failed to fetch project settings",
        {
          message: settingsError.message,
        }
      );
      return {
        success: false,
        error: "Failed to fetch your project settings. Please complete onboarding first.",
      };
    }

    if (!settings) {
      return {
        success: false,
        error: "Please complete onboarding steps 1-3 first.",
      };
    }

    const productDescription = settings.product_description_raw || "";
    const keywords = settings.keywords || [];

    if (!productDescription && keywords.length === 0) {
      return {
        success: false,
        error: "Please complete onboarding steps 1-2 first.",
      };
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "OpenAI API key not configured. Please contact support.",
      };
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Build context for post generation
    const contextParts: string[] = [];
    if (productDescription) {
      contextParts.push(`Product: ${productDescription}`);
    }
    if (keywords.length > 0) {
      contextParts.push(`Keywords: ${keywords.join(", ")}`);
    }
    const context = contextParts.join("\n");

    // Generate Reddit post using AI
    const systemPrompt = `You are a Reddit user. Generate a SHORT and SIMPLE Reddit post that would be relevant to someone looking for a solution related to the product/context provided. The post should:
- Be very concise (title: 1 sentence, body: 1-2 short sentences max)
- Express a direct question or need that the product could address
- Sound natural and authentic like a real Reddit post
- Be formatted as JSON with "title", "body", and "subreddit" fields
- Include a relevant subreddit name (e.g., "webdev", "startups", "SaaS", "entrepreneur")

Keep it SHORT and SIMPLE. The body should be a brief question, not a long explanation.

Return ONLY valid JSON in this format:
{"title": "Short question title", "body": "Brief question or need statement", "subreddit": "webdev"}`;

    const userPrompt = `Generate a short, simple Reddit post relevant to:\n${context}\n\nKeep it brief - just a quick question or need.`;

    const completion = await openai.chat.completions.create({
      model: AI_USE_CASES.SIMULATED_REDDIT_POST_GENERATOR.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: AI_USE_CASES.SIMULATED_REDDIT_POST_GENERATOR.maxTokens,
      temperature: AI_USE_CASES.SIMULATED_REDDIT_POST_GENERATOR.temperature,
      response_format: { type: "json_object" },
    });

    const responseText =
      completion.choices[0]?.message?.content?.trim() || "";

    if (!responseText) {
      return {
        success: false,
        error: "Failed to generate post. Please try again.",
      };
    }

    // Parse JSON response
    let postData: { title: string; body: string; subreddit?: string };
    try {
      postData = JSON.parse(responseText);
      if (!postData.title || !postData.body) {
        throw new Error("Invalid post format");
      }
    } catch (parseError) {
      logger.error("VOICE_TRAINING_ERROR", "Failed to parse AI response", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText.substring(0, 200),
      });
      return {
        success: false,
        error: "Failed to parse generated post. Please try again.",
      };
    }

    return {
      success: true,
      post: {
        title: postData.title,
        body: postData.body,
        subreddit: postData.subreddit || "webdev", // Default subreddit if not provided
      },
    };
  } catch (error) {
    logger.error("VOICE_TRAINING_ERROR", "Unexpected error generating post", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Saves a voice training example to the user's project_settings
 * Appends replyText to the voice_examples JSONB array
 */
export async function saveVoiceExample(
  replyText: string
): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    // Get authenticated user
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to saveVoiceExample", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    // Validate reply text
    const trimmedReply = replyText.trim();
    if (!trimmedReply || trimmedReply.length < 5) {
      return {
        success: false,
        error: "Reply text must be at least 5 characters.",
      };
    }

    const supabase = supabaseServiceRole;

    // Fetch current voice_examples
    const { data: settings, error: fetchError } = await supabase
      .from("project_settings")
      .select("voice_examples")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      logger.error(
        "VOICE_TRAINING_ERROR",
        "Failed to fetch project settings",
        {
          message: fetchError.message,
        }
      );
      return {
        success: false,
        error: "Failed to fetch settings. Please try again.",
      };
    }

    // Get existing examples or default to empty array
    const existingExamples: string[] = Array.isArray(settings?.voice_examples)
      ? settings.voice_examples
      : [];

    // Append new example
    const updatedExamples = [...existingExamples, trimmedReply];

    // Update database
    // Don't set reply_mode to "voice" yet - wait until user explicitly completes step 4
    // This prevents automatic redirect to dashboard when 3rd example is saved
    const { error: updateError } = await supabase
      .from("project_settings")
      .upsert(
        {
          user_id: userId,
          voice_examples: updatedExamples,
          // Keep reply_mode as null until user clicks "Complete" button
          // reply_mode will be set to "voice" when user completes step 4
        },
        { onConflict: "user_id" }
      );

    if (updateError) {
      logger.error(
        "VOICE_TRAINING_ERROR",
        "Failed to save voice example",
        {
          message: updateError.message,
        }
      );
      return {
        success: false,
        error: "Failed to save example. Please try again.",
      };
    }

    logger.info("VOICE_TRAINING_SUCCESS", "Voice example saved", {
      userId,
      exampleCount: updatedExamples.length,
    });

    revalidatePath("/onboarding/step-4");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      count: updatedExamples.length,
    };
  } catch (error) {
    logger.error("VOICE_TRAINING_ERROR", "Unexpected error saving example", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Updates the reply mode and optionally custom instructions
 */
export async function updateReplyMode(
  mode: "custom" | "voice",
  instructions?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get authenticated user
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.error("AUTH_ERROR", "Unauthorized access to updateReplyMode", {
        error: authError?.message,
      });
      return { success: false, error: "Unauthorized. Please log in." };
    }

    const userId = user.id;

    // Validate mode
    if (mode !== "custom" && mode !== "voice") {
      return {
        success: false,
        error: "Invalid reply mode. Must be 'custom' or 'voice'.",
      };
    }

    const supabase = supabaseServiceRole;

    // Build update payload
    const updatePayload: {
      user_id: string;
      reply_mode: string;
      custom_instructions?: string | null;
      onboarding_completed: boolean;
    } = {
      user_id: userId,
      reply_mode: mode,
      onboarding_completed: true, // Mark onboarding as complete when user saves reply mode
    };

    // Only update custom_instructions if provided or if switching to custom mode
    if (mode === "custom") {
      updatePayload.custom_instructions = instructions?.trim() || null;
    }

    // Update database
    const { error: updateError } = await supabase
      .from("project_settings")
      .upsert(updatePayload, { onConflict: "user_id" });

    if (updateError) {
      logger.error(
        "VOICE_TRAINING_ERROR",
        "Failed to update reply mode",
        {
          message: updateError.message,
        }
      );
      return {
        success: false,
        error: "Failed to update settings. Please try again.",
      };
    }

    logger.info("VOICE_TRAINING_SUCCESS", "Reply mode updated", {
      userId,
      mode,
    });

    revalidatePath("/onboarding/step-4");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
    };
  } catch (error) {
    logger.error("VOICE_TRAINING_ERROR", "Unexpected error updating mode", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
    };
  }
}
