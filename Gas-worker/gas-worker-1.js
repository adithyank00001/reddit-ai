/**
 * Google Apps Script - Connectivity Test
 * Copy-paste this into your Google Apps Script editor
 *
 * Instructions:
 * 1. Replace VERCEL_URL with your actual Vercel endpoint URL
 * 2. Replace SECRET_KEY with your CRON_SECRET from .env.local
 * 3. Click "Run" button in the GAS editor
 * 4. Check Vercel logs to see if the data arrived
 */

const VERCEL_URL = "https://your-project.vercel.app/api/cron"; // ⚠️ CHANGE THIS
const SECRET_KEY = "my_super_secret_password_123"; // ⚠️ CHANGE THIS

function testConnection() {
  try {
    // Create test payload
    const testPayload = {
      message: "Hello from Google",
      timestamp: new Date().toISOString(),
    };

    // Prepare request options
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + SECRET_KEY,
      },
      payload: JSON.stringify(testPayload),
    };

    // Send POST request to Vercel
    Logger.log("🚀 Sending test request to Vercel...");
    Logger.log("URL: " + VERCEL_URL);
    Logger.log("Payload: " + JSON.stringify(testPayload));

    const response = UrlFetchApp.fetch(VERCEL_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    // Log results
    Logger.log("✅ Response Code: " + responseCode);
    Logger.log("📦 Response Body: " + responseText);

    if (responseCode === 200) {
      Logger.log("🎉 SUCCESS! Connection test passed!");
    } else {
      Logger.log("⚠️ WARNING: Unexpected response code: " + responseCode);
    }
  } catch (error) {
    Logger.log("❌ ERROR: " + error.message);
    Logger.log("Stack: " + error.stack);
  }
}

/**
 * Test Reddit Direct Access from Google Apps Script
 * This tests if GAS can access Reddit's JSON endpoints directly
 * (without going through Vercel). This is a workaround test for Reddit API blocks.
 *
 * Instructions:
 * 1. Click "Run" button and select testRedditAccess
 * 2. Check the logs to see if you got 200 OK or 403 Block
 */
function testRedditAccess() {
  var url = "https://www.reddit.com/r/saas/new.json";

  var options = {
    method: "get",
    muteHttpExceptions: true, // Don't crash on 403/429 errors
    headers: {
      "User-Agent": "reddit-lead-gen-gas-test/1.0 (contact: you@example.com)",
    },
  };

  try {
    Logger.log("=== Reddit Direct Access Test ===");
    Logger.log("Testing URL: " + url);
    Logger.log("Testing from: Google Apps Script (Google's servers)");

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var bodyText = response.getContentText();

    Logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Logger.log("Status Code: " + statusCode);

    if (statusCode === 200) {
      Logger.log("✅ RESULT: SUCCESS (200 OK)");
      Logger.log("Reddit allows requests from Google Apps Script!");

      // Try to parse JSON and log the first post title
      try {
        var data = JSON.parse(bodyText);
        var firstPost =
          data && data.data && data.data.children && data.data.children[0];

        if (firstPost && firstPost.data && firstPost.data.title) {
          Logger.log("First post title: " + firstPost.data.title);
          Logger.log(
            "✅ This proves we got real Reddit data, not an error page!"
          );
        } else {
          Logger.log("⚠️ Could not find first post title in response.");
        }
      } catch (e) {
        Logger.log("⚠️ Error parsing JSON, raw body below:");
        Logger.log(bodyText.substring(0, 1000)); // log first 1000 chars
      }
    } else if (statusCode === 403) {
      Logger.log("❌ RESULT: BLOCKED (403 Forbidden)");
      Logger.log("Reddit is blocking requests from Google Apps Script.");
      Logger.log("Error body snippet (first 1000 chars):");
      Logger.log(bodyText.substring(0, 1000));
    } else if (statusCode === 429) {
      Logger.log("⚠️ RESULT: RATE LIMITED (429 Too Many Requests)");
      Logger.log("Reddit is rate-limiting requests. Try again later.");
      Logger.log("Error body snippet (first 1000 chars):");
      Logger.log(bodyText.substring(0, 1000));
    } else {
      Logger.log("❌ RESULT: FAILED (Status: " + statusCode + ")");
      Logger.log("Unexpected status code. Error body snippet:");
      Logger.log(bodyText.substring(0, 1000));
    }

    Logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (err) {
    Logger.log("❌ Unexpected error while calling Reddit:");
    Logger.log(err && err.message ? err.message : err);
  }
}
