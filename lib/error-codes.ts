/**
 * Error Code System
 * 
 * This file maps internal technical errors to user-friendly error codes.
 * NEVER expose technical details (API keys, database errors, etc.) to users.
 * 
 * Error Code Format: ERR-XXX
 * - 100-199: Authentication & Authorization errors
 * - 200-299: Database & Data errors
 * - 300-399: Settings & Configuration errors
 * - 400-499: Notification & Integration errors
 * - 500-599: AI & Processing errors
 * - 900-999: Unknown/Unexpected errors
 */

export const ERROR_CODES = {
  // Authentication & Authorization (100-199)
  AUTH_REQUIRED: {
    code: "ERR-101",
    userMessage: "Please log in to continue",
    technicalReason: "User not authenticated",
  },
  AUTH_SESSION_EXPIRED: {
    code: "ERR-102",
    userMessage: "Your session has expired. Please log in again",
    technicalReason: "Auth session expired or invalid",
  },

  // Database & Data (200-299)
  DB_CONNECTION_FAILED: {
    code: "ERR-201",
    userMessage: "Unable to connect to database. Please try again",
    technicalReason: "Database connection error",
  },
  DB_QUERY_FAILED: {
    code: "ERR-202",
    userMessage: "Unable to save your changes. Please try again",
    technicalReason: "Database query failed",
  },
  DB_FETCH_FAILED: {
    code: "ERR-203",
    userMessage: "Unable to load data. Please refresh the page",
    technicalReason: "Database fetch operation failed",
  },
  DB_UPDATE_FAILED: {
    code: "ERR-204",
    userMessage: "Unable to update settings. Please try again",
    technicalReason: "Database update operation failed",
  },

  // Settings & Configuration (300-399)
  SETTINGS_SAVE_FAILED: {
    code: "ERR-301",
    userMessage: "Unable to save settings. Please try again",
    technicalReason: "Settings update failed",
  },
  SETTINGS_LOAD_FAILED: {
    code: "ERR-302",
    userMessage: "Unable to load settings. Please refresh the page",
    technicalReason: "Settings fetch failed",
  },
  INVALID_CONFIGURATION: {
    code: "ERR-303",
    userMessage: "Invalid configuration detected. Please check your settings",
    technicalReason: "Invalid settings configuration",
  },
  MISSING_REQUIRED_FIELD: {
    code: "ERR-304",
    userMessage: "Please fill in all required fields",
    technicalReason: "Required field missing",
  },

  // Notification & Integration (400-499)
  NOTIFICATION_SERVICE_UNAVAILABLE: {
    code: "ERR-401",
    userMessage: "Notification service is temporarily unavailable. Please try again later",
    technicalReason: "GAS worker/notification service unreachable",
  },
  WEBHOOK_TEST_FAILED: {
    code: "ERR-402",
    userMessage: "Webhook test failed. Please check your webhook URL",
    technicalReason: "Webhook test returned error",
  },
  WEBHOOK_INVALID_URL: {
    code: "ERR-403",
    userMessage: "Invalid webhook URL. Please check the format",
    technicalReason: "Webhook URL validation failed",
  },
  EMAIL_SERVICE_NOT_CONFIGURED: {
    code: "ERR-404",
    userMessage: "Email service is not configured. Please contact support",
    technicalReason: "RESEND_API_KEY missing or invalid",
  },
  EMAIL_TEST_FAILED: {
    code: "ERR-405",
    userMessage: "Unable to send test email. Please try again later",
    technicalReason: "Email test via Resend failed",
  },
  EMAIL_INVALID_ADDRESS: {
    code: "ERR-406",
    userMessage: "Invalid email address. Please check the format",
    technicalReason: "Email address validation failed",
  },
  SLACK_WEBHOOK_FAILED: {
    code: "ERR-407",
    userMessage: "Slack webhook test failed. Please verify your webhook URL",
    technicalReason: "Slack webhook test failed",
  },
  DISCORD_WEBHOOK_FAILED: {
    code: "ERR-408",
    userMessage: "Discord webhook test failed. Please verify your webhook URL",
    technicalReason: "Discord webhook test failed",
  },

  // AI & Processing (500-599)
  AI_SERVICE_ERROR: {
    code: "ERR-501",
    userMessage: "AI service is temporarily unavailable. Please try again",
    technicalReason: "OpenAI API error",
  },
  AI_RATE_LIMIT: {
    code: "ERR-502",
    userMessage: "Too many requests. Please wait a moment and try again",
    technicalReason: "AI service rate limit exceeded",
  },
  PROCESSING_FAILED: {
    code: "ERR-503",
    userMessage: "Processing failed. Please try again",
    technicalReason: "General processing error",
  },

  // Website Analysis (600-699)
  WEBSITE_UNREACHABLE: {
    code: "ERR-601",
    userMessage: "Unable to access website. Please check the URL",
    technicalReason: "Website URL unreachable",
  },
  WEBSITE_ANALYSIS_FAILED: {
    code: "ERR-602",
    userMessage: "Website analysis failed. Please try again",
    technicalReason: "Website content analysis failed",
  },

  // Onboarding (700-799)
  ONBOARDING_STEP_FAILED: {
    code: "ERR-701",
    userMessage: "Unable to complete onboarding step. Please try again",
    technicalReason: "Onboarding step save failed",
  },
  ONBOARDING_INCOMPLETE: {
    code: "ERR-702",
    userMessage: "Please complete previous steps first",
    technicalReason: "User tried to skip onboarding steps",
  },

  // Unknown/Unexpected (900-999)
  UNKNOWN_ERROR: {
    code: "ERR-999",
    userMessage: "Something went wrong. Please try again",
    technicalReason: "Unexpected error",
  },
} as const;

/**
 * Get user-friendly error message with code
 * @param errorKey - Key from ERROR_CODES
 * @param includeCode - Whether to append the error code (default: true)
 * @returns User-friendly error message
 */
export function getUserMessage(
  errorKey: keyof typeof ERROR_CODES,
  includeCode = true
): string {
  const error = ERROR_CODES[errorKey];
  if (includeCode) {
    return `${error.userMessage} (${error.code})`;
  }
  return error.userMessage;
}

/**
 * Log technical error details (server-side only)
 * @param errorKey - Key from ERROR_CODES
 * @param context - Additional context for logging
 */
export function logTechnicalError(
  errorKey: keyof typeof ERROR_CODES,
  context?: Record<string, any>
): void {
  const error = ERROR_CODES[errorKey];
  console.error(`[${error.code}] ${error.technicalReason}`, context || {});
}

/**
 * Create a standardized error response for server actions
 * @param errorKey - Key from ERROR_CODES
 * @param logContext - Additional context for server logs (not sent to client)
 * @returns Standardized error response
 */
export function createErrorResponse(
  errorKey: keyof typeof ERROR_CODES,
  logContext?: Record<string, any>
) {
  const error = ERROR_CODES[errorKey];
  
  // Log technical details server-side
  if (logContext) {
    logTechnicalError(errorKey, logContext);
  }
  
  // Return only user-friendly message
  return {
    success: false,
    error: getUserMessage(errorKey),
    errorCode: error.code,
  };
}
