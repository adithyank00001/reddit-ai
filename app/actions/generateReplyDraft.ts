"use server";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { generateReplyDraft } from "@/lib/ai";
import { revalidatePath } from "next/cache";
import type { OpportunityResult } from "@/lib/ai";

/**
 * Server action to generate a reply draft for a lead on demand.
 * This is used when a lead doesn't have a draft yet and the user clicks "Generate Reply".
 */
export async function generateReplyDraftForLead(leadId: string) {
  logger.step("REPLY_DRAFT_ON_DEMAND", "Generating reply draft on demand", {
    leadId,
  });

  // Fetch the lead
  logger.dbQuery("SELECT", "leads", { operation: "fetch_for_draft", leadId });
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    logger.error("REPLY_DRAFT_ON_DEMAND_ERROR", "Failed to fetch lead", {
      leadId,
      error: leadError?.message,
    });
    return { success: false, error: "Lead not found" };
  }

  // Fetch global product context
  logger.dbQuery("SELECT", "project_settings", {
    operation: "fetch_context_for_draft",
  });
  const { data: settings, error: settingsError } = await supabase
    .from("project_settings")
    .select("product_context")
    .eq("id", 1)
    .maybeSingle();

  const productContext = settings?.product_context || "";

  if (settingsError) {
    logger.error("REPLY_DRAFT_ON_DEMAND_ERROR", "Failed to fetch product context", {
      leadId,
      error: settingsError.message,
    });
    // Continue anyway with empty context
  }

  // Reconstruct OpportunityResult from stored data
  // If we don't have opportunity data, create a default one
  const opportunity: OpportunityResult = {
    is_opportunity: true, // Assume it's an opportunity if it's in the leads table
    opportunity_type:
      (lead.opportunity_type as OpportunityResult["opportunity_type"]) ||
      "other_marketing",
    score: lead.opportunity_score ?? 70, // Default to 70 if missing
    short_reason: lead.opportunity_reason || "Potential lead for engagement",
    suggested_angle: lead.suggested_angle || "Helpful recommendation",
  };

  try {
    // Generate the draft
    const draft = await generateReplyDraft(
      lead.title,
      lead.body,
      productContext,
      opportunity
    );

    if (!draft) {
      logger.error("REPLY_DRAFT_ON_DEMAND_ERROR", "Draft generation returned null", {
        leadId,
      });
      return { success: false, error: "Failed to generate draft" };
    }

    // Save the draft to the lead
    logger.dbQuery("UPDATE", "leads", {
      operation: "save_on_demand_draft",
      leadId,
      draftLength: draft.length,
    });
    const { error: updateError } = await supabase
      .from("leads")
      .update({ reply_draft: draft })
      .eq("id", leadId);

    if (updateError) {
      logger.error("REPLY_DRAFT_ON_DEMAND_ERROR", "Failed to save draft", {
        leadId,
        error: updateError.message,
      });
      return { success: false, error: "Failed to save draft" };
    }

    logger.step("REPLY_DRAFT_ON_DEMAND_SUCCESS", "Reply draft generated and saved", {
      leadId,
      draftLength: draft.length,
    });

    // Revalidate the dashboard to show the new draft
    revalidatePath("/dashboard");

    return { success: true, draft };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("REPLY_DRAFT_ON_DEMAND_ERROR", "Exception during draft generation", {
      leadId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { success: false, error: errorMessage };
  }
}
