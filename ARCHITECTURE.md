# 🏗️ Reddit Lead Scraper - System Architecture

## 🎯 Goal

Build an automated "Push-based" lead generation system where Google Apps Script collects Reddit data and pushes it to a Vercel/Next.js backend for AI analysis and storage.

## 🔄 The "Push" Workflow

1.  **Source:** Google Apps Script fetches RSS feeds from 10+ subreddits every 5 minutes.
2.  **Transport:** GAS cleans the XML and pushes a JSON payload to `POST /api/cron`.
3.  **Receiver (Vercel):**
    - Validates `CRON_SECRET`.
    - Deduplicates posts (checks Supabase `leads` table).
    - Filters by Keywords (local list).
    - Analyzes with OpenAI (Scoring 0-100).
4.  **Action:** High-scoring leads are saved to DB and sent to Discord.

---

## 📅 Development Phases

### ✅ Phase 1: The Brain (Vercel Backend)

**File:** `api/cron/route.ts`

- **Responsibility:** Receive JSON, process logic, save data.
- **Input Schema:**
  ```json
  {
    "subreddit": "saas",
    "posts": [
      {
        "id": "t3_xyz",
        "title": "Need a CRM",
        "content": "<div>HTML content...</div>",
        "url": "[https://reddit.com/](https://reddit.com/)..."
      }
    ]
  }
  ```
- **Logic:**
  1.  Auth Check (`Bearer TOKEN`).
  2.  `posts.forEach` loop.
  3.  Check if `url` exists in Supabase.
  4.  Keyword match check.
  5.  OpenAI analysis.
  6.  Insert + Discord Webhook.

### ⏳ Phase 2: The Collector (Google Apps Script)

**Platform:** script.google.com

- **Responsibility:** Bypass Reddit blocks using RSS and Google IPs.
- **Settings:**
  - Trigger: Every 5 Minutes.
  - Fetch Limit: `?limit=100`.
  - Target: Sequential fetch of 10 subreddits.
  - User-Agent: Randomized Chrome string.

### ⏳ Phase 3: Security & Env

- **Vercel Env:** `CRON_SECRET`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `DISCORD_WEBHOOK_URL`.
- **GAS Script:** `SECRET_KEY` variable must match `CRON_SECRET`.

---

## 🛠️ Database Schema (Supabase)

**Table:** `leads`

- `id` (uuid, PK)
- `reddit_id` (text, unique)
- `title` (text)
- `content` (text)
- `url` (text)
- `subreddit` (text)
- `ai_score` (int)
- `ai_reason` (text)
- `created_at` (timestamp)
