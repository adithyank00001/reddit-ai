"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings } from "@/app/actions/settings";
import { toast } from "sonner";
import { Loader2, Webhook } from "lucide-react";

const notificationSchema = z.object({
  subreddit: z.string().min(1, "Subreddit is required").regex(/^[a-zA-Z0-9_]+$/, "Invalid subreddit name"),
  slackWebhookUrl: z.string().url("Invalid webhook URL").optional().or(z.literal("")),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

interface NotificationSettingsProps {
  initialSubreddit?: string;
  initialSlackWebhookUrl?: string;
}

export function NotificationSettings({
  initialSubreddit = "",
  initialSlackWebhookUrl = "",
}: NotificationSettingsProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      subreddit: initialSubreddit,
      slackWebhookUrl: initialSlackWebhookUrl,
    },
  });

  async function onSubmit(data: NotificationFormData) {
    const formData = new FormData();
    formData.append("subreddit", data.subreddit);
    formData.append("slackWebhookUrl", data.slackWebhookUrl || "");

    const result = await updateSettings(formData);

    if (result.success) {
      toast.success("Notification settings saved successfully!");
    } else {
      toast.error(result.error || "Failed to save settings");
    }
  }

  async function testWebhook(webhookUrl: string) {
    if (!webhookUrl) {
      toast.error("Please enter a webhook URL first");
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "🧪 Test message from Reddit Lead Gen - Your webhook is working!",
        }),
      });

      if (response.ok) {
        toast.success("Webhook test successful! Check your Slack channel.");
      } else {
        toast.error("Webhook test failed. Please check your URL.");
      }
    } catch (error) {
      toast.error("Failed to test webhook. Please check your URL.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Configure where to scrape and where to send notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="subreddit">Subreddit</Label>
            <Input
              id="subreddit"
              placeholder="saas"
              {...register("subreddit")}
            />
            <p className="text-sm text-muted-foreground">
              The subreddit to monitor for leads (without the r/ prefix)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="slackWebhookUrl"
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                className="flex-1"
                {...register("slackWebhookUrl")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const url = (document.getElementById("slackWebhookUrl") as HTMLInputElement)?.value;
                  testWebhook(url);
                }}
              >
                <Webhook className="h-4 w-4 mr-2" />
                Test
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Optional: Receive notifications in Slack when new leads are found
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Notification Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
