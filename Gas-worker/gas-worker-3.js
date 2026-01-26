/**
 * Worker 3: The Notification Service - Google Apps Script
 * 
 * This script receives webhooks from Supabase when leads are UPDATED,
 * then sends notifications (Slack, Discord, Email) only when AI processing is complete.
 * 
 * Configuration (set via PropertiesService):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_KEY: Supabase Service Role key (required to bypass RLS)
 * 
 * Deployment:
 * 1. Deploy as Web App: Publish > Deploy as web app
 * 2. Set "Execute as: Me" and "Who has access: Anyone"
 * 3. Copy the web app URL
 * 4. Use this URL in Supabase Database Webhooks (UPDATE trigger on leads table)
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
 *    - Name it something like "Worker 3 Logs" or "Notification Logs"
 * 
 * 2. GET YOUR SHEET ID:
 *    - Open your Google Sheet
 *    - Look at the URL in your browser
 *    - The URL will look like: https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
 *    - Copy the SHEET_ID_HERE part (it's a long string of letters and numbers)
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
      const stack = new Error().stack;
      const caller = stack ? stack.split('\n')[2] : "unknown";
      Logger.log("logToSheet: Warning - called with undefined/null message");
      Logger.log("Called from: " + caller);
      message = "[No message provided - check Execution log for caller]";
    }
    
    // Container-bound script: Access the spreadsheet this script is bound to
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!spreadsheet) {
      Logger.log("logToSheet: No active spreadsheet found");
      return;
    }
    
    // Get or create the 'Logs' sheet
    let sheet = spreadsheet.getSheetByName('Logs');
    if (!sheet) {
      try {
        sheet = spreadsheet.insertSheet('Logs');
        sheet.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Message']]);
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
      
      if (!messageText || messageText.trim() === '') {
        messageText = "[Empty message]";
      }
    } catch (formatError) {
      messageText = "[Error formatting message: " + formatError.message + "]";
    }
    
    // Create timestamp
    let timestamp;
    try {
      timestamp = formatTimestampForLog(new Date());
    } catch (timeError) {
      timestamp = new Date().toISOString();
    }
    
    // Append the log entry
    try {
      sheet.appendRow([timestamp, messageText]);
      Logger.log("logToSheet: Successfully logged - " + messageText.substring(0, 50));
    } catch (appendError) {
      Logger.log("logToSheet: Failed to append row - " + appendError.message);
    }
    
  } catch (error) {
    try {
      Logger.log("ERROR in logToSheet: " + error.message);
      Logger.log("Stack: " + error.stack);
    } catch (e) {
      // If even Logger fails, we can't do anything
    }
  }
}

/**
 * Dual logging function - logs to both sheet and debug array
 * @param {string|Object} message - The message to log (string or object)
 * @param {Array} debugLogs - Array to store debug logs for response (optional)
 */
function logWithDebug(message, debugLogs = null) {
  if (message === undefined || message === null) {
    message = "[logWithDebug called with undefined/null]";
  }
  
  // Log to Google Sheet
  logToSheet(message);
  
  // Also add to debug array for response if provided
  if (debugLogs && Array.isArray(debugLogs)) {
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
    return formatted || date.toISOString().replace('T', ' ').substring(0, 19);
  } catch (e) {
    Logger.log("formatTimestamp error: " + e.message);
    return date ? date.toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19);
  }
}

/**
 * Webhook entry point - called by Supabase when a lead is UPDATED
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
    timestampStr = formatTimestampForLog(startTime);
  }
  
  logWithDebug(`[${timestampStr}] Worker 3 (The Notification Service) - Webhook received`, debugLogs);

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

    // ============================================================================
    // TEST MODE: Handle test webhook requests (bypasses database)
    // ============================================================================
    if (payload.test === true) {
      logWithDebug("Test webhook request received", debugLogs);
      
      const webhookUrl = payload.webhookUrl;
      const type = payload.type; // "slack" or "discord"
      
      if (!webhookUrl || !type) {
        logWithDebug("ERROR: Missing webhookUrl or type in test payload", debugLogs);
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Missing webhookUrl or type in test payload",
          debug_logs: debugLogs
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      logWithDebug(`Test notification: type=${type}, webhookUrl=${webhookUrl.substring(0, 50)}...`, debugLogs);
      
      // Create test notification message (same format as production)
      const testMessage = {
        text: "🧪 Test message from Reddit Lead Gen - Your webhook is working!",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🧪 Test Notification"
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "This is a test message to verify your webhook is configured correctly. If you see this, your notification system is working!"
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*Test Type:*\nWebhook Configuration Test"
              },
              {
                type: "mrkdwn",
                text: "*Status:*\n✅ Working"
              }
            ]
          }
        ]
      };
      
      // Send test notification using the same functions as production
      let result = false;
      let errorMessage = null;
      
      try {
        if (type === "slack") {
          logWithDebug("Sending test Slack notification...", debugLogs);
          result = sendSlackNotification(webhookUrl, testMessage, debugLogs);
        } else if (type === "discord") {
          logWithDebug("Sending test Discord notification...", debugLogs);
          result = sendDiscordNotification(webhookUrl, testMessage, debugLogs);
        } else {
          errorMessage = `Invalid type: ${type}. Must be 'slack' or 'discord'`;
          logWithDebug(`ERROR: ${errorMessage}`, debugLogs);
        }
      } catch (error) {
        errorMessage = error.message;
        logWithDebug(`ERROR sending test notification: ${errorMessage}`, debugLogs);
      }
      
      if (result) {
        logWithDebug("✓ Test notification sent successfully", debugLogs);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Test notification sent successfully",
          debug_logs: debugLogs
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        logWithDebug("✗ Test notification failed", debugLogs);
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: errorMessage || "Failed to send test notification",
          debug_logs: debugLogs
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Extract record from webhook
    // Supabase UPDATE webhook format: { type: 'UPDATE', table: 'leads', record: {...}, old_record: {...} }
    const record = payload.record || payload;
    
    if (!record) {
      logWithDebug(`ERROR: Missing record in webhook payload`, debugLogs);
      logWithDebug(`Payload: ${JSON.stringify(payload)}`, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing record in payload",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const leadId = record.id;
    const processingStatus = record.processing_status;
    const notificationSent = record.notification_sent;

    if (!leadId) {
      logWithDebug(`ERROR: Missing lead ID in webhook payload`, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing required field (id)",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`Processing lead: ${leadId}`, debugLogs);
    logWithDebug(`Processing status: ${processingStatus}`, debugLogs);
    logWithDebug(`Notification sent: ${notificationSent}`, debugLogs);

    // ============================================================================
    // STRICT GATEKEEPING - The "Ready" Check
    // ============================================================================
    
    // Gatekeeping Check 1: Is processing_status === 'ready'?
    if (processingStatus !== 'ready') {
      logWithDebug(`SKIP: Processing status is '${processingStatus}', not 'ready'. Exiting.`, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        skipped: true,
        reason: `Processing status is '${processingStatus}', not 'ready'`,
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Gatekeeping Check 2: Is notification_sent === false?
    if (notificationSent === true) {
      logWithDebug(`SKIP: Notification already sent for lead ${leadId}. Exiting.`, debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        skipped: true,
        reason: "Notification already sent",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`✓ Gatekeeping passed: Lead is ready and notification not sent`, debugLogs);

    // Get configuration
    const config = getConfig(debugLogs);
    if (!config) {
      logWithDebug("ERROR: Configuration missing", debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Configuration missing",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Extract alert_id from record
    const alertId = record.alert_id;
    if (!alertId) {
      logWithDebug("ERROR: Missing alert_id in lead record", debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Missing alert_id in lead record",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Fetch user_id from alert
    logWithDebug("Resolving user from alert...", debugLogs);
    const userId = fetchUserIdFromAlert(config, alertId, debugLogs);
    if (!userId) {
      logWithDebug("ERROR: Could not resolve user from alert", debugLogs);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Could not resolve user from alert",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`User ID: ${userId}`, debugLogs);

    // Fetch notification settings from project_settings
    logWithDebug("Fetching notification settings from project_settings...", debugLogs);
    const notificationSettings = fetchNotificationSettings(config, userId, debugLogs);
    if (!notificationSettings) {
      logWithDebug("WARNING: No notification settings found for user", debugLogs);
      // Not an error - user might not have configured notifications
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        skipped: true,
        reason: "No notification settings found",
        debug_logs: debugLogs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    logWithDebug(`Notification settings found:`, debugLogs);
    logWithDebug(`  Email enabled: ${notificationSettings.email_notifications_enabled}`, debugLogs);
    logWithDebug(`  Slack enabled: ${notificationSettings.slack_notifications_enabled}`, debugLogs);
    logWithDebug(`  Discord enabled: ${notificationSettings.discord_notifications_enabled}`, debugLogs);

    // Prepare notification message
    const leadTitle = record.title || "Untitled";
    const leadSubreddit = record.subreddit || "unknown";
    const leadUrl = record.url || "";
    const relevanceScore = record.relevance_score || 0;
    const opportunityScore = record.opportunity_score || 0;
    const opportunityType = record.opportunity_type || "unknown";

    const notificationMessage = {
      text: `🎯 New Lead Ready: ${leadTitle}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎯 New Lead Ready"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Title:*\n${leadTitle}`
            },
            {
              type: "mrkdwn",
              text: `*Subreddit:*\nr/${leadSubreddit}`
            },
            {
              type: "mrkdwn",
              text: `*Relevance Score:*\n${relevanceScore}/100`
            },
            {
              type: "mrkdwn",
              text: `*Opportunity Score:*\n${opportunityScore}/100`
            },
            {
              type: "mrkdwn",
              text: `*Opportunity Type:*\n${opportunityType}`
            }
          ]
        }
      ]
    };

    // Add link if URL exists
    if (leadUrl) {
      notificationMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${leadUrl}|View on Reddit>`
        }
      });
    }

    let notificationsSent = 0;
    let notificationsFailed = 0;

    // Send Slack notification if enabled
    if (notificationSettings.slack_notifications_enabled === true && notificationSettings.slack_webhook_url) {
      logWithDebug("Sending Slack notification...", debugLogs);
      const slackResult = sendSlackNotification(notificationSettings.slack_webhook_url, notificationMessage, debugLogs);
      if (slackResult) {
        notificationsSent++;
        logWithDebug("✓ Slack notification sent successfully", debugLogs);
      } else {
        notificationsFailed++;
        logWithDebug("✗ Slack notification failed", debugLogs);
      }
    } else {
      logWithDebug("Slack notifications disabled or webhook URL missing", debugLogs);
    }

    // Send Discord notification if enabled
    if (notificationSettings.discord_notifications_enabled === true && notificationSettings.discord_webhook_url) {
      logWithDebug("Sending Discord notification...", debugLogs);
      const discordResult = sendDiscordNotification(notificationSettings.discord_webhook_url, notificationMessage, debugLogs);
      if (discordResult) {
        notificationsSent++;
        logWithDebug("✓ Discord notification sent successfully", debugLogs);
      } else {
        notificationsFailed++;
        logWithDebug("✗ Discord notification failed", debugLogs);
      }
    } else {
      logWithDebug("Discord notifications disabled or webhook URL missing", debugLogs);
    }

    // Email notifications (placeholder - can be implemented later)
    if (notificationSettings.email_notifications_enabled === true) {
      logWithDebug("Email notifications enabled (not yet implemented)", debugLogs);
      // TODO: Implement email sending logic here
    }

    // Update lead record: set notification_sent = true
    logWithDebug("Marking notification as sent...", debugLogs);
    const updateResult = updateNotificationSent(config, leadId, debugLogs);
    
    if (!updateResult) {
      logWithDebug("WARNING: Failed to mark notification as sent", debugLogs);
      // Continue anyway - notification was sent even if we couldn't update the flag
    } else {
      logWithDebug("✓ Notification flag updated successfully", debugLogs);
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    let endTimestampStr;
    try {
      endTimestampStr = formatTimestamp(endTime);
    } catch (e) {
      endTimestampStr = formatTimestampForLog(endTime);
    }
    
    logWithDebug(`\n[${endTimestampStr}] Worker 3 completed`, debugLogs);
    logWithDebug(`Duration: ${duration.toFixed(2)}s`, debugLogs);
    logWithDebug(`Notifications sent: ${notificationsSent}, failed: ${notificationsFailed}`, debugLogs);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      notificationsSent: notificationsSent,
      notificationsFailed: notificationsFailed,
      debug_logs: debugLogs
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    logWithDebug(`FATAL ERROR: ${error.message}`, debugLogs);
    logWithDebug(error.stack, debugLogs);
    
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
 * 
 * @param {Array} debugLogs - Optional array to store debug logs
 */
function getConfig(debugLogs = null) {
  const props = PropertiesService.getScriptProperties();
  
  const supabaseUrl = props.getProperty("SUPABASE_URL");
  const supabaseKey = props.getProperty("SUPABASE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    logWithDebug("Missing configuration properties:", debugLogs);
    logWithDebug(`  SUPABASE_URL: ${supabaseUrl ? "✓" : "✗"}`, debugLogs);
    logWithDebug(`  SUPABASE_KEY: ${supabaseKey ? "✓" : "✗"}`, debugLogs);
    logWithDebug("Please set these in: File > Project Settings > Script Properties", debugLogs);
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseKey: supabaseKey.trim(),
  };
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
 * Fetch notification settings from project_settings table using user_id
 * @param {Object} config - Configuration object
 * @param {string} userId - User ID
 * @param {Array} debugLogs - Optional array to store debug logs
 * @returns {Object|null} Notification settings object or null if not found
 */
function fetchNotificationSettings(config, userId, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/project_settings?user_id=eq.${userId}&select=slack_webhook_url,discord_webhook_url,email_notifications_enabled,slack_notifications_enabled,discord_notifications_enabled`;
  
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

    return result[0];
  } catch (error) {
    logWithDebug(`ERROR fetching notification settings: ${error.message}`, debugLogs);
    return null;
  }
}

/**
 * Send Slack notification via webhook
 * @param {string} webhookUrl - Slack webhook URL
 * @param {Object} message - Message object with text and blocks
 * @param {Array} debugLogs - Optional array to store debug logs
 * @returns {boolean} True if successful, false otherwise
 */
function sendSlackNotification(webhookUrl, message, debugLogs = null) {
  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(message),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    if (statusCode === 200) {
      return true;
    } else {
      const responseText = response.getContentText();
      logWithDebug(`ERROR: Slack webhook returned ${statusCode}`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return false;
    }
  } catch (error) {
    logWithDebug(`ERROR sending Slack notification: ${error.message}`, debugLogs);
    return false;
  }
}

/**
 * Send Discord notification via webhook
 * @param {string} webhookUrl - Discord webhook URL
 * @param {Object} message - Message object with text and blocks
 * @param {Array} debugLogs - Optional array to store debug logs
 * @returns {boolean} True if successful, false otherwise
 */
function sendDiscordNotification(webhookUrl, message, debugLogs = null) {
  try {
    // Discord webhooks accept Slack-compatible format if we append /slack to the URL
    // Or we can send a simpler format
    let discordUrl = webhookUrl;
    if (!discordUrl.endsWith("/slack")) {
      discordUrl = `${discordUrl}/slack`;
    }

    // Convert Slack blocks format to Discord-compatible format
    // Discord webhooks with /slack endpoint accept Slack format
    const discordPayload = {
      text: message.text,
      blocks: message.blocks
    };

    const response = UrlFetchApp.fetch(discordUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(discordPayload),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    if (statusCode === 200 || statusCode === 204) {
      return true;
    } else {
      const responseText = response.getContentText();
      logWithDebug(`ERROR: Discord webhook returned ${statusCode}`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return false;
    }
  } catch (error) {
    logWithDebug(`ERROR sending Discord notification: ${error.message}`, debugLogs);
    return false;
  }
}

/**
 * Update lead record to mark notification as sent
 * @param {Object} config - Configuration object
 * @param {string} leadId - Lead ID
 * @param {Array} debugLogs - Optional array to store debug logs
 * @returns {boolean} True if successful, false otherwise
 */
function updateNotificationSent(config, leadId, debugLogs = null) {
  const url = `${config.supabaseUrl}/rest/v1/leads?id=eq.${leadId}`;
  
  const updateData = {
    notification_sent: true
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
      logWithDebug(`ERROR updating notification_sent: HTTP ${statusCode}`, debugLogs);
      logWithDebug(`Response: ${responseText}`, debugLogs);
      return false;
    }
  } catch (error) {
    logWithDebug(`ERROR updating notification_sent: ${error.message}`, debugLogs);
    return false;
  }
}
