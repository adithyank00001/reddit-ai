/**
 * Worker 2: The Brain - Google Apps Script
 * 
 * Two-Stage AI Sales Intelligent Filter
 * 
 * This script receives webhooks from Supabase when new leads are inserted,
 * then uses OpenAI to analyze and score leads for sales opportunities.
 * 
 * Configuration (set via PropertiesService):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_KEY: Supabase Service Role key (required to bypass RLS)
 * - OPENAI_API_KEY: Your OpenAI API key
 * 
 * Deployment:
 * 1. Deploy as Web App: Publish > Deploy as web app
 * 2. Set "Execute as: Me" and "Who has access: Anyone"
 * 3. Copy the web app URL
 * 4. Use this URL in Supabase Database Webhooks (INSERT trigger on leads table)
 * 
 * ============================================================================
 * GOOGLE SHEETS LOGGING SETUP INSTRUCTIONS
 * ============================================================================
 * 
 * This script logs all activity to a Google Sheet for debugging purposes.
 * 
 * SETUP STEPS:
 * 
 * 1. CREATE A GOOGLE SHEET:
 *    - Go to Google Drive and create a new Google Sheet
 *    - Name it something like "Worker 2 Logs" or "Webhook Logs"
 * 
 * 2. GET YOUR SHEET ID:
 *    - Open your Google Sheet
 *    - Look at the URL in your browser
 *    - The URL will look like: https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
 *    - Copy the SHEET_ID_HERE part (it's a long string of letters and numbers)
 *    - Example: If URL is https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit
 *               Then your Sheet ID is: 1a2b3c4d5e6f7g8h9i0j
 * 
 * 3. CREATE THE LOGS SHEET TAB:
 *    - In your Google Sheet, create a new sheet tab (click the "+" button at the bottom)
 *    - Name this tab exactly: "Logs" (case-sensitive)
 *    - Add a header row in row 1 with two columns: "Timestamp" and "Message"
 * 
 * 4. BIND THE SCRIPT TO YOUR SHEET:
 *    - Make sure the Google Apps Script is attached to your Google Sheet
 *    - If it's a standalone script, you need to either:
 *      a) Create a new script from within the Sheet (Extensions > Apps Script)
 *      b) Or copy this code into a script bound to your Sheet
 * 
 * 5. GRANT PERMISSIONS:
 *    - When you first run the script, Google will ask for permission to access your Sheet
 *    - Click "Review Permissions" and allow access
 *    - This only needs to be done once
 * 
 * 6. TEST IT:
 *    - After setup, trigger your webhook and check the "Logs" sheet tab
 *    - You should see new rows appearing with timestamps and log messages
 * 
 * TROUBLESHOOTING:
 * - If logs don't appear, check that the Sheet ID is correct
 * - Make sure the sheet tab is named exactly "Logs" (case-sensitive)
 * - Ensure the script has permission to access the sheet
 * - The script will silently fail if it can't write to the sheet (won't break your webhook)
 */

/**
 * ============================================================================
 * AI MODEL CONFIGURATION
 * ============================================================================
 * 
 * Centralized configuration for all AI models used in this worker.
 * Modify these variables to change models without touching the code logic.
 */

// Stage 1: Binary Relevance Filter
// Used to quickly determine if a Reddit post has any potential for sales/marketing/feedback
// Low max_tokens (10) for binary Yes/No responses
const AI_MODEL_STAGE1_BINARY_RELEVANCE = "gpt-4o-mini";
const AI_MAX_TOKENS_STAGE1_BINARY_RELEVANCE = 10;
const AI_TEMPERATURE_STAGE1_BINARY_RELEVANCE = 0.7;

// Stage 2: Sales Intelligence Generation
// Used to generate detailed analysis, scoring, and reply drafts for relevant leads
// Higher max_tokens (500) for structured JSON responses
const AI_MODEL_STAGE2_SALES_INTELLIGENCE = "gpt-4o-mini";
const AI_MAX_TOKENS_STAGE2_SALES_INTELLIGENCE = 500;
const AI_TEMPERATURE_STAGE2_SALES_INTELLIGENCE = 0.7;

/**
 * ============================================================================
 * END AI MODEL CONFIGURATION
 * ============================================================================
 */

/**
 * Format timestamp for logging (inline version to ensure it's always available)
 * @param {Date} date - Date object to format
 * @returns {string} Formatted timestamp string
 */
function formatTimestampForLog(date) {
  try {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  } catch (e) {
    // Fallback if timezone fails
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }
}

/**
 * Log messages to Google Sheet for debugging
 * @param {string|Object} message - The message to log (string or object)
 */
function logToSheet(message) {
  try {
    // Handle undefined/null messages
    if (message === undefined || message === null) {
      // Get stack trace to identify where it's being called from
      const stack = new Error().stack;
      const caller = stack ? stack.split('\n')[2] : "unknown";
      Logger.log("logToSheet: Warning - called with undefined/null message");
      Logger.log("Called from: " + caller);
      message = "[No message provided - check Execution log for caller]";
    }
    
    // Container-bound script: Access the spreadsheet this script is bound to
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!spreadsheet) {
      // If no active spreadsheet, logging is not available (standalone script)
      // Log to Logger so we know it failed
      Logger.log("logToSheet: No active spreadsheet found");
      return;
    }
    
    // Get or create the 'Logs' sheet
    let sheet = spreadsheet.getSheetByName('Logs');
    if (!sheet) {
      try {
        // Create the sheet if it doesn't exist
        sheet = spreadsheet.insertSheet('Logs');
        // Add header row
        sheet.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Message']]);
        // Make header row bold
        sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
        Logger.log("logToSheet: Created 'Logs' sheet");
      } catch (createError) {
        Logger.log("logToSheet: Failed to create sheet - " + createError.message);
        return;
      }
    }
    
    // Format the message
    let messageText;
    try {
      if (message === null || message === undefined) {
        messageText = "[Null/undefined message]";
      } else if (typeof message === 'object') {
        messageText = JSON.stringify(message);
      } else if (typeof message === 'string') {
        messageText = message;
      } else {
        messageText = String(message);
      }
      
      // Ensure messageText is not empty
      if (!messageText || messageText.trim() === '') {
        messageText = "[Empty message]";
      }
    } catch (formatError) {
      messageText = "[Error formatting message: " + formatError.message + "]";
    }
    
    // Create timestamp (use inline function to ensure it's available)
    let timestamp;
    try {
      timestamp = formatTimestampForLog(new Date());
    } catch (timeError) {
      timestamp = new Date().toISOString();
    }
    
    // Append the log entry
    try {
      sheet.appendRow([timestamp, messageText]);
      // Also log to Logger for verification
      Logger.log("logToSheet: Successfully logged - " + messageText.substring(0, 50));
    } catch (appendError) {
      Logger.log("logToSheet: Failed to append row - " + appendError.message);
      Logger.log("Error details: " + appendError.stack);
    }
    
  } catch (error) {
    // Log error to Logger (visible in Apps Script execution log)
    // But don't break the webhook - logging is optional
    try {
      Logger.log("ERROR in logToSheet: " + error.message);
      Logger.log("Stack: " + error.stack);
      Logger.log("Error type: " + (error.name || "Unknown"));
    } catch (e) {
      // If even Logger fails, we can't do anything
      // This should never happen, but just in case
    }
  }
}

/**
 * ============================================================================
 * DEBUGGING FEATURES
 * ============================================================================
 * 
 * 1. TEST doGet() ENDPOINT:
 *    - Visit your web app URL in a browser (GET request)
 *    - You should see a JSON response confirming the web app is accessible
 *    - This helps verify your web app deployment is working
 * 
 * 2. MANUAL TEST FUNCTION:
 *    - In Google Apps Script editor, select "testSheetLogging" from the function dropdown
 *    - Click "Run" to execute it manually
 *    - Check your Google Sheet "Logs" tab to see test messages
 *    - This verifies sheet logging works independently
 * 
 * 3. VIEW DEBUG LOGS IN SUPABASE:
 *    - When webhooks are triggered, check Supabase webhook logs
 *    - Each response includes a "debug_logs" array with all log messages
 *    - This lets you see logs even if Google Sheets logging fails
 *    - Go to: Supabase Dashboard > Database > Webhooks > View Logs
 */

/**
 * Dual logging function - logs to both sheet and debug array
 * @param {string|Object} message - The message to log (string or object)
 * @param {Array} debugLogs - Array to store debug logs for response (optional)
 */
function logWithDebug(message, debugLogs = null) {
  // Ensure message is not undefined/null before logging
  if (message === undefined || message === null) {
    message = "[logWithDebug called with undefined/null]";
  }
  
  // Log to Google Sheet (existing functionality)
  logToSheet(message);
  
  // Also add to debug array for response if provided
  if (debugLogs && Array.isArray(debugLogs)) {
    // Format message for debug array
    let messageText;
    try {
      if (message === null || message === undefined) {
        messageText = "[Null/undefined message]";
      } else if (typeof message === 'object') {
        messageText = JSON.stringify(message);
      } else {
        messageText = String(message);
      }
      debugLogs.push(messageText);
    } catch (e) {
      debugLogs.push("[Error formatting debug log: " + e.message + "]");
    }
  }
}

/**
 * Test endpoint - GET request to verify web app is accessible
 * Visit your web app URL in a browser to test
 * @param {Object} e - Event object from Google Apps Script web app
 */
function doGet(e) {
  let timestamp;
  try {
    timestamp = formatTimestamp(new Date());
  } catch (e) {
    timestamp = formatTimestampForLog(new Date());
  }
  logToSheet("TEST: doGet() called - web app is accessible!");
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    timestamp: timestamp,
    message: "Web app is accessible! This confirms your deployment is working.",
    test: "doGet() endpoint is functioning correctly"
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Manual test function for sheet logging
 * Run this manually in the Google Apps Script editor to test logging
 * Select "testSheetLogging" from the function dropdown and click "Run"
 * Check both the "Logs" sheet tab AND the Execution log (View > Execution log)
 */
function testSheetLogging() {
  Logger.log("=== Starting testSheetLogging ===");
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log("ERROR: No active spreadsheet!");
      return "ERROR: Script is not bound to a spreadsheet. Create the script from within a Google Sheet.";
    }
    Logger.log("Spreadsheet found: " + ss.getName());
    
    logToSheet("=== MANUAL TEST ===");
    logToSheet("Test message 1: Sheet logging is working!");
    logToSheet("Test message 2: Timestamp formatting works");
    logToSheet("Test message 3: Object logging test");
    logToSheet({ test: "object", number: 123, boolean: true });
    logToSheet("=== MANUAL TEST COMPLETE ===");
    logToSheet("If you see these messages in your Google Sheet 'Logs' tab, logging is working correctly!");
    
    Logger.log("=== testSheetLogging completed ===");
    Logger.log("Check the 'Logs' sheet tab in your spreadsheet for the test messages.");
    return "Test completed! Check the 'Logs' sheet tab and Execution log.";
  } catch (e) {
    Logger.log("ERROR in testSheetLogging: " + e.message);
    Logger.log("Stack: " + e.stack);
    return "ERROR: " + e.message;
  }
}

/**
 * Force permission dialog for Google Sheets access
 * Run this manually to trigger the authorization popup
 * Select "forcePermission" from the function dropdown and click "Run"
 * This will prompt you to authorize Google Sheets access if not already granted
 */
function forcePermission() {
  try {
    // Container-bound script: Access the bound spreadsheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log("✅ Successfully accessed sheet: " + ss.getName());
    Logger.log("✅ Permissions are granted!");
    
    // Test logging
    logToSheet("=== PERMISSION TEST ===");
    logToSheet("If you see this message, logging is working!");
    
    return "Success! Check the 'Logs' sheet tab for test messages.";
  } catch (e) {
    Logger.log("❌ Permission error: " + e.message);
    Logger.log("Stack: " + e.stack);
    return "Error: " + e.message;
  }
}

/**
 * Diagnostic function to test logging and identify issues
 * Run this manually to see what's wrong with logging
 */
function diagnoseLogging() {
  const results = [];
  
  try {
    // Test 1: Check if spreadsheet is accessible
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      results.push("✅ Spreadsheet accessible: " + ss.getName());
    } else {
      results.push("❌ No active spreadsheet found (script may be standalone)");
      return results.join("\n");
    }
    
    // Test 2: Check if Logs sheet exists
    let sheet = ss.getSheetByName('Logs');
    if (sheet) {
      results.push("✅ 'Logs' sheet exists");
    } else {
      results.push("⚠️ 'Logs' sheet does not exist - will be created");
    }
    
    // Test 3: Test formatTimestamp function
    try {
      const testTimestamp = formatTimestamp(new Date());
      results.push("✅ formatTimestamp works: " + testTimestamp);
    } catch (e) {
      results.push("❌ formatTimestamp error: " + e.message);
    }
    
    // Test 4: Try to write to sheet
    try {
      if (!sheet) {
        sheet = ss.insertSheet('Logs');
        sheet.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Message']]);
        sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
        results.push("✅ Created 'Logs' sheet");
      }
      
      const testRow = [formatTimestamp(new Date()), "Diagnostic test message"];
      sheet.appendRow(testRow);
      results.push("✅ Successfully wrote test row to sheet");
    } catch (e) {
      results.push("❌ Error writing to sheet: " + e.message);
      results.push("Stack: " + e.stack);
    }
    
    // Test 5: Test logToSheet function
    try {
      logToSheet("=== DIAGNOSTIC TEST ===");
      logToSheet({ test: "object", timestamp: new Date().toISOString() });
      results.push("✅ logToSheet function executed without errors");
    } catch (e) {
      results.push("❌ logToSheet error: " + e.message);
      results.push("Stack: " + e.stack);
    }
    
  } catch (e) {
    results.push("❌ Fatal error: " + e.message);
    results.push("Stack: " + e.stack);
  }
  
  const resultText = results.join("\n");
  Logger.log(resultText);
  return resultText;
}

/**
 * Webhook entry point - called by Supabase when a new lead is inserted
 * @param {Object} e - Event object from Google Apps Script web app
 */
function doPost(e) {
  // Initialize debug logs array for dual logging
  const debugLogs = [];
  const startTime = new Date();
  
  // Format timestamp safely
  let timestampStr;
  try {
    timestampStr = formatTimestamp(startTime);
  } catch (e) {
    timestampStr = formatTimestampForLog(startTime); // Fallback
  }
  
  logWithDebug(`[${timestampStr}] Worker 2 (The Brain) - Webhook received`, debugLogs);

  try {
    // Parse webhook payload
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      logWithDebug(`ERROR: Failed to parse webhook payload: ${parseError.message}`, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Invalid JSON payload",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Extract lead ID from webhook
    // Supabase webhook format: { type: 'INSERT', table: 'leads', record: {...} }
    const lead = payload.record || payload;
    const leadId = lead.id;

    if (!leadId) {
      logWithDebug(`ERROR: Missing lead ID in webhook payload`, debugLogs);
      logWithDebug(`Payload: ${JSON.stringify(payload)}`, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing required field (id)",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`Processing lead: ${leadId}`, debugLogs);

    // Get configuration
    const config = getConfig(debugLogs);
    if (!config) {
      logWithDebug("ERROR: Configuration missing", debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Configuration missing",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Step 1: Fetch lead details from database (title, body, alert_id)
    logWithDebug("Fetching lead details from database...", debugLogs);
    const leadDetails = fetchLeadDetails(config, leadId, debugLogs);
    if (!leadDetails) {
      logWithDebug("ERROR: Could not fetch lead details", debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Could not fetch lead details",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const title = leadDetails.title;
    const body = leadDetails.body;
    const alertId = leadDetails.alert_id;

    if (!title || !alertId) {
      logWithDebug(`ERROR: Missing required fields in lead (title: ${!!title}, alert_id: ${!!alertId})`, debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing required fields in lead (title or alert_id)",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`Title: ${title.substring(0, 50)}...`, debugLogs);
    logWithDebug(`Alert ID: ${alertId}`, debugLogs);

    // Step 2: Resolve user by fetching alert to get user_id
    logWithDebug("Resolving user from alert...", debugLogs);
    const userId = fetchUserIdFromAlert(config, alertId, debugLogs);
    if (!userId) {
      logWithDebug("ERROR: Could not resolve user from alert", debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Could not resolve user from alert",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`User ID: ${userId}`, debugLogs);

    // Step 3: Fetch product description from project_settings using user_id
    logWithDebug("Fetching product description from project_settings...", debugLogs);
    const productDescription = fetchProductContext(config, userId, debugLogs);
    if (!productDescription) {
      logWithDebug("ERROR: Could not fetch product description", debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Could not fetch product description",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`Product description: ${productDescription.substring(0, 100)}...`, debugLogs);

    // Step 4: Lock the record by setting processing_status to 'processing'
    logWithDebug("Locking lead record...", debugLogs);
    const lockResult = updateLeadStatus(config, leadId, 'processing', leadDetails.status || 'new', debugLogs);
    if (!lockResult) {
      logWithDebug("ERROR: Failed to lock lead record", debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Failed to lock lead record",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Step 5: Stage 1 - Binary Relevance Filter
    logWithDebug("\n=== Stage 1: Binary Relevance Check ===", debugLogs);
    const stage1Result = stage1BinaryRelevance(config, title, body, productDescription, debugLogs);
    
    if (!stage1Result.success) {
      logWithDebug(`ERROR in Stage 1: ${stage1Result.error}`, debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: stage1Result.error,
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (stage1Result.relevant === false) {
      logWithDebug("Stage 1 Result: NOT RELEVANT - Discarding lead", debugLogs);
      updateLeadStatus(config, leadId, 'discarded', 'discarded', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        stage: 1,
        result: "discarded",
        reason: "Not relevant",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug("Stage 1 Result: RELEVANT - Proceeding to Stage 2", debugLogs);

    // Step 6: Stage 2 - Sales Intelligence Generation
    logWithDebug("\n=== Stage 2: Sales Intelligence Analysis ===", debugLogs);
    const stage2Result = stage2SalesIntelligence(config, title, body, productDescription, debugLogs);
    
    if (!stage2Result.success) {
      logWithDebug(`ERROR in Stage 2: ${stage2Result.error}`, debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: stage2Result.error,
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Step 7: Update database with Stage 2 results
    logWithDebug("Updating lead with analysis results...", debugLogs);
    const updateResult = updateLeadWithAnalysis(config, leadId, stage2Result.data, debugLogs);
    
    if (!updateResult) {
      logWithDebug("ERROR: Failed to update lead with analysis", debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Failed to update lead",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    // Format end timestamp safely
    let endTimestampStr;
    try {
      endTimestampStr = formatTimestamp(endTime);
    } catch (e) {
      endTimestampStr = formatTimestampForLog(endTime);
    }
    
    logWithDebug(`\n[${endTimestampStr}] Worker 2 completed successfully`, debugLogs);
    logWithDebug(`Duration: ${duration.toFixed(2)}s`, debugLogs);
    logWithDebug(`Lead ${leadId} is now ready for review`, debugLogs);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      stage: 2,
      result: "ready",
      leadId: leadId,
      debug_logs: debugLogs
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    logWithDebug(`FATAL ERROR: ${error.message}`, debugLogs);
    logWithDebug(error.stack, debugLogs);
    
    // Try to set error status if we have the lead ID
    try {
      const config = getConfig(debugLogs);
      if (config && e.postData) {
        const payload = JSON.parse(e.postData.contents);
        const lead = payload.record || payload;
        if (lead.id) {
          updateLeadStatus(config, lead.id, 'error', 'error', debugLogs);
        }
      }
    } catch (e) {
      // Ignore errors in error handling
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message,
      debug_logs: debugLogs
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get configuration from Script Properties
 * 
 * Reads from Google Apps Script Properties (set in File > Project Settings > Script Properties):
 * - SUPABASE_URL: Your Supabase project URL (e.g., https://xxxxx.supabase.co)
 * - SUPABASE_KEY: Your Supabase Service Role key (JWT token)
 * - OPENAI_API_KEY: Your OpenAI API key
 * 
 * The code automatically reads these values from Script Properties - no manual configuration needed.
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function getConfig(debugLogs = null) {
  const props = PropertiesService.getScriptProperties();
  
  // Read from Script Properties (set in File > Project Settings > Script Properties)
  const supabaseUrl = props.getProperty("SUPABASE_URL");
  const supabaseKey = props.getProperty("SUPABASE_KEY");
  const openaiKey = props.getProperty("OPENAI_API_KEY");

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    logWithDebug("Missing configuration properties:", debugLogs);
    logWithDebug(`  SUPABASE_URL: ${supabaseUrl ? "✓" : "✗"}`, debugLogs);
    logWithDebug(`  SUPABASE_KEY: ${supabaseKey ? "✓" : "✗"}`, debugLogs);
    logWithDebug(`  OPENAI_API_KEY: ${openaiKey ? "✓" : "✗"}`, debugLogs);
    logWithDebug("Please set these in: File > Project Settings > Script Properties", debugLogs);
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseKey: supabaseKey.trim(),
    openaiKey: openaiKey.trim(),
  };
}

/**
 * Fetch lead details from database (title, body, alert_id)
 * @param {Object} config - Configuration object
 * @param {string} leadId - Lead ID
 * @param {Array} debugLogs - Optional array to store debug logs
 * @returns {Object|null} Lead details object or null if not found
 */
function fetchLeadDetails(config, leadId, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/leads?id=eq.${leadId}&select=title,body,alert_id,status`;
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      logWithDebug(`ERROR: Supabase API returned ${statusCode} when fetching lead`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return null;
    }

    const result = JSON.parse(responseText);
    if (!Array.isArray(result) || result.length === 0) {
      logWithDebug(`No lead found with id=${leadId}`, debugLogs);
      return null;
    }

    return result[0];
  } catch (error) {
    logWithDebug(`ERROR fetching lead details: ${error.message}`, debugLogs);
    return null;
  }
}

/**
 * Fetch user_id from alerts table using alert_id
 * @param {Object} config - Configuration object
 * @param {string} alertId - Alert ID
 * @param {Array} debugLogs - Optional array to store debug logs
 * @returns {string|null} User ID or null if not found
 */
function fetchUserIdFromAlert(config, alertId, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/alerts?id=eq.${alertId}&select=user_id`;
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      logWithDebug(`ERROR: Supabase API returned ${statusCode} when fetching alert`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return null;
    }

    const result = JSON.parse(responseText);
    if (!Array.isArray(result) || result.length === 0) {
      logWithDebug(`No alert found with id=${alertId}`, debugLogs);
      return null;
    }

    const userId = result[0].user_id;
    if (!userId) {
      logWithDebug(`Alert ${alertId} has no user_id`, debugLogs);
      return null;
    }

    return userId;
  } catch (error) {
    logWithDebug(`ERROR fetching user_id from alert: ${error.message}`, debugLogs);
    return null;
  }
}

/**
 * Fetch product_description_raw from project_settings table using user_id
 * @param {Object} config - Configuration object
 * @param {string} userId - User ID (UUID)
 * @param {Array} debugLogs - Optional array to store debug logs
 * @returns {string|null} Product description or null if not found
 */
function fetchProductContext(config, userId, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/project_settings?user_id=eq.${userId}&select=product_description_raw`;
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      logWithDebug(`ERROR: Supabase API returned ${statusCode}`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return null;
    }

    const result = JSON.parse(responseText);
    if (!Array.isArray(result) || result.length === 0) {
      logWithDebug(`No project_settings found for user_id=${userId}`, debugLogs);
      return null;
    }

    const productDescription = result[0].product_description_raw;
    if (!productDescription || productDescription.trim().length === 0) {
      logWithDebug(`Project settings found but product_description_raw is empty for user_id=${userId}`, debugLogs);
      return null;
    }

    return productDescription;
  } catch (error) {
    logWithDebug(`ERROR fetching product description: ${error.message}`, debugLogs);
    return null;
  }
}

/**
 * Update lead status in Supabase
 * @param {Object} config - Configuration object
 * @param {string} leadId - Lead ID
 * @param {string} processingStatus - Processing status
 * @param {string} status - Status
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function updateLeadStatus(config, leadId, processingStatus, status, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/leads?id=eq.${leadId}`;
  
  const updateData = {
    processing_status: processingStatus,
    status: status
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "PATCH",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      payload: JSON.stringify(updateData),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      return true;
    } else {
      const responseText = response.getContentText();
      logWithDebug(`ERROR updating lead status: HTTP ${statusCode}`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return false;
    }
  } catch (error) {
    logWithDebug(`ERROR updating lead status: ${error.message}`, debugLogs);
    return false;
  }
}

/**
 * Stage 1: Binary Relevance Filter
 * Uses AI_MODEL_STAGE1_BINARY_RELEVANCE to determine if the post has any potential for sales/marketing/feedback
 * @param {Object} config - Configuration object
 * @param {string} title - Post title
 * @param {string} body - Post body
 * @param {string} productDescription - Product description
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function stage1BinaryRelevance(config, title, body, productDescription, debugLogs = null) {
  const systemPrompt = "Answer ONLY 'Yes' or 'No'.";
  
  const userPrompt = `Determine if this Reddit post has any potential for sales, marketing, or feedback for a product with this description:

Product Description: ${productDescription}

Post Title: ${title}
Post Body: ${body}

Does this post have any potential for sales, marketing, or feedback? Answer ONLY 'Yes' or 'No'.`;

  try {
    const response = callOpenAI(config, AI_MODEL_STAGE1_BINARY_RELEVANCE, systemPrompt, userPrompt, AI_MAX_TOKENS_STAGE1_BINARY_RELEVANCE, AI_TEMPERATURE_STAGE1_BINARY_RELEVANCE, debugLogs);
    
    if (!response || !response.choices || !response.choices[0]) {
      return { success: false, error: "Invalid response from OpenAI" };
    }

    const answer = response.choices[0].message.content.trim().toLowerCase();
    const isRelevant = answer.startsWith('yes');

    logWithDebug(`OpenAI Response: ${answer}`, debugLogs);
    logWithDebug(`Interpreted as: ${isRelevant ? 'RELEVANT' : 'NOT RELEVANT'}`, debugLogs);

    return {
      success: true,
      relevant: isRelevant,
      rawResponse: answer
    };
  } catch (error) {
    logWithDebug(`ERROR in Stage 1: ${error.message}`, debugLogs);
    return { success: false, error: error.message };
  }
}

/**
 * Stage 2: Sales Intelligence Generation
 * Uses AI_MODEL_STAGE2_SALES_INTELLIGENCE to generate detailed analysis and scoring
 * @param {Object} config - Configuration object
 * @param {string} title - Post title
 * @param {string} body - Post body
 * @param {string} productDescription - Product description
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function stage2SalesIntelligence(config, title, body, productDescription, debugLogs = null) {
  const systemPrompt = "You are a sales intelligence analyst. Analyze Reddit posts and provide structured JSON responses with sales opportunity insights.";

  const userPrompt = `Analyze this Reddit post deeply and provide a JSON response with these exact keys:
- "relevance_score": (0-100) - How relevant is this to the business context?
- "ai_analysis": (1-2 sentences) - Why does this fit the business?
- "opportunity_score": (0-100) - Prioritizing actual buying intent
- "opportunity_type": (e.g., "direct_buying", "problem_awareness", "competitor_switch", "feedback_seeker", "community_engagement")
- "opportunity_reason": (Concise reason why this is an opportunity)
- "suggested_angle": (A 1-sentence strategic tip on how to approach this user)
- "ai_reply": (A humanized, non-salesy, helpful 2-3 sentence Reddit comment draft)

Product Description: ${productDescription}

Post Title: ${title}
Post Body: ${body}

Return ONLY valid JSON with these exact keys. No markdown, no code blocks, just the JSON object.`;

  try {
    const response = callOpenAI(config, AI_MODEL_STAGE2_SALES_INTELLIGENCE, systemPrompt, userPrompt, AI_MAX_TOKENS_STAGE2_SALES_INTELLIGENCE, AI_TEMPERATURE_STAGE2_SALES_INTELLIGENCE, debugLogs);
    
    if (!response || !response.choices || !response.choices[0]) {
      return { success: false, error: "Invalid response from OpenAI" };
    }

    const content = response.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    let jsonText = content;
    if (content.startsWith('```')) {
      jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    // Parse JSON
    let analysisData;
    try {
      analysisData = JSON.parse(jsonText);
    } catch (parseError) {
      logWithDebug(`ERROR: Failed to parse JSON response: ${parseError.message}`, debugLogs);
      logWithDebug(`Response content: ${content}`, debugLogs);
      return { success: false, error: "Failed to parse JSON response" };
    }

    // Validate required fields
    const requiredFields = ['relevance_score', 'ai_analysis', 'opportunity_score', 'opportunity_type', 'opportunity_reason', 'suggested_angle', 'ai_reply'];
    const missingFields = requiredFields.filter(field => !(field in analysisData));
    
    if (missingFields.length > 0) {
      logWithDebug(`ERROR: Missing required fields: ${missingFields.join(', ')}`, debugLogs);
      return { success: false, error: `Missing required fields: ${missingFields.join(', ')}` };
    }

    logWithDebug(`Analysis complete:`, debugLogs);
    logWithDebug(`  Relevance Score: ${analysisData.relevance_score}`, debugLogs);
    logWithDebug(`  Opportunity Score: ${analysisData.opportunity_score}`, debugLogs);
    logWithDebug(`  Opportunity Type: ${analysisData.opportunity_type}`, debugLogs);

    return {
      success: true,
      data: analysisData
    };
  } catch (error) {
    logWithDebug(`ERROR in Stage 2: ${error.message}`, debugLogs);
    return { success: false, error: error.message };
  }
}

/**
 * Call OpenAI API
 * @param {Object} config - Configuration object
 * @param {string} model - OpenAI model name
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {number} maxTokens - Maximum tokens (default 500)
 * @param {number} temperature - Temperature for AI response (default 0.7)
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function callOpenAI(config, model, systemPrompt, userPrompt, maxTokens = 500, temperature = 0.7, debugLogs = null) {
  const url = "https://api.openai.com/v1/chat/completions";
  
  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: maxTokens,
    temperature: temperature
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.openaiKey}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      logWithDebug(`ERROR: OpenAI API returned ${statusCode}`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      throw new Error(`OpenAI API error: ${statusCode} - ${responseText}`);
    }

    return JSON.parse(responseText);
  } catch (error) {
    logWithDebug(`ERROR calling OpenAI: ${error.message}`, debugLogs);
    throw error;
  }
}

/**
 * Update lead with Stage 2 analysis results
 * @param {Object} config - Configuration object
 * @param {string} leadId - Lead ID
 * @param {Object} analysisData - Analysis data to update
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function updateLeadWithAnalysis(config, leadId, analysisData, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/leads?id=eq.${leadId}`;
  
  const updateData = {
    relevance_score: analysisData.relevance_score,
    ai_analysis: analysisData.ai_analysis,
    opportunity_score: analysisData.opportunity_score,
    opportunity_type: analysisData.opportunity_type,
    opportunity_reason: analysisData.opportunity_reason,
    suggested_angle: analysisData.suggested_angle,
    ai_reply: analysisData.ai_reply,
    processing_status: 'ready',
    status: 'new' // Set to 'new' so it appears fresh on dashboard
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "PATCH",
      headers: {
        "apikey": config.supabaseKey,
        "Authorization": `Bearer ${config.supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      payload: JSON.stringify(updateData),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      logWithDebug("Lead updated successfully with analysis", debugLogs);
      return true;
    } else {
      const responseText = response.getContentText();
      logWithDebug(`ERROR updating lead: HTTP ${statusCode}`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return false;
    }
  } catch (error) {
    logWithDebug(`ERROR updating lead: ${error.message}`, debugLogs);
    return false;
  }
}

/**
 * Format timestamp for logging
 * @param {Date} date - Date object to format
 * @returns {string} Formatted timestamp string
 */
function formatTimestamp(date) {
  try {
    if (!date || !(date instanceof Date)) {
      Logger.log("formatTimestamp: Invalid date parameter");
      return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
    const formatted = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    // Ensure we always return a string
    return formatted || date.toISOString().replace('T', ' ').substring(0, 19);
  } catch (e) {
    Logger.log("formatTimestamp error: " + e.message);
    // Fallback to ISO string
    return date ? date.toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19);
  }
}

/**
 * Optional Setup function - Only use this if you haven't set Script Properties yet
 * 
 * NOTE: If you've already set your Script Properties manually, you don't need this function.
 * The code automatically reads from Script Properties in the getConfig() function.
 * 
 * To set properties manually: File > Project Settings > Script Properties
 */
function setupConfig() {
  const props = PropertiesService.getScriptProperties();
  
  // Only set these if they don't already exist
  // Replace with your actual values if using this function
  if (!props.getProperty("SUPABASE_URL")) {
    props.setProperty("SUPABASE_URL", "https://your-project.supabase.co");
  }
  if (!props.getProperty("SUPABASE_KEY")) {
    props.setProperty("SUPABASE_KEY", "your-supabase-SERVICE-ROLE-key"); // Must be service role key!
  }
  if (!props.getProperty("OPENAI_API_KEY")) {
    props.setProperty("OPENAI_API_KEY", "sk-your-openai-api-key");
  }
  
  logToSheet("⚠️ This function is optional if you've already set Script Properties manually.");
  logToSheet("⚠️ IMPORTANT: SUPABASE_KEY must be the SERVICE_ROLE_KEY (not anon key) to bypass RLS");
  logToSheet("The code automatically reads from Script Properties - no manual configuration needed in the code.");
}
