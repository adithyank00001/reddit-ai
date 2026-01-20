Reddit Lead Gen Architecture: The "Unbannable" Serverless MVP
1. High-Level Overview
This architecture is designed for a bootstrapped SaaS founder who needs a reliable, scalable, and $0 cost lead generation engine. It bypasses the two biggest enemies of scraping:
IP Bans: By using Reddit RSS feeds instead of the JSON API, and routing traffic through Google's massive server infrastructure, we avoid 403 Forbidden errors.
Platform Limits: By using Supabase Webhooks, we bypass the Vercel "Hobby Plan" timeout (10s) and bandwidth limits, and Google Apps Script's daily runtime limit (90 mins).
The Core Philosophy:
"Decouple Ingestion from Processing."
Don't try to do everything in one script. Split the work into specialized "Workers" that talk to each other via the Database.
2. The 3 Core Components
Component
Role
Technology
Cost
Worker 1: The Scout
Fetches raw data from Reddit RSS. Filters junk.
Google Apps Script (Account A)
Free
The Trigger
Detects new leads and notifies the Brain.
Supabase Database Webhooks
Free
Worker 2: The Brain
Analyzes relevance, writes replies, saves results.
Google Apps Script (Account B)
Free (Pay only OpenAI)
The Frontend
Displays leads to the human user.
Vercel (Next.js)
Free

3. Detailed Workflow (The "Happy Path")
This is the exact lifecycle of a single Lead, from Reddit Post to your Dashboard.
Phase 1: Ingestion (Worker 1)
Wake Up: Worker 1 wakes up (Trigger: Every 5 minutes).
Fetch: It downloads the RSS feed for r/saas (xml).
Filter (The Gatekeeper): It runs a local Regex check.
Match: "How do I find customers?" (Keep ✅)
No Match: "Look at my cat!" (Discard ❌)
Save: It inserts the matched post into Supabase table leads with processing_status: 'new'.
Sleep: Worker 1 goes back to sleep. Total Runtime: ~10 seconds.
Phase 2: The Hand-Off (Supabase)
Detection: Supabase detects a new row in leads.
Fire: It instantly sends a HTTP POST (Webhook) to the URL of Worker 2.
Phase 3: Processing (Worker 2)
Wake Up: Worker 2 wakes up instantly.
Lock: It immediately updates the row to processing_status: 'processing' to prevent duplicate runs.
Analyze: It sends the post title/body to OpenAI (GPT-4o-mini).
Prompt: "Is this relevant to a SaaS consultant?"
Reply: If relevant, it asks OpenAI to write a helpful, non-salesy reply.
Save: It updates the row in Supabase:
processing_status: 'ready'
ai_reply: "Here is a tip on finding customers..."
relevance_score: 85
Phase 4: Consumption (Vercel)
User Login: You open your Vercel Dashboard.
Read: The dashboard queries Supabase for all leads where status = 'ready'.
Action: You see the lead, review the AI draft, and click "Post to Reddit."
4. Technical Specs & Limits
Worker 1 (The Scout)
Platform: Google Apps Script.
Trigger: Time-driven (Clock).
Limit Used: "Triggers total runtime" (90 mins/day).
Our Usage: ~15 mins/day (Safe).
Strategy: Keep this script "dumb." No AI. Just fetch and dump.
Worker 2 (The Brain)
Platform: Google Apps Script (Deployed as Web App).
Trigger: doPost(e) via Webhook.
Limit Used: "Simultaneous executions" (30 per user).
Our Usage: 1-5 slots at peak times (Safe).
Strategy: This script handles the "heavy lifting" (OpenAI). Since it's triggered by a Web App request, it does not count towards the 90-minute daily trigger limit.
Supabase
Role: The Central Nervous System.
Feature: Database Webhooks (Beta).
Limit: Generous on Free Tier. Be careful with massive concurrency (e.g., scraping r/all), but safe for niche subreddits.
5. Deployment Checklist
Step 1: Database Prep
Run this SQL in Supabase to support the workflow:
ALTER TABLE leads 
ADD COLUMN processing_status TEXT DEFAULT 'new', -- new -> processing -> ready/discarded
ADD COLUMN relevance_score INT DEFAULT 0,
ADD COLUMN ai_analysis TEXT,
ADD COLUMN ai_reply TEXT;


Step 2: Deploy Worker 2 (The Brain)
Create a new Google Script (Account B).
Paste the Worker 2 Code (see chat history).
Deploy as Web App -> Access: Anyone.
Copy the URL.
Step 3: Connect the Pipes
Go to Supabase -> Database -> Webhooks.
Create Hook:
Event: INSERT on table leads.
Type: HTTP Request.
URL: Paste Worker 2 URL.
Secret: Add ?secret=YOUR_PASS to the URL.
Step 4: Deploy Worker 1 (The Scout)
Create a new Google Script (Account A).
Paste the Worker 1 Code (RSS + Regex).
Set Trigger: Every 5 Minutes.
6. Scaling Strategy (Future Proofing)
Level 1 (0-100 Leads/Day): Current Architecture. $0 cost.
Level 2 (100-1,000 Leads/Day):
Duplicate Worker 1 to multiple Google Accounts (sharding subreddits).
Worker 2 remains the same (it scales horizontally automatically).
Level 3 (Enterprise):
Move Worker 2 to Google Cloud Run (Docker container) for better logging and 60-minute timeouts.
Add Supavisor connection pooling to Supabase.
