-- Clear all existing keywords from project_settings
-- This allows starting fresh with keywords entered through the dashboard

UPDATE project_settings 
SET keywords = NULL 
WHERE id = 1;
