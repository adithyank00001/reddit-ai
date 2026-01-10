-- Remove the old keywords column from alerts table
-- Since we now use global keywords from project_settings, this column is no longer needed

ALTER TABLE "alerts"
DROP COLUMN IF EXISTS "keywords";
