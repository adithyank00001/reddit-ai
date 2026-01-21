-- Migration: Convert user_id columns from UUID to TEXT
-- This allows using email addresses directly as user IDs for dev mode readability

-- Convert user_id columns to TEXT type in all tables

-- project_settings table
ALTER TABLE project_settings ALTER COLUMN user_id TYPE TEXT;

-- alerts table
ALTER TABLE alerts ALTER COLUMN user_id TYPE TEXT;

-- client_profiles table
ALTER TABLE client_profiles ALTER COLUMN user_id TYPE TEXT;

-- leads table (if it exists)
ALTER TABLE leads ALTER COLUMN user_id TYPE TEXT;

-- Update any existing indexes if they reference user_id
-- (The existing indexes should still work with TEXT columns)

-- Add comment for future reference
COMMENT ON SCHEMA public IS 'Dev Mode: user_id columns converted to TEXT for email-based IDs. Restore UUID type, FK constraints, and RLS policies before production.';