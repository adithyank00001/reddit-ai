-- Add onboarding_completed column to project_settings table
-- This flag tracks whether a user has completed the onboarding flow
-- Once set to true, the user should never see onboarding again, even if they delete subreddits/keywords

-- Add the column (defaults to false for new users)
ALTER TABLE project_settings 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Mark all existing users as having completed onboarding
-- This ensures existing users don't get forced back into onboarding
UPDATE project_settings 
SET onboarding_completed = TRUE 
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN project_settings.onboarding_completed IS 'Tracks if user has completed initial onboarding flow. Once true, user should never see onboarding again.';
