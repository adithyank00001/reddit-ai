// Load environment variables from .env.local
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing Supabase environment variables!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function insertTestAlerts() {
  console.log("🚀 Inserting test alerts...\n");

  const testAlerts = [
    {
      subreddit: "saas",
      keywords: ["marketing", "seo", "growth"],
    },
    {
      subreddit: "entrepreneur",
      keywords: ["hiring", "developer", "freelancer"],
    },
    {
      subreddit: "startups",
      keywords: ["funding", "investor", "vc"],
    },
    {
      subreddit: "marketing",
      keywords: ["agency", "consultant", "services"],
    },
    {
      subreddit: "webdev",
      keywords: ["looking for", "need help", "recommendation"],
    },
  ];

  const results = [];

  for (const alert of testAlerts) {
    const { data, error } = await supabase
      .from("alerts")
      .insert(alert)
      .select();

    if (error) {
      console.error(`❌ Failed to insert alert for r/${alert.subreddit}:`, error.message);
      results.push({ success: false, alert, error: error.message });
    } else {
      console.log(`✅ Inserted alert for r/${alert.subreddit} with keywords: ${alert.keywords.join(", ")}`);
      results.push({ success: true, alert, data });
    }
  }

  console.log("\n📊 Summary:");
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  // Verify the inserts
  console.log("\n🔍 Verifying alerts in database:");
  const { data: allAlerts, error: fetchError } = await supabase
    .from("alerts")
    .select("id, subreddit, keywords");

  if (fetchError) {
    console.error("❌ Failed to fetch alerts:", fetchError.message);
  } else {
    console.log(`✅ Found ${allAlerts?.length || 0} alerts in database:`);
    allAlerts?.forEach((alert, idx) => {
      console.log(`  ${idx + 1}. r/${alert.subreddit} - Keywords: ${JSON.stringify(alert.keywords)}`);
    });
  }

  console.log("\n✨ Done!");
}

insertTestAlerts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });



