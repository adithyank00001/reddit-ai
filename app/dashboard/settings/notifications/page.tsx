"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { NotificationSettings } from "@/components/dashboard/settings/NotificationSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";

interface SettingsData {
  projectSettings: {
    slack_webhook_url?: string;
    discord_webhook_url?: string;
    email_notifications_enabled?: boolean;
    slack_notifications_enabled?: boolean;
    discord_notifications_enabled?: boolean;
  } | null;
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function fetchSettings() {
    try {
      setLoading(true);
      // Get real user from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setError("Unauthorized. Please log in.");
        setLoading(false);
        return;
      }

      const userId = user.id;

      // Fetch project settings
      const { data: settingsResult, error: settingsError } = await supabase
        .from("project_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (settingsError) {
        console.error("Error fetching project_settings:", settingsError);
        setError("Failed to load settings. Please try again.");
        return;
      }

      setSettings({
        projectSettings: settingsResult || null,
      });
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">Notification Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure how you receive notifications for new leads
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-10 w-32" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">Notification Settings</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Notification Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure how you receive notifications for new leads
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <NotificationSettings
            initialSlackWebhookUrl={settings?.projectSettings?.slack_webhook_url || ""}
            initialDiscordWebhookUrl={settings?.projectSettings?.discord_webhook_url || ""}
            initialEmailNotificationsEnabled={settings?.projectSettings?.email_notifications_enabled || false}
            initialSlackNotificationsEnabled={settings?.projectSettings?.slack_notifications_enabled || false}
            initialDiscordNotificationsEnabled={settings?.projectSettings?.discord_notifications_enabled || false}
          />
        </div>
      </div>
    </div>
  );
}
