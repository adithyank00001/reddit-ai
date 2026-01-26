# Supabase Webhook Setup for Worker 2

## Your Google Apps Script Web App URL (Worker 3)
```
https://script.google.com/macros/s/AKfycbyQkkWQ9OODI4o-yBMfFsmqJWETyY6IVuElnEExQtWEfgfxK0jLPtRC-TqaCLgyCzfy_Q/exec
```

## Step-by-Step Instructions

### 1. Navigate to Supabase Dashboard
1. Go to your Supabase project dashboard
2. Click on **"Database"** in the left sidebar
3. Click on **"Webhooks"** (or go to: Database > Webhooks)

### 2. Create New Webhook
1. Click **"Create a new hook"** or **"New Webhook"** button
2. Fill in the following details:

#### Webhook Name
```
Worker 2 - Lead Processing
```
(Or any name you prefer)

#### Table
- Select: **`leads`** table
- Schema: **`public`**

#### Events to Listen For
- ✅ Check **"Insert"** (this is the main one we need)
- ⬜ "Update" (optional - uncheck if you don't need it)
- ⬜ "Delete" (optional - uncheck if you don't need it)

#### Webhook Type
- Select: **"HTTP Request"** (not Edge Function)

#### HTTP Request Configuration

**URL:**
```
https://script.google.com/macros/s/AKfycbyQkkWQ9OODI4o-yBMfFsmqJWETyY6IVuElnEExQtWEfgfxK0jLPtRC-TqaCLgyCzfy_Q/exec
```

**HTTP Method:**
- Select: **POST**

**HTTP Headers:**
Click "Add new header" and add:
- **Key:** `Content-Type`
- **Value:** `application/json`

(You can add more headers if needed, but this is the minimum)

#### Timeout
- Set to: **1000** (1 second) or higher (e.g., 30000 for 30 seconds)
- Note: Google Apps Script can take a few seconds, so 30 seconds is safer

### 3. Save the Webhook
1. Click **"Create webhook"** or **"Save"**
2. The webhook is now active!

## Webhook Payload Format

When a new lead is inserted, Supabase will send a POST request to your Google Apps Script with this payload:

```json
{
  "type": "INSERT",
  "table": "leads",
  "schema": "public",
  "record": {
    "id": "uuid-here",
    "reddit_post_id": "abc123",
    "alert_id": "uuid-here",
    "title": "Post title",
    "body": "Post body text",
    "url": "https://reddit.com/...",
    "author": "username",
    "subreddit": "saas",
    "created_utc": 1234567890,
    "status": "new",
    "processing_status": "new",
    ...
  },
  "old_record": null
}
```

Your `doPost(e)` function in Worker 2 will receive this and process it.

## Testing the Webhook

### Option 1: Test via Supabase Dashboard
1. Go to your `leads` table in Supabase
2. Click "Insert row"
3. Add a test row with required fields:
   - `reddit_post_id`: "test123"
   - `alert_id`: (any valid UUID from your alerts table)
   - `title`: "Test Post"
   - `body`: "This is a test"
   - `url`: "https://reddit.com/test"
   - `author`: "testuser"
   - `subreddit`: "test"
   - `created_utc`: 1234567890
4. Click "Save"
5. Check your Google Apps Script logs (View > Logs) to see if the webhook was received

### Option 2: Check Webhook Logs in Supabase
1. Go to Database > Webhooks
2. Click on your webhook
3. View the "Logs" or "History" tab to see if requests were sent

## Troubleshooting

### Webhook Not Firing?
1. **Check webhook is enabled:** Make sure the webhook toggle is ON
2. **Check table name:** Ensure you selected the correct `leads` table
3. **Check event type:** Make sure "Insert" is checked
4. **Check URL:** Verify the Google Apps Script URL is correct

### Getting Errors in Google Apps Script?
1. **Check Script Properties:** Make sure `SUPABASE_URL`, `SUPABASE_KEY`, and `OPENAI_API_KEY` are set
2. **Check Logs:** View > Logs in Google Apps Script to see error messages
3. **Check Permissions:** Make sure the web app is deployed with "Anyone" access

### Webhook Timeout?
- Increase the timeout value in the webhook settings (e.g., 30000 for 30 seconds)
- Google Apps Script can take time to process, especially with OpenAI API calls

## Verification Checklist

- [ ] Webhook created in Supabase Dashboard
- [ ] Table set to `leads`
- [ ] Event set to `Insert`
- [ ] URL points to your Google Apps Script web app
- [ ] HTTP Method is `POST`
- [ ] Content-Type header is set to `application/json`
- [ ] Webhook is enabled/toggled ON
- [ ] Tested by inserting a row in the `leads` table
- [ ] Checked Google Apps Script logs for webhook receipt

## Next Steps

Once the webhook is set up:
1. Worker 1 (The Scout) will insert new leads into the `leads` table
2. Supabase will automatically trigger the webhook
3. Worker 2 (The Brain) will receive the webhook and process the lead
4. The lead will be analyzed and updated with AI results

You're all set! 🎉
