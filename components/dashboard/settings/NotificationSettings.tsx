"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { testEmailViaWorker, testWebhookViaWorker, updateSettings } from "@/app/actions/settings";
import { toast } from "sonner";
import { Loader2, Webhook, Mail, MessageSquare } from "lucide-react";

const notificationSchema = z.object({
  slackWebhookUrl: z.string().url("Invalid webhook URL").optional().or(z.literal("")),
  discordWebhookUrl: z.string().url("Invalid webhook URL").optional().or(z.literal("")),
  notificationEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  emailNotificationsEnabled: z.boolean().default(false),
  slackNotificationsEnabled: z.boolean().default(false),
  discordNotificationsEnabled: z.boolean().default(false),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

interface NotificationSettingsProps {
  initialSlackWebhookUrl?: string;
  initialDiscordWebhookUrl?: string;
  initialNotificationEmail?: string;
  initialEmailNotificationsEnabled?: boolean;
  initialSlackNotificationsEnabled?: boolean;
  initialDiscordNotificationsEnabled?: boolean;
}

export function NotificationSettings({
  initialSlackWebhookUrl = "",
  initialDiscordWebhookUrl = "",
  initialNotificationEmail = "",
  initialEmailNotificationsEnabled = false,
  initialSlackNotificationsEnabled = false,
  initialDiscordNotificationsEnabled = false,
}: NotificationSettingsProps) {

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      slackWebhookUrl: initialSlackWebhookUrl,
      discordWebhookUrl: initialDiscordWebhookUrl,
      notificationEmail: initialNotificationEmail,
      emailNotificationsEnabled: initialEmailNotificationsEnabled,
      slackNotificationsEnabled: initialSlackNotificationsEnabled,
      discordNotificationsEnabled: initialDiscordNotificationsEnabled,
    },
  });

  // Watch toggle values to enable/disable inputs
  const emailEnabled = watch("emailNotificationsEnabled");
  const slackEnabled = watch("slackNotificationsEnabled");
  const discordEnabled = watch("discordNotificationsEnabled");
  const notificationEmail = watch("notificationEmail");
  const slackWebhookUrl = watch("slackWebhookUrl");
  const discordWebhookUrl = watch("discordWebhookUrl");

  async function onSubmit(data: NotificationFormData) {
    const formData = new FormData();
    formData.append("slackWebhookUrl", data.slackWebhookUrl || "");
    formData.append("discordWebhookUrl", data.discordWebhookUrl || "");
    formData.append("notificationEmail", data.notificationEmail || "");
    formData.append("emailNotificationsEnabled", data.emailNotificationsEnabled ? "true" : "false");
    formData.append("slackNotificationsEnabled", data.slackNotificationsEnabled ? "true" : "false");
    formData.append("discordNotificationsEnabled", data.discordNotificationsEnabled ? "true" : "false");

    const result = await updateSettings(formData);

    if (result.success) {
      toast.success("Notification settings saved successfully!");
    } else {
      toast.error(result.error || "Failed to save settings");
    }
  }

  async function testWebhook(webhookUrl: string, type: "slack" | "discord" = "slack") {
    if (!webhookUrl) {
      toast.error("Please enter a webhook URL first");
      return;
    }

    try {
      // Use server action to test webhook via gas-worker-3.js
      // This tests the actual production code path
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

  async function testEmail(email: string) {
    if (!email) {
      toast.error("Please enter an email address first");
      return;
    }

    try {
      const result = await testEmailViaWorker(email);
      if (result.success) {
        toast.success("Test email sent! Check your inbox (and spam).");
      } else {
        toast.error(result.error || "Test email failed. Please check your setup.");
      }
    } catch {
      toast.error("Failed to send test email. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Enable notifications and configure webhook URLs for each channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              <div className="ml-8 space-y-2">
                <Label htmlFor="notificationEmail" className={!emailEnabled ? "text-muted-foreground" : ""}>
                  Notification Email
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id="notificationEmail"
                      type="email"
                      placeholder="you@domain.com"
                      disabled={!emailEnabled}
                      {...register("notificationEmail")}
                    />
                    {errors.notificationEmail && notificationEmail && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.notificationEmail.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!emailEnabled || !notificationEmail || !!errors.notificationEmail}
                    onClick={() => testEmail(notificationEmail || "")}
                  >
                    <Webhook className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                {!emailEnabled && (
                  <p className="text-sm text-muted-foreground">
                    Enable Email notifications to set your email address
                  </p>
                )}
              </div>
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
                  <Input
                    id="slackWebhookUrl"
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    className="flex-1"
                    disabled={!slackEnabled}
                    {...register("slackWebhookUrl")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!slackEnabled}
                    onClick={() => testWebhook(slackWebhookUrl || "", "slack")}
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
                  <Input
                    id="discordWebhookUrl"
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    className="flex-1"
                    disabled={!discordEnabled}
                    {...register("discordWebhookUrl")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!discordEnabled}
                    onClick={() => testWebhook(discordWebhookUrl || "", "discord")}
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

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Notification Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
