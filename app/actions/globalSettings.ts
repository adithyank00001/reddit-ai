"use server";

import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { AI_MODEL_SUMMARIZER } from "@/lib/ai-config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function summarizeGlobalDescription(rawDescription: string): Promise<string> {
  const trimmed = rawDescription.trim();

  if (!trimmed) {
    return "";
  }

  const maxChars = 4000;
  const inputText =
    trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;

  // Hyper-log: GLOBAL_UPDATE_START (description part)
  logger.info("GLOBAL_UPDATE_START", "Starting global settings update", {
    descriptionLength: inputText.length,
    descriptionPreview: inputText.slice(0, 200),
  });

  try {
    const systemPrompt =
      "You are an expert growth marketer. Summarize the following product description into a concise 15–20 word context highlighting what the product is, who it is for, and what problem it solves.";

    const response = await openai.chat.completions.create({
      model: AI_MODEL_SUMMARIZER,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText },
      ],
      temperature: 0.2,
      max_tokens: 60,
    });

    const responseText =
      response.choices[0]?.message?.content?.trim() || "";

    // Hyper-log: AI_RAW_RES for global summary
    logger.info("AI_RAW_RES", "Raw global product context summary response", {
      raw: responseText,
    });

    const collapsed = responseText.replace(/\s+/g, " ").trim();
    const words = collapsed.split(" ").filter(Boolean);
    const maxWords = 20;
    const limited =
      words.length > maxWords
        ? words.slice(0, maxWords).join(" ")
        : collapsed;

    return limited;
  } catch (error: any) {
    logger.error(
      "GLOBAL_UPDATE_ERROR",
      "Global product context summarization failed",
      {
        message: error?.message ?? String(error),
        stack: error?.stack,
      }
    );

    // Fallback: truncated input
    return inputText.slice(0, 200);
  }
}

export async function updateGlobalSettings(formData: FormData) {
  const rawDescription = String(formData.get("rawDescription") || "");
  const keywordsString = String(formData.get("keywordsString") || "");

  // Hyper-log: GLOBAL_UPDATE_START (keywords part)
  logger.info("GLOBAL_UPDATE_START", "Global settings form received", {
    keywordsRaw: keywordsString,
  });

  const summary = await summarizeGlobalDescription(rawDescription);

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

  // Hyper-log: GLOBAL_UPDATE intent
  logger.info("GLOBAL_UPDATE", "Upserting global settings", {
    summaryPreview: summary.slice(0, 120),
    keywordCount: limitedKeywords.length,
    keywordsPreview: limitedKeywords.slice(0, 10),
  });

  const { error } = await supabase
    .from("project_settings")
    .upsert(
      {
        id: 1,
        product_description_raw: rawDescription,
        product_context: summary,
        keywords: limitedKeywords,
      },
      { onConflict: "id" }
    );

  if (error) {
    logger.error(
      "GLOBAL_UPDATE_ERROR",
      "Failed to upsert global project settings",
      {
        message: error.message,
        code: (error as any).code,
      }
    );
    return;
  }

  // Hyper-log: GLOBAL_UPDATE_SUCCESS
  logger.info("GLOBAL_UPDATE_SUCCESS", "Global settings updated successfully", {
    productContext: summary,
    keywordCount: limitedKeywords.length,
    keywords: limitedKeywords,
  });

  revalidatePath("/dashboard");
}

