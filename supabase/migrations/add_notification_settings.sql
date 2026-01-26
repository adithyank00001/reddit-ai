-- Migration: Add Notification Settings to project_settings and leads tables
-- Run this migration in your Supabase dashboard SQL editor
--
-- This migration adds:
-- 1. Notification toggle columns and webhook URLs to project_settings
-- 2. notification_sent flag to leads table to prevent duplicate notifications

-- ============================================================================
-- STEP 1: Add notification columns to project_settings table
-- ============================================================================

-- Add Slack webhook URL
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;

-- Add Discord webhook URL
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;

-- Add email notifications toggle
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT false;

-- Add Slack notifications toggle
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS slack_notifications_enabled BOOLEAN DEFAULT false;

-- Add Discord notifications toggle
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS discord_notifications_enabled BOOLEAN DEFAULT false;

-- ============================================================================
-- STEP 2: Add notification_sent flag to leads table
-- ============================================================================

-- Add notification_sent column to track if notification has been sent
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- ============================================================================
-- STEP 3: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN project_settings.slack_webhook_url IS 'Slack webhook URL for sending notifications';
COMMENT ON COLUMN project_settings.discord_webhook_url IS 'Discord webhook URL for sending notifications';
COMMENT ON COLUMN project_settings.email_notifications_enabled IS 'Enable email notifications when leads are ready';
COMMENT ON COLUMN project_settings.slack_notifications_enabled IS 'Enable Slack notifications when leads are ready';
COMMENT ON COLUMN project_settings.discord_notifications_enabled IS 'Enable Discord notifications when leads are ready';
COMMENT ON COLUMN leads.notification_sent IS 'Flag to prevent duplicate notifications - set to true after notification is sent';

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
-- AND column_name IN ('slack_webhook_url', 'discord_webhook_url', 'email_notifications_enabled', 'slack_notifications_enabled', 'discord_notifications_enabled')
-- ORDER BY column_name;
--
-- SELECT 
--     column_name, 
--     data_type, 
--     column_default, 
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'leads'
-- AND column_name = 'notification_sent';
