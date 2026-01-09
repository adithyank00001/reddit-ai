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

async function checkDatabase() {
  console.log("🔍 Checking database structure...\n");

  const tableCandidates = [
    "Alert", "alert", "alerts",
    "Post", "post", "posts", "processed_posts",
    "Lead", "lead", "leads"
  ];

  const results: Record<string, any> = {};

  // Check each table
  for (const tableName of tableCandidates) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select("*", { count: "exact" })
        .limit(1);

      if (!error) {
        results[tableName] = {
          exists: true,
          rowCount: count ?? 0,
          columnNames: data && data.length > 0 ? Object.keys(data[0]) : [],
          sampleRow: data?.[0] || null,
        };
        console.log(`✅ Table "${tableName}" exists`);
        console.log(`   Columns: ${results[tableName].columnNames.join(", ")}`);
        console.log(`   Row count: ${results[tableName].rowCount}`);
        if (results[tableName].sampleRow) {
          console.log(`   Sample row:`, JSON.stringify(results[tableName].sampleRow, null, 2));
        }
        console.log();
      } else {
        results[tableName] = {
          exists: false,
          error: error.message,
        };
        console.log(`❌ Table "${tableName}" does not exist: ${error.message}\n`);
      }
    } catch (err: any) {
      results[tableName] = {
        exists: false,
        error: err.message,
      };
      console.log(`❌ Table "${tableName}" error: ${err.message}\n`);
    }
  }

  // Test different column combinations to find what works
  console.log("\n📋 Testing different column combinations:");
  const columnTests = [
    "id, subreddit, keywords",
    "id, subreddit, keywords, active",
    "*"
  ];

  for (const cols of columnTests) {
    const { data, error } = await supabase.from("alerts").select(cols).limit(1);
    if (!error) {
      console.log(`✅ "${cols}" works`);
      if (data && data.length > 0) {
        console.log(`   Sample:`, JSON.stringify(data[0], null, 2));
      } else {
        console.log(`   (Table is empty, but query succeeds)`);
      }
    } else {
      console.log(`❌ "${cols}" failed: ${error.message}`);
    }
  }

  // Check processed_posts columns
  console.log("\n📋 Testing processed_posts columns:");
  const postColumnTests = [
    "post_id",
    "reddit_post_id",
    "reddit_id",
    "*"
  ];

  for (const cols of postColumnTests) {
    const { data, error } = await supabase.from("processed_posts").select(cols).limit(1);
    if (!error) {
      console.log(`✅ "${cols}" works`);
      if (data && data.length > 0) {
        console.log(`   Sample:`, JSON.stringify(data[0], null, 2));
      }
    } else {
      console.log(`❌ "${cols}" failed: ${error.message}`);
    }
  }

  // Test processed_posts query
  console.log("\n📋 Testing processed_posts query:");
  const { data: postsData, error: postsError } = await supabase
    .from("processed_posts")
    .select("*")
    .limit(5);

  if (postsError) {
    console.log(`❌ Error: ${postsError.message}`);
  } else {
    console.log(`✅ Found ${postsData?.length || 0} posts`);
    if (postsData && postsData.length > 0) {
      console.log("Sample posts:");
      console.log(JSON.stringify(postsData[0], null, 2));
    }
  }

  console.log("\n✨ Database check complete!");
  return results;
}

checkDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });

