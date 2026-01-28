import { createClient } from "@/utils/supabase/server";

export type SetupIssueId =
  | "missing_notifications"
  | "missing_alerts"
  | "reply_intelligence_skipped"
  | "missing_slack_discord";

export type SetupIssue = {
  id: SetupIssueId;
  severity: "high" | "medium" | "low";
  message: string;
  ctaLabel: string;
  ctaHref: string;
};

/**
 * Checks the user's setup health and returns a list of issues
 * that can be shown as gentle reminders in the dashboard.
 */
export async function getSetupIssues(): Promise<SetupIssue[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const issues: SetupIssue[] = [];

  // Fetch project_settings once
  const { data: settings } = await supabase
    .from("project_settings")
    .select(
      "website_url, keywords, reply_mode, email_notifications_enabled, slack_notifications_enabled, discord_notifications_enabled"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // Fetch whether user has any active alerts (subreddits)
  const { data: alerts } = await supabase
    .from("alerts")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const hasSubreddits = !!alerts && alerts.length > 0;

  // 1) Missing notifications: no channel enabled at all
  const emailEnabled = !!settings?.email_notifications_enabled;
  const slackEnabled = !!settings?.slack_notifications_enabled;
  const discordEnabled = !!settings?.discord_notifications_enabled;

  if (!emailEnabled && !slackEnabled && !discordEnabled) {
    issues.push({
      id: "missing_notifications",
      severity: "high",
      message:
        "You haven't turned on notifications yet. Enable at least one channel so you don't miss new leads.",
      ctaLabel: "Open Notification Settings",
      ctaHref: "/dashboard/settings/notifications",
    });
  } else if (emailEnabled && !slackEnabled && !discordEnabled) {
    // 1b) Email is on, but no Slack/Discord webhooks configured
    issues.push({
      id: "missing_slack_discord",
      severity: "medium",
      message:
        "Email notifications are enabled, but Slack and Discord are not set up. Turn them on if you want real-time alerts in your channels.",
      ctaLabel: "Open Notification Settings",
      ctaHref: "/dashboard/settings/notifications",
    });
  }

  // 2) Missing alerts (no active subreddits)
  if (!hasSubreddits) {
    issues.push({
      id: "missing_alerts",
      severity: "high",
      message: "You don't have any active subreddits configured. Add at least one to start getting leads.",
      ctaLabel: "Open Scraper Settings",
      ctaHref: "/dashboard/settings",
    });
  }

  // 3) (Disabled) Reply intelligence skipped reminder
  // We no longer surface a dashboard banner for this,
  // to avoid extra noise once users decide to skip it.

  return issues;
}

