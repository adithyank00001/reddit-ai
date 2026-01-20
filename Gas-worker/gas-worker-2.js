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
 * 4. UPDATE THE SHEET ID IN CODE:
 *    - Find the line in the logToSheet() function that says: 'YOUR_SHEET_ID_HERE'
 *    - Replace 'YOUR_SHEET_ID_HERE' with your actual Sheet ID from step 2
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
 * Log messages to Google Sheet for debugging
 * @param {string|Object} message - The message to log (string or object)
 */
function logToSheet(message) {
  try {
    // Container-bound script: Access the spreadsheet this script is bound to
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create the 'Logs' sheet
    let sheet = spreadsheet.getSheetByName('Logs');
    if (!sheet) {
      // Create the sheet if it doesn't exist
      sheet = spreadsheet.insertSheet('Logs');
      // Add header row
      sheet.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Message']]);
      // Make header row bold
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    }
    
    // Format the message
    let messageText;
    if (typeof message === 'object') {
      messageText = JSON.stringify(message);
    } else {
      messageText = String(message);
    }
    
    // Create timestamp
    const timestamp = formatTimestamp(new Date());
    
    // Append the log entry
    sheet.appendRow([timestamp, messageText]);
    
  } catch (error) {
    // Silent fail - don't break the webhook if logging fails
    // Logging errors are ignored to prevent breaking the main functionality
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
  // Log to Google Sheet (existing functionality)
  logToSheet(message);
  
  // Also add to debug array for response if provided
  if (debugLogs && Array.isArray(debugLogs)) {
    // Format message for debug array
    let messageText;
    if (typeof message === 'object') {
      messageText = JSON.stringify(message);
    } else {
      messageText = String(message);
    }
    debugLogs.push(messageText);
  }
}

/**
 * Test endpoint - GET request to verify web app is accessible
 * Visit your web app URL in a browser to test
 * @param {Object} e - Event object from Google Apps Script web app
 */
function doGet(e) {
  const timestamp = formatTimestamp(new Date());
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
 */
function testSheetLogging() {
  logToSheet("=== MANUAL TEST ===");
  logToSheet("Test message 1: Sheet logging is working!");
  logToSheet("Test message 2: Timestamp formatting works");
  logToSheet("Test message 3: Object logging test");
  logToSheet({ test: "object", number: 123, boolean: true });
  logToSheet("=== MANUAL TEST COMPLETE ===");
  logToSheet("If you see these messages in your Google Sheet, logging is working correctly!");
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
  } catch (e) {
    Logger.log("❌ Permission error: " + e.message);
  }
}

/**
 * Webhook entry point - called by Supabase when a new lead is inserted
 * @param {Object} e - Event object from Google Apps Script web app
 */
function doPost(e) {
  // Initialize debug logs array for dual logging
  const debugLogs = [];
  const startTime = new Date();
  logWithDebug(`[${formatTimestamp(startTime)}] Worker 2 (The Brain) - Webhook received`, debugLogs);

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

    // Extract lead information from webhook
    // Supabase webhook format: { type: 'INSERT', table: 'leads', record: {...} }
    const lead = payload.record || payload;
    const leadId = lead.id;
    const title = lead.title;
    const body = lead.body;

    if (!leadId || !title) {
      logWithDebug(`ERROR: Missing required fields in webhook payload`, debugLogs);
      logWithDebug(`Payload: ${JSON.stringify(payload)}`, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing required fields (id, title)",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`Processing lead: ${leadId}`, debugLogs);
    logWithDebug(`Title: ${title.substring(0, 50)}...`, debugLogs);

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

    // Step 1: Fetch product context from database
    logWithDebug("Fetching product context...", debugLogs);
    const productContext = fetchProductContext(config, debugLogs);
    if (!productContext) {
      logWithDebug("ERROR: Could not fetch product context", debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Could not fetch product context",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`Product context: ${productContext.substring(0, 100)}...`, debugLogs);

    // Step 2: Lock the record by setting processing_status to 'processing'
    logWithDebug("Locking lead record...", debugLogs);
    const lockResult = updateLeadStatus(config, leadId, 'processing', lead.status || 'new', debugLogs);
    if (!lockResult) {
      logWithDebug("ERROR: Failed to lock lead record", debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Failed to lock lead record",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Step 3: Stage 1 - Binary Relevance Filter
    logWithDebug("\n=== Stage 1: Binary Relevance Check ===", debugLogs);
    const stage1Result = stage1BinaryRelevance(config, title, body, productContext, debugLogs);
    
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

    // Step 4: Stage 2 - Sales Intelligence Generation
    logWithDebug("\n=== Stage 2: Sales Intelligence Analysis ===", debugLogs);
    const stage2Result = stage2SalesIntelligence(config, title, body, productContext, debugLogs);
    
    if (!stage2Result.success) {
      logWithDebug(`ERROR in Stage 2: ${stage2Result.error}`, debugLogs);
      updateLeadStatus(config, leadId, 'error', 'error', debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: stage2Result.error,
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Step 5: Update database with Stage 2 results
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
    logWithDebug(`\n[${formatTimestamp(endTime)}] Worker 2 completed successfully`, debugLogs);
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
 * Fetch product_context from project_settings table
 * @param {Object} config - Configuration object
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function fetchProductContext(config, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/project_settings?id=eq.1&select=product_context`;
  
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
      logWithDebug("No project_settings found with id=1", debugLogs);
      return null;
    }

    return result[0].product_context || null;
  } catch (error) {
    logWithDebug(`ERROR fetching product context: ${error.message}`, debugLogs);
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
 * Uses GPT-4o-mini to determine if the post has any potential for sales/marketing/feedback
 * Note: Using gpt-4o-mini as "gpt-4.1-nano" doesn't exist. This is the most cost-effective option.
 * @param {Object} config - Configuration object
 * @param {string} title - Post title
 * @param {string} body - Post body
 * @param {string} productContext - Product context
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function stage1BinaryRelevance(config, title, body, productContext, debugLogs = null) {
  const systemPrompt = "Answer ONLY 'Yes' or 'No'.";
  
  const userPrompt = `Determine if this Reddit post has any potential for sales, marketing, or feedback for a product with this context:

${productContext}

Post Title: ${title}
Post Body: ${body}

Does this post have any potential for sales, marketing, or feedback? Answer ONLY 'Yes' or 'No'.`;

  try {
    const response = callOpenAI(config, "gpt-4o-mini", systemPrompt, userPrompt, 10, debugLogs); // Low max_tokens for binary response
    
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
 * Uses GPT-4o-mini to generate detailed analysis and scoring
 * @param {Object} config - Configuration object
 * @param {string} title - Post title
 * @param {string} body - Post body
 * @param {string} productContext - Product context
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function stage2SalesIntelligence(config, title, body, productContext, debugLogs = null) {
  const systemPrompt = "You are a sales intelligence analyst. Analyze Reddit posts and provide structured JSON responses with sales opportunity insights.";

  const userPrompt = `Analyze this Reddit post deeply and provide a JSON response with these exact keys:
- "relevance_score": (0-100) - How relevant is this to the business context?
- "ai_analysis": (1-2 sentences) - Why does this fit the business?
- "opportunity_score": (0-100) - Prioritizing actual buying intent
- "opportunity_type": (e.g., "direct_buying", "problem_awareness", "competitor_switch", "feedback_seeker", "community_engagement")
- "opportunity_reason": (Concise reason why this is an opportunity)
- "suggested_angle": (A 1-sentence strategic tip on how to approach this user)
- "ai_reply": (A humanized, non-salesy, helpful 2-3 sentence Reddit comment draft)

Product Context: ${productContext}

Post Title: ${title}
Post Body: ${body}

Return ONLY valid JSON with these exact keys. No markdown, no code blocks, just the JSON object.`;

  try {
    const response = callOpenAI(config, "gpt-4o-mini", systemPrompt, userPrompt, 500, debugLogs);
    
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
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function callOpenAI(config, model, systemPrompt, userPrompt, maxTokens = 500, debugLogs = null) {
  const url = "https://api.openai.com/v1/chat/completions";
  
  const payload = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.7
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
 */
function formatTimestamp(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
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
