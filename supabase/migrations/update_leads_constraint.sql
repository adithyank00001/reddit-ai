-- Migration: Update Leads Table Constraint for Multi-Tenant Shared Leads
-- 
-- Context: Multiple users can now track the same subreddit, and the same Reddit post
-- should be allowed to exist multiple times in the leads table, but only if it's
-- linked to different alert_id values.
--
-- Changes:
-- 1. Drops the existing single-column unique constraint on reddit_post_id
-- 2. Adds a new composite unique constraint on (reddit_post_id, alert_id)
--
-- This allows:
-- - Row 1: post_id="123", alert_id="UserA_Alert" -> Allowed
-- - Row 2: post_id="123", alert_id="UserB_Alert" -> Allowed
-- - Row 3: post_id="123", alert_id="UserA_Alert" -> Blocked (Duplicate)

-- Step 1: Drop the existing single-column unique constraint on reddit_post_id
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_reddit_post_id_key;

-- Step 2: Add new composite unique constraint on (reddit_post_id, alert_id)
-- This ensures the same post can exist for different alerts, but not duplicate for the same alert
ALTER TABLE leads ADD CONSTRAINT leads_post_alert_unique UNIQUE (reddit_post_id, alert_id);

-- Verification query (commented out - uncomment to verify after migration)
-- SELECT 
--     conname AS constraint_name,
--     contype AS constraint_type,
--     pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'leads'::regclass
-- AND contype = 'u'  -- 'u' = unique constraint
-- ORDER BY conname;
