-- Migration: Fix Dev Mode - Nuclear Option for Multi-User Support
-- This migration cleans up the database state and fixes multi-tenancy issues

-- Step 1: Truncate tables to start fresh (nuclear option)
TRUNCATE TABLE leads, alerts, client_profiles, project_settings CASCADE;

-- Step 2: Drop ALL Foreign Keys to auth.users (if any exist)
-- Note: These may not exist in dev mode, but dropping them just in case
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_user_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_user_id_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;

-- Step 3: Drop ALL RLS Policies (dev mode - no security needed)
DROP POLICY IF EXISTS "Users can view own project_settings" ON project_settings;
DROP POLICY IF EXISTS "Users can insert own project_settings" ON project_settings;
DROP POLICY IF EXISTS "Users can update own project_settings" ON project_settings;

DROP POLICY IF EXISTS "Users can view own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON alerts;

DROP POLICY IF EXISTS "Users can view own client_profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can insert own client_profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can update own client_profiles" ON client_profiles;

DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;

-- Step 4: Disable RLS on all tables (dev mode)
ALTER TABLE project_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Step 5: Fix project_settings ID - convert to auto-incrementing
-- This allows multiple users to have their own project_settings rows
-- First drop the existing primary key constraint (if it exists)
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_pkey;

-- Drop the default value that causes conflicts
ALTER TABLE project_settings ALTER COLUMN id DROP DEFAULT;

-- Create a sequence for auto-incrementing IDs
CREATE SEQUENCE IF NOT EXISTS project_settings_id_seq;

-- Set the sequence as default for the id column
ALTER TABLE project_settings ALTER COLUMN id SET DEFAULT nextval('project_settings_id_seq');

-- Make sure the sequence starts after any existing IDs
SELECT setval('project_settings_id_seq', COALESCE((SELECT MAX(id) FROM project_settings), 0) + 1, false);

-- Ensure the id column is the primary key
ALTER TABLE project_settings ADD CONSTRAINT project_settings_pkey PRIMARY KEY (id);

-- Step 6: Ensure alerts has proper UUID primary key (should already be correct)
-- Verify alerts.id has proper UUID default
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'alerts' AND column_name = 'id'
        AND column_default LIKE '%uuid_generate_v4%'
    ) THEN
        ALTER TABLE alerts ALTER COLUMN id SET DEFAULT uuid_generate_v4();
    END IF;
END $$;

-- Step 7: Update schema comment
COMMENT ON SCHEMA public IS 'Dev Mode: Nuclear cleanup completed. UUID columns maintained, RLS disabled, project_settings.id converted to SERIAL for multi-user support.';

-- Step 8: Verification queries
SELECT
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('project_settings', 'alerts', 'client_profiles', 'leads')
AND column_name IN ('id', 'user_id')
ORDER BY table_name, column_name;