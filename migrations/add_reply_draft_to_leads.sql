-- Add reply_draft column to leads table
-- This column stores AI-generated reply drafts for high-quality leads (score >= 70)
-- Users can copy these drafts and paste them into Reddit comments

ALTER TABLE "leads" 
ADD COLUMN IF NOT EXISTS "reply_draft" TEXT;

-- Note: Column is nullable to support legacy leads that don't have reply drafts
-- Reply drafts are only generated for leads with opportunity_score >= 70
