-- Migration: Add user_id columns and RLS policies for multi-tenant support
-- Run this migration in your Supabase dashboard SQL editor

-- Add user_id column to project_settings table
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to alerts table
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to client_profiles table
ALTER TABLE client_profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create unique constraints to ensure one record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_settings_user_id_unique ON project_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_user_id_unique ON alerts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_profiles_user_id_unique ON client_profiles(user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_settings_user_id ON project_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON client_profiles(user_id);

-- Enable Row Level Security (RLS) on all three tables
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy for project_settings: Users can only see their own settings
DROP POLICY IF EXISTS "Users can view own project_settings" ON project_settings;
CREATE POLICY "Users can view own project_settings" 
  ON project_settings FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own project_settings" ON project_settings;
CREATE POLICY "Users can insert own project_settings" 
  ON project_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own project_settings" ON project_settings;
CREATE POLICY "Users can update own project_settings" 
  ON project_settings FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy for alerts: Users can only see their own alerts
DROP POLICY IF EXISTS "Users can view own alerts" ON alerts;
CREATE POLICY "Users can view own alerts" 
  ON alerts FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own alerts" ON alerts;
CREATE POLICY "Users can insert own alerts" 
  ON alerts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own alerts" ON alerts;
CREATE POLICY "Users can update own alerts" 
  ON alerts FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy for client_profiles: Users can only see their own profiles
DROP POLICY IF EXISTS "Users can view own client_profiles" ON client_profiles;
CREATE POLICY "Users can view own client_profiles" 
  ON client_profiles FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own client_profiles" ON client_profiles;
CREATE POLICY "Users can insert own client_profiles" 
  ON client_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own client_profiles" ON client_profiles;
CREATE POLICY "Users can update own client_profiles" 
  ON client_profiles FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
