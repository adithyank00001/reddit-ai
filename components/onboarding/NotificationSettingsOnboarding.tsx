"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updateSettings, testWebhookViaWorker } from "@/app/actions/settings";
import { toast } from "sonner";
import { Webhook, Mail, MessageSquare } from "lucide-react";

const notificationSchema = z.object({
  slackWebhookUrl: z.string().url("Invalid webhook URL").optional().or(z.literal("")),
  discordWebhookUrl: z.string().url("Invalid webhook URL").optional().or(z.literal("")),
  emailNotificationsEnabled: z.boolean().default(false),
  slackNotificationsEnabled: z.boolean().default(false),
  discordNotificationsEnabled: z.boolean().default(false),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

interface NotificationSettingsOnboardingProps {
  initialSlackWebhookUrl?: string;
  initialDiscordWebhookUrl?: string;
  initialEmailNotificationsEnabled?: boolean;
  initialSlackNotificationsEnabled?: boolean;
  initialDiscordNotificationsEnabled?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

export function NotificationSettingsOnboarding({
  initialSlackWebhookUrl = "",
  initialDiscordWebhookUrl = "",
  initialEmailNotificationsEnabled = false,
  initialSlackNotificationsEnabled = false,
  initialDiscordNotificationsEnabled = false,
  onValidationChange,
}: NotificationSettingsOnboardingProps) {

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      slackWebhookUrl: initialSlackWebhookUrl,
      discordWebhookUrl: initialDiscordWebhookUrl,
      emailNotificationsEnabled: initialEmailNotificationsEnabled,
      slackNotificationsEnabled: initialSlackNotificationsEnabled,
      discordNotificationsEnabled: initialDiscordNotificationsEnabled,
    },
    mode: "onChange", // Validate on every change
  });

  // Watch all values to auto-save and validate
  const emailEnabled = watch("emailNotificationsEnabled");
  const slackEnabled = watch("slackNotificationsEnabled");
  const discordEnabled = watch("discordNotificationsEnabled");
  const slackWebhookUrl = watch("slackWebhookUrl");
  const discordWebhookUrl = watch("discordWebhookUrl");

  // Auto-save changes whenever form values change
  useEffect(() => {
    const autoSave = async () => {
      const formData = new FormData();
      formData.append("slackWebhookUrl", slackWebhookUrl || "");
      formData.append("discordWebhookUrl", discordWebhookUrl || "");
      formData.append("emailNotificationsEnabled", emailEnabled ? "true" : "false");
      formData.append("slackNotificationsEnabled", slackEnabled ? "true" : "false");
      formData.append("discordNotificationsEnabled", discordEnabled ? "true" : "false");

      await updateSettings(formData);
    };

    // Debounce auto-save by 500ms
    const timeoutId = setTimeout(autoSave, 500);
    return () => clearTimeout(timeoutId);
  }, [emailEnabled, slackEnabled, discordEnabled, slackWebhookUrl, discordWebhookUrl]);

  // Check if at least one notification channel is properly configured
  useEffect(() => {
    const isEmailValid = emailEnabled;
    const isSlackValid = slackEnabled && slackWebhookUrl.trim().length > 0 && !errors.slackWebhookUrl;
    const isDiscordValid = discordEnabled && discordWebhookUrl.trim().length > 0 && !errors.discordWebhookUrl;

    const hasValidSettings = isEmailValid || isSlackValid || isDiscordValid;
    
    if (onValidationChange) {
      onValidationChange(hasValidSettings);
    }
  }, [emailEnabled, slackEnabled, discordEnabled, slackWebhookUrl, discordWebhookUrl, errors, onValidationChange]);

  async function testWebhook(webhookUrl: string, type: "slack" | "discord" = "slack") {
    if (!webhookUrl) {
      toast.error("Please enter a webhook URL first");
      return;
    }

    try {
      const result = await testWebhookViaWorker(webhookUrl, type);

      if (result.success) {
        toast.success(`Webhook test successful! Check your ${type === "slack" ? "Slack" : "Discord"} channel.`);
      } else {
        toast.error(result.error || "Webhook test failed. Please check your URL.");
      }
    } catch (error) {
      toast.error("Failed to test webhook. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Enable notifications and configure webhook URLs for each channel. Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Email Notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="emailNotificationsEnabled" className="text-base font-medium cursor-pointer">
                      Email Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications when leads are ready
                    </p>
                  </div>
                </div>
                <Switch
                  id="emailNotificationsEnabled"
                  checked={emailEnabled}
                  onCheckedChange={(checked) => setValue("emailNotificationsEnabled", checked)}
                />
              </div>
              {emailEnabled && (
                <div className="ml-8 p-3 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Email notifications will be sent to your account email address.
                  </p>
                </div>
              )}
            </div>

            {/* Slack Notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="slackNotificationsEnabled" className="text-base font-medium cursor-pointer">
                      Slack Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications in Slack when leads are ready
                    </p>
                  </div>
                </div>
                <Switch
                  id="slackNotificationsEnabled"
                  checked={slackEnabled}
                  onCheckedChange={(checked) => setValue("slackNotificationsEnabled", checked)}
                />
              </div>
              <div className="ml-8 space-y-2">
                <Label htmlFor="slackWebhookUrl" className={!slackEnabled ? "text-muted-foreground" : ""}>
                  Slack Webhook URL
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id="slackWebhookUrl"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      disabled={!slackEnabled}
                      {...register("slackWebhookUrl")}
                    />
                    {errors.slackWebhookUrl && slackWebhookUrl && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.slackWebhookUrl.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!slackEnabled}
                    onClick={() => testWebhook(slackWebhookUrl, "slack")}
                  >
                    <Webhook className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                {!slackEnabled && (
                  <p className="text-sm text-muted-foreground">
                    Enable Slack notifications to configure webhook URL
                  </p>
                )}
              </div>
            </div>

            {/* Discord Notifications */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="discordNotificationsEnabled" className="text-base font-medium cursor-pointer">
                      Discord Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications in Discord when leads are ready
                    </p>
                  </div>
                </div>
                <Switch
                  id="discordNotificationsEnabled"
                  checked={discordEnabled}
                  onCheckedChange={(checked) => setValue("discordNotificationsEnabled", checked)}
                />
              </div>
              <div className="ml-8 space-y-2">
                <Label htmlFor="discordWebhookUrl" className={!discordEnabled ? "text-muted-foreground" : ""}>
                  Discord Webhook URL
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id="discordWebhookUrl"
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      disabled={!discordEnabled}
                      {...register("discordWebhookUrl")}
                    />
                    {errors.discordWebhookUrl && discordWebhookUrl && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.discordWebhookUrl.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!discordEnabled}
                    onClick={() => testWebhook(discordWebhookUrl, "discord")}
                  >
                    <Webhook className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                {!discordEnabled && (
                  <p className="text-sm text-muted-foreground">
                    Enable Discord notifications to configure webhook URL
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
