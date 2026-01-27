-- Migration: Add notification_email column to project_settings
-- This column stores the email address where lead notifications should be sent
--
-- Run this migration in your Supabase dashboard SQL editor

-- Add notification_email column to project_settings table
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS notification_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN project_settings.notification_email IS 'Email address to receive lead notifications (used with Resend API)';

-- ============================================================================
-- Verification query (optional - uncomment to verify after migration)
-- ============================================================================
-- SELECT 
--     column_name, 
--     data_type, 
--     column_default, 
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'project_settings'
-- AND column_name = 'notification_email';
