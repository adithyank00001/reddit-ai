-- Migration: Fix Multi-Tenant Database Issues
-- Removes unique constraints that prevent multiple subreddits/users

-- Step 1: Wipe data to start fresh
TRUNCATE TABLE leads, alerts, client_profiles, project_settings CASCADE;

-- Step 2: Drop unique constraints that prevent multi-tenancy
-- These constraints were blocking multiple subreddits per user and multiple users

-- Drop unique constraint on alerts.user_id (allows multiple subreddits per user)
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_key;

-- Drop unique constraint on client_profiles.user_id (allows multiple clients per user if needed)
ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_user_id_key;

-- Drop unique constraint on project_settings.user_id (allows multiple project settings if needed)
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_user_id_key;

-- Step 3: Drop FK constraints to auth.users (dev mode)
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_user_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_user_id_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;

-- Step 4: Primary keys should already be correct, no need to modify them
-- The FK constraints we dropped were the issue, not the primary keys

-- Step 4: Ensure proper UUID defaults
ALTER TABLE alerts ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE client_profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE leads ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 5: Dev mode - disable RLS and drop auth FKs
ALTER TABLE project_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Drop any remaining FK constraints to auth.users (if they exist)
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_user_id_fkey;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;
ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_user_id_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;

-- Step 6: Update schema comment
COMMENT ON SCHEMA public IS 'Dev Mode: Multi-tenant fixes applied. Unique constraints removed, RLS disabled, FK constraints to auth.users dropped.';

-- Step 7: Verification
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('alerts', 'client_profiles', 'project_settings', 'leads')
AND indexname LIKE '%user_id%'
ORDER BY tablename;