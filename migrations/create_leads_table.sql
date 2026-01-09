-- Create leads table to store posts that passed AI analysis
-- This table stores the actual leads found by the bot

CREATE TABLE IF NOT EXISTS "leads" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reddit_post_id" TEXT NOT NULL UNIQUE,
  "alert_id" UUID NOT NULL REFERENCES "alerts"("id"),
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "subreddit" TEXT NOT NULL,
  "created_utc" BIGINT NOT NULL,
  "status" TEXT DEFAULT 'new',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_leads_reddit_post_id" ON "leads"("reddit_post_id");
CREATE INDEX IF NOT EXISTS "idx_leads_alert_id" ON "leads"("alert_id");
CREATE INDEX IF NOT EXISTS "idx_leads_status" ON "leads"("status");
CREATE INDEX IF NOT EXISTS "idx_leads_created_utc" ON "leads"("created_utc" DESC);
