"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase-client";
import { LeadFeed } from "@/components/dashboard/LeadFeed";
import { LeadDetail } from "@/components/dashboard/LeadDetail";
import { DevUserSwitcher } from "@/components/dashboard/DevUserSwitcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { MessageSquare, LogIn } from "lucide-react";
import type { Post } from "@/types";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Post[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Create Supabase client once and reuse it
  const supabase = useMemo(() => createClient(), []);

  // Get mock user ID from global state (dev mode)
  const getMockUser = () => {
    if (typeof window !== 'undefined' && (window as any).__mockUserId) {
      return { id: (window as any).__mockUserId, email: (window as any).__mockUserEmail };
    }
    return null;
  };

  // Check mock authentication
  useEffect(() => {
    function checkUser() {
      const mockUser = getMockUser();
      setUser(mockUser);
      setUserLoading(false);
    }

    checkUser();

    // Listen for mock auth changes (simplified - just recheck periodically)
    const interval = setInterval(() => {
      const newUser = getMockUser();
      setUser(newUser);
      // Clear selected lead when user changes
      if (newUser?.id !== user?.id) {
        setSelectedLeadId(null);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [user?.id]);

  // Initial data fetch - filter by user_id via alerts
  useEffect(() => {
    async function fetchLeads() {
      if (!user) {
        setLeads([]);
        setLoading(false);
        return;
      }

      try {
        // First, get the user's alert_id(s)
        const { data: alertsData, error: alertsError } = await supabase
          .from("alerts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (alertsError) {
          console.error("Error fetching alerts:", alertsError);
          setLeads([]);
          setLoading(false);
          return;
        }

        // If user has no alerts, they have no leads
        if (!alertsData) {
          setLeads([]);
          setLoading(false);
          return;
        }

        // Fetch leads for this user's alert
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("status", "new")
          .eq("alert_id", alertsData.id)
          .order("created_utc", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching leads:", error);
          return;
        }

        setLeads((data as Post[]) || []);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!userLoading) {
      fetchLeads();
    }
  }, [supabase, user, userLoading]);

  // Real-time subscription for new leads - filter by user's alerts
  useEffect(() => {
    if (!user) return;

    let channel: any = null;

    async function setupSubscription() {
      // Get user's alert_id
      const { data: alertsData } = await supabase
        .from("alerts")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!alertsData) return;

      channel = supabase
        .channel(`leads-channel-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "leads",
            filter: `status=eq.new&alert_id=eq.${alertsData.id}`,
          },
          (payload) => {
            // Add new lead to the beginning of the array (newest first)
            setLeads((prev) => [payload.new as Post, ...prev]);
          }
        )
        .subscribe();
    }

    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, user]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reddit opportunities with status: new
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="p-4 border-b">
        <DevUserSwitcher />
      </div>

      {userLoading ? (
        <div className="flex-1 p-4">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      ) : !user ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <LogIn className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No User Logged In</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Use the Dev User Switcher above to log in or create a test account
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div
          className={`flex-1 grid gap-0 overflow-hidden ${
            selectedLeadId ? "grid-cols-[1fr_400px]" : "grid-cols-1"
          }`}
        >
          {/* Left Column: Lead Feed */}
          <div className={selectedLeadId ? "border-r overflow-hidden" : "overflow-hidden"}>
            {loading ? (
              <div className="p-4 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-32 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <LeadFeed
                leads={leads}
                selectedLeadId={selectedLeadId}
                onLeadSelect={setSelectedLeadId}
              />
            )}
          </div>

          {/* Right Column: Detail View - Only shown when a lead is selected */}
          {selectedLeadId && (
            <div className="p-4 overflow-y-auto">
              <LeadDetail leadId={selectedLeadId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
