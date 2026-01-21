-- Migration: Create global subreddits table
-- This table stores all subreddits that users want to monitor

-- Create subreddits table
CREATE TABLE IF NOT EXISTS subreddits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- subreddit name (without r/)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subreddits_name ON subreddits(name);

-- Enable RLS (optional - can be public read if you want)
ALTER TABLE subreddits ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read subreddits
DROP POLICY IF EXISTS "Anyone can read subreddits" ON subreddits;
CREATE POLICY "Anyone can read subreddits" 
  ON subreddits FOR SELECT 
  USING (true);

-- Allow anyone to insert subreddits (or restrict to authenticated users if needed)
DROP POLICY IF EXISTS "Anyone can insert subreddits" ON subreddits;
CREATE POLICY "Anyone can insert subreddits" 
  ON subreddits FOR INSERT 
  WITH CHECK (true);

-- Prevent duplicates and update timestamp on conflict
CREATE OR REPLACE FUNCTION update_subreddit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subreddits_timestamp
  BEFORE UPDATE ON subreddits
  FOR EACH ROW
  EXECUTE FUNCTION update_subreddit_timestamp();
