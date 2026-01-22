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
  alerts: {
    subreddit: string;
  }[];
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
      // Get mock user from cookie
      const getCookie = (name: string) => {
        if (typeof window === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          const cookieValue = parts.pop()?.split(';').shift();
          return cookieValue ? decodeURIComponent(cookieValue) : null;
        }
        return null;
      };
      
      const mockUser = getCookie("dev_mock_user_id");
      if (!mockUser) {
        setError("No user session found. Please use the Dev Switcher first.");
        setLoading(false);
        return;
      }

      try {
        // Fetch all settings in parallel (filtered by mock user ID)
        const [settingsResult, profilesResult] = await Promise.all([
          supabase
            .from("project_settings")
            .select("*")
            .eq("user_id", mockUser)
            .maybeSingle(),
          supabase
            .from("client_profiles")
            .select("*")
            .eq("user_id", mockUser)
            .maybeSingle(),
        ]);

        // Get all user's alerts (multiple subreddits)
        const { data: alertsResult } = await supabase
          .from("alerts")
          .select("subreddit")
          .eq("user_id", mockUser);

        if (settingsResult.error) {
          console.error("Error fetching project_settings:", settingsResult.error);
        }
        if (profilesResult.error) {
          console.error("Error fetching client_profiles:", profilesResult.error);
        }

        setSettings({
          projectSettings: settingsResult.data || null,
          alerts: alertsResult || [],
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
  }, [supabase]);

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
                initialSubreddits={settings?.alerts?.map(a => a.subreddit) || []}
                initialSlackWebhookUrl={settings?.clientProfile?.slack_webhook_url || ""}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
