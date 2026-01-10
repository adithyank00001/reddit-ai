"use server";

import OpenAI from "openai";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { AI_MODEL_SUMMARIZER } from "@/lib/ai-config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function summarizeProductDescription(rawDescription: string): Promise<string> {
  const trimmed = rawDescription.trim();

  // Basic validation / fallback
  if (!trimmed) {
    return "";
  }

  // Enforce a reasonable max length before sending to OpenAI
  const maxChars = 4000;
  const inputText =
    trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;

  // Hyper-log: CONTEXT_GEN_START
  logger.info(
    "CONTEXT_GEN_START",
    "Starting product context generation",
    {
      length: inputText.length,
      preview: inputText.slice(0, 200),
    }
  );

  try {
    const systemPrompt =
      "You are an expert growth marketer. Summarize the following product description into a concise 15–20 word context highlighting what the product is, who it is for, and what problem it solves.";

    const userPrompt = inputText;

    const response = await openai.chat.completions.create({
      model: AI_MODEL_SUMMARIZER,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 60,
    });

    const responseText =
      response.choices[0]?.message?.content?.trim() || "";

    // Hyper-log: AI_RAW_RES for summarization
    logger.info(
      "AI_RAW_RES",
      "Raw product context summary response",
      { raw: responseText }
    );

    // Sanitize: collapse whitespace and enforce a loose max word count
    const collapsed = responseText.replace(/\s+/g, " ").trim();
    const words = collapsed.split(" ").filter(Boolean);
    const maxWords = 20;
    const limited =
      words.length > maxWords
        ? words.slice(0, maxWords).join(" ")
        : collapsed;

    // Hyper-log: CONTEXT_GEN_SUCCESS
    logger.info(
      "CONTEXT_GEN_SUCCESS",
      "Final product context summary",
      { summary: limited }
    );

    return limited;
  } catch (error: any) {
    // Hyper-log: CONTEXT_GEN_ERROR with full stack
    logger.error(
      "CONTEXT_GEN_ERROR",
      "Product context summarization failed",
      {
        message: error?.message ?? String(error),
        stack: error?.stack,
      }
    );

    // Fallback: return a truncated version of the input
    const fallback = inputText.slice(0, 200);
    return fallback;
  }
}

export async function updateAlertProductContext(formData: FormData) {
  const alertId = String(formData.get("alertId") || "").trim();
  const rawDescription = String(formData.get("rawDescription") || "");

  if (!alertId) {
    logger.error(
      "DB_UPDATE_ERROR",
      "Missing alertId in updateAlertProductContext",
      {}
    );
    return;
  }

  const summary = await summarizeProductDescription(rawDescription);

  // Hyper-log: DB_UPDATE (intent)
  logger.info(
    "DB_UPDATE",
    "Updating alert product context",
    {
      alertId,
      columns: ["product_description_raw", "product_context"],
    }
  );

  const { error } = await supabase
    .from("alerts")
    .update({
      product_description_raw: rawDescription,
      product_context: summary,
    })
    .eq("id", alertId);

  if (error) {
    logger.error(
      "DB_UPDATE_ERROR",
      "Failed to update alert product context",
      {
        alertId,
        message: error.message,
        code: (error as any).code,
      }
    );
    return;
  }

  // Hyper-log: DB_UPDATE (success)
  logger.info(
    "DB_UPDATE",
    "Alert product context updated",
    {
      alertId,
      summaryPreview: summary.slice(0, 120),
    }
  );

  // Ensure dashboard reflects latest data
  revalidatePath("/dashboard");
}

