-- Migration: Enable Row Level Security (RLS) and Create Security Policies
-- This ensures users can only access their own data

-- ============================================
-- STEP 1: Enable RLS on all tables
-- ============================================

ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_posts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Drop existing policies if they exist
-- ============================================

-- project_settings policies
DROP POLICY IF EXISTS "Users can view own project_settings" ON project_settings;
DROP POLICY IF EXISTS "Users can insert own project_settings" ON project_settings;
DROP POLICY IF EXISTS "Users can update own project_settings" ON project_settings;
DROP POLICY IF EXISTS "Users can delete own project_settings" ON project_settings;

-- alerts policies
DROP POLICY IF EXISTS "Users can view own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON alerts;

-- client_profiles policies
DROP POLICY IF EXISTS "Users can view own client_profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can insert own client_profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can update own client_profiles" ON client_profiles;
DROP POLICY IF EXISTS "Users can delete own client_profiles" ON client_profiles;

-- leads policies
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON leads;

-- processed_posts policies
DROP POLICY IF EXISTS "Users can view processed_posts" ON processed_posts;
DROP POLICY IF EXISTS "Users can insert processed_posts" ON processed_posts;

-- ============================================
-- STEP 3: Create RLS Policies for project_settings
-- Users can only access their own project settings
-- ============================================

CREATE POLICY "Users can view own project_settings" 
  ON project_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project_settings" 
  ON project_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project_settings" 
  ON project_settings FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own project_settings" 
  ON project_settings FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: Create RLS Policies for alerts
-- Users can only access their own alerts
-- ============================================

CREATE POLICY "Users can view own alerts" 
  ON alerts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts" 
  ON alerts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" 
  ON alerts FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts" 
  ON alerts FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Create RLS Policies for client_profiles
-- Users can only access their own client profiles
-- ============================================

CREATE POLICY "Users can view own client_profiles" 
  ON client_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client_profiles" 
  ON client_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own client_profiles" 
  ON client_profiles FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own client_profiles" 
  ON client_profiles FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 6: Create RLS Policies for leads
-- Users can only access leads that belong to their alerts
-- Since leads don't have direct user_id, we check through alerts table
-- ============================================

CREATE POLICY "Users can view own leads" 
  ON leads FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM alerts 
      WHERE alerts.id = leads.alert_id 
      AND alerts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own leads" 
  ON leads FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM alerts 
      WHERE alerts.id = leads.alert_id 
      AND alerts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own leads" 
  ON leads FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM alerts 
      WHERE alerts.id = leads.alert_id 
      AND alerts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM alerts 
      WHERE alerts.id = leads.alert_id 
      AND alerts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own leads" 
  ON leads FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM alerts 
      WHERE alerts.id = leads.alert_id 
      AND alerts.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 7: Create RLS Policies for processed_posts
-- This table tracks which posts have been processed
-- We'll allow authenticated users to read and insert
-- (This is a shared tracking table, so all users can see it)
-- ============================================

CREATE POLICY "Authenticated users can view processed_posts" 
  ON processed_posts FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert processed_posts" 
  ON processed_posts FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- Verification: Check RLS status
-- ============================================

-- Verify RLS is enabled on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE schemaname = 'public'
  AND tablename IN ('project_settings', 'alerts', 'client_profiles', 'leads', 'processed_posts')
ORDER BY tablename;

-- Verify policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
