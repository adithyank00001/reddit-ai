// Load environment variables from .env.local
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Import the three pipeline functions
import { fetchSubredditPosts } from "@/lib/reddit";
import { containsKeyword } from "@/lib/scanner";
import { analyzeOpportunity } from "@/lib/ai";

/**
 * Manual test function to verify the entire data pipeline:
 * Step A: Fetch Reddit posts
 * Step B: Filter posts using regex
 * Step C: Analyze intent using AI
 */
async function runTest() {
  try {
    console.log("🚀 Starting manual pipeline test...\n");

    // Step A: Fetch Reddit posts
    console.log("Step A: Fetching posts from Reddit...");
    const posts = await fetchSubredditPosts(["saas"]);
    console.log(`✅ Fetched ${posts.length} posts\n`);

    if (posts.length === 0) {
      console.log("⚠️  No posts found. Cannot continue test.");
      return;
    }

    // Step B: Filter posts using regex
    console.log("Step B: Filtering posts with keyword 'marketing'...");
    const keyword = "marketing";
    const filteredPosts = posts.filter((post) => {
      // Combine title and content for keyword search
      const combinedText = `${post.title} ${post.selftext}`;
      return containsKeyword(combinedText, [keyword]);
    });
    console.log(`✅ ${filteredPosts.length} post(s) passed the regex filter\n`);

    if (filteredPosts.length === 0) {
      console.log("⚠️  No posts matched the keyword filter. Cannot test AI analysis.");
      return;
    }

    // Step C: AI Check - analyze the first matching post
    const testPost = filteredPosts[0];
    console.log("Step C: Analyzing post with AI...");
    console.log(`📝 Post Title: "${testPost.title}"\n`);

    const productContext =
      process.env.TEST_PRODUCT_CONTEXT ||
      "Generic SaaS product helping users with problems discussed in the post.";

    const opportunity = await analyzeOpportunity(
      testPost.title,
      testPost.selftext,
      productContext
    );

    // Log final verdict
    if (opportunity.is_opportunity && opportunity.score >= 70) {
      console.log("🤖 AI says: YES (Opportunity) ✅");
      console.log(
        `Type: ${opportunity.opportunity_type}, Score: ${opportunity.score}`
      );
      console.log(`Reason: ${opportunity.short_reason}`);
      console.log(`Angle: ${opportunity.suggested_angle}`);
    } else {
      console.log("🤖 AI says: NO (Weak or no opportunity) ❌");
      console.log(
        `Type: ${opportunity.opportunity_type}, Score: ${opportunity.score}`
      );
      console.log(`Reason: ${opportunity.short_reason}`);
    }

    console.log("\n✨ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  }
}

// Execute the test
runTest();







