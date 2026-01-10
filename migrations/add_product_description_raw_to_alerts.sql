-- Add product_description_raw column to alerts table to store the full user-provided description

ALTER TABLE "alerts"
ADD COLUMN IF NOT EXISTS "product_description_raw" TEXT;

