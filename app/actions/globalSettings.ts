"use server";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Updates global project settings (product description and keywords).
 * Saves raw text only - Worker 2 uses product_description_raw directly.
 */
export async function updateGlobalSettings(formData: FormData) {
  const rawDescription = String(formData.get("rawDescription") || "");
  const keywordsString = String(formData.get("keywordsString") || "");

  logger.info("GLOBAL_UPDATE_START", "Global settings form received", {
    descriptionLength: rawDescription.length,
    keywordsRaw: keywordsString,
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

  // We only save the raw description - Worker 2 will use product_description_raw directly
  logger.info("GLOBAL_UPDATE", "Upserting global settings", {
    descriptionLength: rawDescription.length,
    keywordCount: limitedKeywords.length,
    keywordsPreview: limitedKeywords.slice(0, 10),
  });

  const { error } = await supabase
    .from("project_settings")
    .upsert(
      {
        id: 1,
        product_description_raw: rawDescription,
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

  logger.info("GLOBAL_UPDATE_SUCCESS", "Global settings updated successfully", {
    descriptionLength: rawDescription.length,
    keywordCount: limitedKeywords.length,
    keywords: limitedKeywords,
  });

  revalidatePath("/dashboard");
}

