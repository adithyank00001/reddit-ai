-- Add AI metadata columns to leads table
-- These columns store the opportunity analysis results from the Growth Scout AI

ALTER TABLE "leads" 
ADD COLUMN IF NOT EXISTS "opportunity_score" INTEGER,
ADD COLUMN IF NOT EXISTS "opportunity_type" TEXT,
ADD COLUMN IF NOT EXISTS "opportunity_reason" TEXT,
ADD COLUMN IF NOT EXISTS "suggested_angle" TEXT;

-- Note: All columns are nullable to support legacy leads that don't have AI metadata
