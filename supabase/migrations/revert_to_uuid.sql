-- Migration: Revert user_id columns to UUID (but keep No-Auth mode)
-- This reverts the TEXT conversion but maintains dev mode (no FK constraints, RLS disabled)

-- IMPORTANT: Truncate tables first to remove any TEXT data (emails) that can't be converted to UUID
TRUNCATE TABLE project_settings, alerts, client_profiles, leads CASCADE;

-- Convert user_id columns back to UUID type
ALTER TABLE project_settings ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE alerts ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE client_profiles ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
ALTER TABLE leads ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Ensure RLS is still disabled (dev mode)
ALTER TABLE project_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Update schema comment
COMMENT ON SCHEMA public IS 'Dev Mode: user_id columns reverted to UUID, FK constraints and RLS policies remain dropped for unrestricted access.';

-- Verification
SELECT
    table_name,
    'user_id column type: ' ||
    (SELECT data_type FROM information_schema.columns
     WHERE table_name = t.table_name AND column_name = 'user_id') as status
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('project_settings', 'alerts', 'client_profiles', 'leads');