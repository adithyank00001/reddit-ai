/**
 * Script to clear all existing keywords from project_settings table
 * Run this with: npx tsx scripts/clear-keywords.ts
 */

// Load environment variables from .env.local
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing Supabase environment variables!");
  console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅" : "❌");
  console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceRoleKey ? "✅" : "❌");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function clearKeywords() {
  console.log("🗑️  Clearing all keywords from project_settings...\n");

  try {
    // First, check what's currently in the database
    console.log("🔍 Checking current keywords...");
    const { data: beforeData, error: beforeError } = await supabase
      .from("project_settings")
      .select("keywords")
      .eq("id", 1)
      .maybeSingle();

    if (beforeError) {
      console.error("❌ Error checking current keywords:", beforeError.message);
      return;
    }

    console.log("📋 Current keywords:", beforeData?.keywords || "None");
    if (Array.isArray(beforeData?.keywords) && beforeData.keywords.length > 0) {
      console.log("   Keywords:", beforeData.keywords.join(", "));
    }
    console.log("");

    // Clear the keywords
    console.log("🗑️  Clearing keywords...");
    const { error: updateError } = await supabase
      .from("project_settings")
      .update({ keywords: null })
      .eq("id", 1);

    if (updateError) {
      console.error("❌ Error clearing keywords:", updateError.message);
      return;
    }

    // Verify the keywords were cleared
    console.log("✅ Verifying keywords were cleared...");
    const { data: afterData, error: afterError } = await supabase
      .from("project_settings")
      .select("keywords")
      .eq("id", 1)
      .maybeSingle();

    if (afterError) {
      console.error("❌ Error verifying keywords were cleared:", afterError.message);
      return;
    }

    console.log("✅ Keywords cleared successfully!");
    console.log("📋 Keywords after clearing:", afterData?.keywords || "None (empty)");
    console.log("\n✨ You can now add new keywords through the dashboard form.");
  } catch (error: any) {
    console.error("❌ Unexpected error:", error.message);
  }
}

clearKeywords();
