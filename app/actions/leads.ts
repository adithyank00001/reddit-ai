"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Permanently delete a lead from the database
 * RLS policies ensure users can only delete their own leads
 * (via the alerts relationship)
 */
export async function deleteLead(leadId: string) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please log in." };
    }

    // Delete the lead - RLS will ensure user can only delete their own leads
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadId);

    if (error) {
      console.error("Error deleting lead:", error);
      return { success: false, error: error.message };
    }

    // Revalidate the dashboard to reflect the deletion
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting lead:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete lead",
    };
  }
}
