# Resend Email Notifications - Setup Guide

## What Was Added

Worker 3 (The Notification Service) now supports sending beautiful HTML email notifications via Resend API when new leads are ready. Each notification channel (Slack, Discord, Email) works independently—if one fails, the others still work.

## Setup Steps

### 1. Get Your Resend API Key

1. Go to [resend.com](https://resend.com) and sign up/login
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**
4. Copy the key (starts with `re_...`)

### 2. Verify Your Domain (Optional but Recommended)

By default, emails are sent from `notifications@resend.dev`. For production:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Add your domain (e.g., `yourdomain.com`) or a subdomain (recommended: `mail.yourdomain.com`)
4. Add the DNS records Resend provides (SPF and DKIM)
5. Wait for verification (can take up to 72 hours)
6. Once verified, update line 930 in `gas-worker-3.js`:
   ```javascript
   from: "Reddit Lead Gen <notifications@yourdomain.com>"
   ```

### 3. Configure Google Apps Script

1. Open your Google Apps Script project (Worker 3)
2. Go to **Project Settings** (gear icon)
3. Scroll to **Script Properties**
4. Click **Add script property**
5. Add:
   - **Property**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (from step 1)
6. Click **Save**

### 4. Test the Integration

1. Open `gas-worker-3.js` in the Apps Script editor
2. Find the `testResendConnection()` function (around line 970)
3. Update this line:
   ```javascript
   const TEST_EMAIL = "your-email@example.com"; // ⚠️ UPDATE THIS
   ```
4. Click **Run** → Select `testResendConnection`
5. Grant permissions if asked
6. Check **View** → **Logs** for results
7. Check your email inbox for the test email

### 5. Update Database Settings

Users need a `notification_email` column in the `project_settings` table. If it doesn't exist:

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS notification_email TEXT;
```

### 6. Enable Email Notifications for Users

Users can enable email notifications in their settings by:
1. Going to Settings → Notifications
2. Toggling "Email Notifications" ON
3. Entering their email address
4. Saving settings

## How It Works

When a lead is marked as "Ready" (`processing_status = 'ready'`):

1. Worker 3 receives the webhook from Supabase
2. Fetches user's notification settings
3. Sends notifications to enabled channels **independently**:
   - ✅ If Slack is enabled → sends Slack message (even if Discord fails)
   - ✅ If Discord is enabled → sends Discord message (even if Email fails)
   - ✅ If Email is enabled → sends Resend email (even if Slack fails)
4. Marks `notification_sent = true` in the database

## Email Content

The email includes:
- 🎯 Lead title
- Subreddit name
- Relevance score (0-100)
- Opportunity score (0-100)
- Opportunity type
- Direct link to Reddit post (clickable button)

## Troubleshooting

### "RESEND_API_KEY not found"
- Make sure you added the API key to Script Properties (not Project Properties)
- The key should be named exactly `RESEND_API_KEY` (case-sensitive)

### "Email notification skipped: RESEND_API_KEY not configured"
- The API key is missing or empty in Script Properties
- Add it following step 3 above

### "Resend API returned 403"
- Your API key is invalid or expired
- Generate a new API key from Resend dashboard

### "Resend API returned 422"
- Your email format is invalid
- If using a custom domain, make sure it's verified in Resend

### Test email not arriving
- Check spam/junk folder
- Check Resend dashboard → **Emails** to see delivery status
- Verify the email address in the test function is correct

## Cost

Resend Free Plan:
- 3,000 emails/month
- 100 emails/day
- Perfect for testing and small projects

Paid plans start at $20/month for 50,000 emails.

## Security Notes

- Never commit your `RESEND_API_KEY` to Git
- Use Script Properties to store it securely
- The API key is only accessible to your Google Apps Script project
- Resend API keys can be revoked/regenerated anytime from the dashboard
