import { createClient } from "@/utils/supabase/server";

/**
 * Checks onboarding status and returns the step the user should be on
 * @returns The onboarding step path the user should be redirected to, or null if onboarding is complete
 */
export async function getOnboardingStep(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return "/onboarding/step-1";
  }

  // Check if user has already completed onboarding
  // If this flag is true, NEVER show onboarding again (even if they deleted subreddits/keywords)
  const { data: settings } = await supabase
    .from("project_settings")
    .select("onboarding_completed, website_url, keywords")
    .eq("user_id", user.id)
    .maybeSingle();

  // If user has completed onboarding before, never show it again
  if (settings?.onboarding_completed === true) {
    return null; // Onboarding is complete, allow access to dashboard
  }

  // If no settings exist yet, user needs to start onboarding from step 1
  if (!settings) {
    return "/onboarding/step-1";
  }

  // User hasn't completed onboarding yet, check which step they need
  // If no website_url, user needs step 1
  if (!settings.website_url) {
    return "/onboarding/step-1";
  }

  // If has website_url but no keywords, user needs step 2
  if (settings.website_url && (!settings.keywords || settings.keywords.length === 0)) {
    return "/onboarding/step-2";
  }

  // Check if user has active subreddits in alerts table (step 3)
  const { data: alerts } = await supabase
    .from("alerts")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const hasSubreddits = alerts && alerts.length > 0;

  // If has website_url and keywords but no subreddits, user needs step 3
  if (settings.website_url && settings.keywords && settings.keywords.length > 0 && !hasSubreddits) {
    return "/onboarding/step-3";
  }

  // If all three required steps completed, check step 4 (Reply Intelligence)
  // Step 4 is optional - if reply_mode is not set, user should see step 4
  if (settings.website_url && settings.keywords && settings.keywords.length > 0 && hasSubreddits) {
    // Check reply_mode and related fields to determine step 4 status
    const { data: replySettings } = await supabase
      .from("project_settings")
      .select("reply_mode, custom_instructions, voice_examples")
      .eq("user_id", user.id)
      .maybeSingle();

    // Check reply_mode status
    // - null or undefined: step 4 not visited yet → show step 4
    // - 'custom', 'voice', or 'skipped': step 4 completed/skipped → check step 5
    
    const replyMode = replySettings?.reply_mode;
    
    // If reply_mode is null, user hasn't visited step 4 yet - show step 4
    if (!replyMode) {
      return "/onboarding/step-4";
    }
    
    // If reply_mode is set ('custom', 'voice', or 'skipped'), step 4 is done
    // Now check step 5 (Notification Settings) - this is the final step
    // Step 5 completion is tracked by onboarding_completed flag
    // If onboarding_completed is false/null, user needs to see step 5
    // If onboarding_completed is true, onboarding is complete
    
    // Note: onboarding_completed is already checked at the top of this function
    // If we reach here, it means onboarding_completed is false/null
    // So user needs to see step 5
    return "/onboarding/step-5";
  }

  // Default fallback
  return "/onboarding/step-1";
}
