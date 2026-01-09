# Reddit Lead Generation SaaS (MVP)

## 1. Project Overview

We are building a specialized B2B SaaS that automates lead generation from Reddit.
**The Goal:** Find highly specific, "high-intent" customers for agencies by scanning Reddit posts, filtering them with Regex, analyzing them with AI (OpenAI), and notifying the user via Slack.

**Business Logic:**
We differ from generic scrapers because we prioritize **Intent**. We do not spam. We only notify users when the AI confirms a post indicates a genuine buying signal or pain point.

## 2. Tech Stack

- **Framework:** Next.js (App Router) + TypeScript.
- **Database:** Supabase (PostgreSQL).
- **Queue/Cron:** Upstash QStash (Serverless Queue & Scheduling).
- **AI:** OpenAI
- **Deployment:** Vercel.

## 3. Core Architecture

The system runs on a "Filter Funnel" designed to save costs (API usage & Compute).

### Phase A: The Collector (Cron Job)

1.  **Fetch:** Every 5-10 minutes, fetch the latest 100 posts from target subreddits using the `.json` endpoint (bypassing expensive Reddit APIs).
2.  **Deduplicate:** Check `processed_posts` table. If a post ID exists, skip it.
3.  **Level 1 Filter (Fast/Free):** Apply regex matching based on user keywords (e.g., "looking for seo", "hiring dev").
4.  **Dispatch:** Only posts that pass the Regex filter are sent to Upstash QStash.

### Phase B: The Analyst (Queue Worker)

1.  **Receive:** The API route receives a single post job.
2.  **Level 2 Filter (Smart/Paid):** Send the post content to OpenAI.
    - _System Prompt:_ "Is this user explicitly looking to buy X or complaining about Y? Answer YES/NO."
3.  **Router:** If OpenAI says "YES", query the database to find which specific User/Client requested this keyword.
4.  **Notify:** Send a structured message to that User's Slack Webhook.

## 4. Database Schema

- **`client_profiles`**: Users (Agencies). Contains `slack_webhook_url`.
- **`alerts`**: The specific rules (Subreddits + Keywords) linked to a `client_id`.
- **`processed_posts`**: A history of scanned post IDs to prevent duplicate checks.

## 5. Coding Guidelines for Cursor

- **Type Safety:** Always use the interfaces defined in `@/types.ts`.
- **Environment:** Use `process.env` for all keys. Never hardcode secrets.
- **Error Handling:** Never crash the app. If Reddit fails, log it and return empty. If OpenAI fails, retry (handled by QStash).
- **Simplicity:** Do not over-engineer. This is an MVP. Prefer readability over complex abstractions.
- **Cost Efficiency:** Always assume we are paying for every token. Logic should effectively "gate" the AI usage.
