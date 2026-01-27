# Error Codes Reference

This document provides a complete reference of all error codes used in the Reddit Lead Gen application.

## Why Error Codes?

Error codes protect your application by:
- **Hiding technical details** from users (no exposed API keys, database errors, etc.)
- **Improving security** by not revealing system internals
- **Better debugging** with standardized error tracking
- **Better user experience** with clear, actionable messages

## Error Code Format

All error codes follow the format: `ERR-XXX`

### Categories

| Range | Category | Description |
|-------|----------|-------------|
| 100-199 | Authentication & Authorization | Login, session, and permission errors |
| 200-299 | Database & Data | Database connection and query errors |
| 300-399 | Settings & Configuration | Settings save/load errors |
| 400-499 | Notification & Integration | Webhook, email, and external service errors |
| 500-599 | AI & Processing | OpenAI and processing errors |
| 600-699 | Website Analysis | Website scraping and analysis errors |
| 700-799 | Onboarding | Onboarding flow errors |
| 900-999 | Unknown | Unexpected errors |

---

## Complete Error Code List

### Authentication & Authorization (100-199)

#### ERR-101: Please log in to continue
**What it means:** User is not authenticated or session is missing.  
**Technical reason:** User not authenticated  
**User action:** Log in to the application  
**Developer action:** Check auth middleware and session management

#### ERR-102: Your session has expired. Please log in again
**What it means:** User's authentication session has expired.  
**Technical reason:** Auth session expired or invalid  
**User action:** Log in again  
**Developer action:** Check session expiration settings in Supabase

---

### Database & Data (200-299)

#### ERR-201: Unable to connect to database. Please try again
**What it means:** Cannot establish connection to database.  
**Technical reason:** Database connection error  
**User action:** Try again in a few moments  
**Developer action:** Check Supabase connection, verify SUPABASE_URL and keys

#### ERR-202: Unable to save your changes. Please try again
**What it means:** Database query failed during save operation.  
**Technical reason:** Database query failed  
**User action:** Try saving again  
**Developer action:** Check database logs, verify RLS policies

#### ERR-203: Unable to load data. Please refresh the page
**What it means:** Failed to fetch data from database.  
**Technical reason:** Database fetch operation failed  
**User action:** Refresh the page  
**Developer action:** Check database query, verify table permissions

#### ERR-204: Unable to update settings. Please try again
**What it means:** Database update operation failed.  
**Technical reason:** Database update operation failed  
**User action:** Try updating again  
**Developer action:** Check update query, verify column exists, check RLS

---

### Settings & Configuration (300-399)

#### ERR-301: Unable to save settings. Please try again
**What it means:** Failed to save user settings.  
**Technical reason:** Settings update failed  
**User action:** Try again  
**Developer action:** Check `updateSettings` server action logs

#### ERR-302: Unable to load settings. Please refresh the page
**What it means:** Failed to load user settings.  
**Technical reason:** Settings fetch failed  
**User action:** Refresh the page  
**Developer action:** Check `getSettings` server action logs

#### ERR-303: Invalid configuration detected. Please check your settings
**What it means:** Settings validation failed.  
**Technical reason:** Invalid settings configuration  
**User action:** Review and correct settings  
**Developer action:** Check validation logic in settings forms

#### ERR-304: Please fill in all required fields
**What it means:** User missed required fields in form.  
**Technical reason:** Required field missing  
**User action:** Complete all required fields  
**Developer action:** Check form validation

---

### Notification & Integration (400-499)

#### ERR-401: Notification service is temporarily unavailable. Please try again later
**What it means:** Cannot reach Google Apps Script worker.  
**Technical reason:** GAS worker/notification service unreachable  
**User action:** Wait and try again later  
**Developer action:** Check GAS_WEBHOOK_URL, verify Worker 3 deployment

#### ERR-402: Webhook test failed. Please check your webhook URL
**What it means:** Webhook test returned an error.  
**Technical reason:** Webhook test returned error  
**User action:** Verify webhook URL is correct  
**Developer action:** Check Worker 3 logs for webhook test details

#### ERR-403: Invalid webhook URL. Please check the format
**What it means:** Webhook URL format is invalid.  
**Technical reason:** Webhook URL validation failed  
**User action:** Enter a valid webhook URL  
**Developer action:** Check URL validation regex

#### ERR-404: Email service is not configured. Please contact support
**What it means:** Resend API key is missing or invalid.  
**Technical reason:** RESEND_API_KEY missing or invalid  
**User action:** Contact support  
**Developer action:** Check Worker 3 Script Properties, verify RESEND_API_KEY is set

#### ERR-405: Unable to send test email. Please try again later
**What it means:** Email test via Resend failed.  
**Technical reason:** Email test via Resend failed  
**User action:** Try again later  
**Developer action:** Check Worker 3 logs, verify Resend API key, check Resend dashboard

#### ERR-406: Invalid email address. Please check the format
**What it means:** Email address format is invalid.  
**Technical reason:** Email address validation failed  
**User action:** Enter a valid email address  
**Developer action:** Check email validation logic

#### ERR-407: Slack webhook test failed. Please verify your webhook URL
**What it means:** Slack webhook test did not succeed.  
**Technical reason:** Slack webhook test failed  
**User action:** Check Slack webhook URL in Slack settings  
**Developer action:** Check Worker 3 logs, verify Slack webhook format

#### ERR-408: Discord webhook test failed. Please verify your webhook URL
**What it means:** Discord webhook test did not succeed.  
**Technical reason:** Discord webhook test failed  
**User action:** Check Discord webhook URL in Discord server settings  
**Developer action:** Check Worker 3 logs, verify Discord webhook format

---

### AI & Processing (500-599)

#### ERR-501: AI service is temporarily unavailable. Please try again
**What it means:** OpenAI API error.  
**Technical reason:** OpenAI API error  
**User action:** Try again in a few moments  
**Developer action:** Check OpenAI status, verify OPENAI_API_KEY

#### ERR-502: Too many requests. Please wait a moment and try again
**What it means:** Rate limit exceeded.  
**Technical reason:** AI service rate limit exceeded  
**User action:** Wait a moment and try again  
**Developer action:** Implement rate limiting, upgrade OpenAI plan

#### ERR-503: Processing failed. Please try again
**What it means:** General processing error.  
**Technical reason:** General processing error  
**User action:** Try again  
**Developer action:** Check application logs for stack trace

---

### Website Analysis (600-699)

#### ERR-601: Unable to access website. Please check the URL
**What it means:** Cannot reach the provided website URL.  
**Technical reason:** Website URL unreachable  
**User action:** Verify the website URL is correct and accessible  
**Developer action:** Check website analyzer logs, verify URL is reachable

#### ERR-602: Website analysis failed. Please try again
**What it means:** Failed to analyze website content.  
**Technical reason:** Website content analysis failed  
**User action:** Try again  
**Developer action:** Check website analyzer logs, verify OpenAI API

---

### Onboarding (700-799)

#### ERR-701: Unable to complete onboarding step. Please try again
**What it means:** Failed to save onboarding step progress.  
**Technical reason:** Onboarding step save failed  
**User action:** Try completing the step again  
**Developer action:** Check onboarding action logs

#### ERR-702: Please complete previous steps first
**What it means:** User tried to skip required onboarding steps.  
**Technical reason:** User tried to skip onboarding steps  
**User action:** Complete previous steps first  
**Developer action:** Check onboarding step validation

---

### Unknown (900-999)

#### ERR-999: Something went wrong. Please try again
**What it means:** Unexpected error occurred.  
**Technical reason:** Unexpected error  
**User action:** Try again or contact support  
**Developer action:** Check application logs for full error details

---

## For Developers

### How to Use Error Codes

```typescript
import { createErrorResponse, ERROR_CODES } from "@/lib/error-codes";

// In a server action
export async function myServerAction() {
  try {
    // ... your code
  } catch (error) {
    // Log technical details server-side, return user-friendly message
    return createErrorResponse("DB_QUERY_FAILED", {
      error: error.message,
      stack: error.stack,
    });
  }
}
```

### Adding New Error Codes

1. Open `lib/error-codes.ts`
2. Add new error to `ERROR_CODES` object in appropriate category
3. Update this documentation file with the new error
4. Use the error in your code with `createErrorResponse`

### Best Practices

- **NEVER** expose technical details (API keys, database errors, stack traces) in user messages
- **ALWAYS** log technical details server-side for debugging
- **ALWAYS** use `createErrorResponse` in server actions
- **ALWAYS** use `getUserMessage` in UI components
- **ALWAYS** update this documentation when adding new error codes

---

## Troubleshooting by Error Code

### Quick Reference

| Error Code | Quick Fix |
|------------|-----------|
| ERR-101, ERR-102 | Check if user is logged in |
| ERR-201, ERR-203 | Check Supabase connection and credentials |
| ERR-202, ERR-204 | Check database RLS policies and permissions |
| ERR-401 | Check GAS_WEBHOOK_URL in .env.local |
| ERR-404 | Set RESEND_API_KEY in Worker 3 Script Properties |
| ERR-405 | Check Resend dashboard for email delivery status |
| ERR-407, ERR-408 | Verify webhook URLs in Slack/Discord |
| ERR-501 | Check OpenAI API status and OPENAI_API_KEY |
| ERR-999 | Check application logs for full error details |

---

## Support

If you encounter an error code not documented here or need help debugging:
1. Check application logs (server-side) for technical details
2. Check Worker 3 logs in Google Apps Script
3. Check Supabase logs in Supabase dashboard
4. Review this documentation for the error code
