-- Add product_context column to alerts table for Growth Scout context-aware analysis
-- This stores a short free-form description of the product being monitored by the alert

ALTER TABLE "alerts"
ADD COLUMN IF NOT EXISTS "product_context" TEXT;

