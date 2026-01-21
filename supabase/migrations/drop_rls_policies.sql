-- Migration: Drop RLS policies before changing column types
-- RLS policies prevent altering columns they reference

-- Drop all RLS policies for project_settings
DROP POLICY IF EXISTS "Users can view own project_settings" ON project_settings;
DROP POLICY IF EXISTS "Users can insert own project_settings" ON project_settings;
DROP POLICY IF EXISTS "Users can update own project_settings" ON project_settings;

-- Drop all RLS policies for alerts
DROP POLICY IF EXISTS "Users can view own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON alerts;

-- Drop all RLS policies for client_profiles
DROP POLICY IF EXISTS "Users can view own client_profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can insert own client_profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can update own client_profiles" ON client_profiles;

-- Drop RLS policies for leads (if they exist)
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;

-- Disable RLS on all tables (dev mode - no security needed)
ALTER TABLE project_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Add comment for future reference
COMMENT ON SCHEMA public IS 'Dev Mode: RLS policies dropped for unrestricted access. Restore policies before production.';