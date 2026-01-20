"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { ScraperSettings } from "@/components/dashboard/settings/ScraperSettings";
import { NotificationSettings } from "@/components/dashboard/settings/NotificationSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Search, Bell } from "lucide-react";
import { useRouter } from "next/navigation";

interface SettingsData {
  projectSettings: {
    keywords?: string[];
    product_description_raw?: string;
  } | null;
  alert: {
    subreddit?: string;
  } | null;
  clientProfile: {
    slack_webhook_url?: string;
  } | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchSettings() {
      try {
        // Check authentication first
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setError("Not authenticated. Please log in.");
          router.push("/");
          return;
        }

        // Fetch all settings in parallel
        const [settingsResult, alertsResult, profilesResult] = await Promise.all([
          supabase
            .from("project_settings")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("alerts")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("client_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (settingsResult.error) {
          console.error("Error fetching project_settings:", settingsResult.error);
        }
        if (alertsResult.error) {
          console.error("Error fetching alerts:", alertsResult.error);
        }
        if (profilesResult.error) {
          console.error("Error fetching client_profiles:", profilesResult.error);
        }

        setSettings({
          projectSettings: settingsResult.data || null,
          alert: alertsResult.data || null,
          clientProfile: profilesResult.data || null,
        });
      } catch (err) {
        console.error("Error fetching settings:", err);
        setError("Failed to load settings. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b p-4">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your scraper and notification preferences
          </p>
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
          <h1 className="text-2xl font-bold">Settings</h1>
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
          <Settings className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your scraper and notification preferences
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="scraper" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="scraper" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Scraper
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scraper" className="space-y-4">
              <ScraperSettings
                initialKeywords={settings?.projectSettings?.keywords || []}
                initialProductDescription={settings?.projectSettings?.product_description_raw || ""}
              />
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <NotificationSettings
                initialSubreddit={settings?.alert?.subreddit || ""}
                initialSlackWebhookUrl={settings?.clientProfile?.slack_webhook_url || ""}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
