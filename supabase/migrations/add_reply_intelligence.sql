-- Migration: Add Reply Intelligence columns to project_settings
-- Run this migration in your Supabase dashboard SQL editor

-- Add reply_mode column with CHECK constraint
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS reply_mode TEXT DEFAULT 'custom' 
CHECK (reply_mode IN ('custom', 'voice'));

-- Add custom_instructions column (nullable)
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

-- Add voice_examples column as JSONB array (default empty array)
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS voice_examples JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN project_settings.reply_mode IS 'Reply generation mode: custom (uses custom_instructions) or voice (uses voice_examples for style transfer)';
COMMENT ON COLUMN project_settings.custom_instructions IS 'Custom instructions for reply generation when reply_mode is custom';
COMMENT ON COLUMN project_settings.voice_examples IS 'Array of user reply examples for voice training when reply_mode is voice';
