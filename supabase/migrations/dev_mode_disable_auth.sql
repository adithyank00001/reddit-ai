-- Migration: Disable Auth for Dev Mode (Technical Debt)
-- WARNING: This drops foreign key constraints for rapid prototyping
-- TODO: Restore these constraints before production deployment

-- Drop foreign key constraints linking to auth.users
-- This allows mock user_ids to work without real Supabase authentication

-- project_settings table
ALTER TABLE project_settings DROP CONSTRAINT IF EXISTS project_settings_user_id_fkey;

-- alerts table
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_user_id_fkey;

-- client_profiles table
ALTER TABLE client_profiles DROP CONSTRAINT IF EXISTS client_profiles_user_id_fkey;

-- leads table (if it exists and has user_id)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;

-- Disable RLS temporarily (optional - enables unrestricted access)
-- ALTER TABLE project_settings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Add comment for future reference
COMMENT ON SCHEMA public IS 'Dev Mode: Auth disabled for rapid prototyping. Restore FK constraints before production.';