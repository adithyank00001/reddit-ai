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
        "Authorization": "Bearer " + SECRET_KEY,
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
