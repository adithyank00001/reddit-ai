"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { NotificationSettingsOnboarding } from "@/components/onboarding/NotificationSettingsOnboarding";

export default function OnboardingStep5Page() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasValidSettings, setHasValidSettings] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [slackNotificationsEnabled, setSlackNotificationsEnabled] = useState(false);
  const [discordNotificationsEnabled, setDiscordNotificationsEnabled] = useState(false);

  // Load current settings and verify step access
  useEffect(() => {
    async function verifyStep() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login?redirectTo=/onboarding/step-5");
          return;
        }

        // Check if user has completed steps 1-4
        const { data: settings } = await supabase
          .from("project_settings")
          .select("website_url, keywords, reply_mode, slack_webhook_url, discord_webhook_url, notification_email, email_notifications_enabled, slack_notifications_enabled, discord_notifications_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        // Check if user has active subreddits in alerts table
        const { data: alerts } = await supabase
          .from("alerts")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);

        const hasSubreddits = alerts && alerts.length > 0;

        // If user hasn't completed steps 1-3, redirect to appropriate step
        if (!settings?.website_url) {
          router.push("/onboarding/step-1");
          return;
        }
        
        if (!settings.keywords || settings.keywords.length === 0) {
          router.push("/onboarding/step-2");
          return;
        }
        
        if (!hasSubreddits) {
          router.push("/onboarding/step-3");
          return;
        }

        // Check if step 4 (Reply Intelligence) was completed or skipped
        if (!settings.reply_mode) {
          // Step 4 not yet completed - redirect to step 4
          router.push("/onboarding/step-4");
          return;
        }

        // Load current notification settings if they exist
        if (settings) {
          setSlackWebhookUrl(settings.slack_webhook_url || "");
          setDiscordWebhookUrl(settings.discord_webhook_url || "");
          setNotificationEmail(settings.notification_email || "");
          setEmailNotificationsEnabled(settings.email_notifications_enabled || false);
          setSlackNotificationsEnabled(settings.slack_notifications_enabled || false);
          setDiscordNotificationsEnabled(settings.discord_notifications_enabled || false);
        }

        setIsChecking(false);
      } catch (error) {
        console.error("Error verifying step:", error);
        setIsChecking(false);
      }
    }

    verifyStep();
  }, [router]);

  const handleComplete = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please log in to continue");
        setIsLoading(false);
        return;
      }

      // Mark onboarding as completed
      const { error: updateError } = await supabase
        .from("project_settings")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      if (updateError) {
        toast.error("Failed to complete onboarding. Please try again.");
        setIsLoading(false);
        return;
      }

      toast.success("Onboarding complete! Welcome to your dashboard.");
      
      // Small delay to ensure database update is committed
      await new Promise(resolve => setTimeout(resolve, 300));

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error completing step 5:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Notification Settings</CardTitle>
        <CardDescription>
          Step 5 of 5: Choose how you want to receive notifications. You must enable and configure at least one channel to finish onboarding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <NotificationSettingsOnboarding
          initialSlackWebhookUrl={slackWebhookUrl}
          initialDiscordWebhookUrl={discordWebhookUrl}
          initialNotificationEmail={notificationEmail}
          initialEmailNotificationsEnabled={emailNotificationsEnabled}
          initialSlackNotificationsEnabled={slackNotificationsEnabled}
          initialDiscordNotificationsEnabled={discordNotificationsEnabled}
          onValidationChange={setHasValidSettings}
        />

        <div className="flex justify-between pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/step-4")}
            size="lg"
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            onClick={handleComplete}
            size="lg"
            disabled={isLoading || !hasValidSettings}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              "Complete"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
