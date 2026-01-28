"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { LeadFeed } from "@/components/dashboard/LeadFeed";
import { LeadDetail } from "@/components/dashboard/LeadDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, LogIn } from "lucide-react";
import type { Post } from "@/types";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Post[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Create Supabase client once and reuse it
  const supabase = useMemo(() => createClient(), []);

  // Check real Supabase authentication
  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error checking user:", error);
          setUser(null);
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Error checking user:", error);
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    }

    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      // Clear selected lead when user changes
      if (newUser?.id !== user?.id) {
        setSelectedLeadId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, user?.id]);

  // Initial data fetch - filter by user_id via alerts
  useEffect(() => {
    async function fetchLeads() {
      if (!user) {
        setLeads([]);
        setLoading(false);
        return;
      }

      try {
        // First, get ALL the user's alert_id(s) (user can have multiple alerts)
        const { data: alertsData, error: alertsError } = await supabase
          .from("alerts")
          .select("id")
          .eq("user_id", user.id);

        if (alertsError) {
          console.error("Error fetching alerts:", alertsError);
          setLeads([]);
          setLoading(false);
          return;
        }

        // If user has no alerts, they have no leads
        if (!alertsData || alertsData.length === 0) {
          setLeads([]);
          setLoading(false);
          return;
        }

        // Get all alert IDs
        const alertIds = alertsData.map(alert => alert.id);

        // Fetch leads for ALL of this user's alerts (using .in() filter)
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("status", "new")
          .in("alert_id", alertIds)
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

    const currentUser = user;
    let channel: any = null;

    async function setupSubscription() {
      // Get ALL user's alert_ids (user can have multiple alerts)
      const { data: alertsData } = await supabase
        .from("alerts")
        .select("id")
        .eq("user_id", currentUser.id);

      if (!alertsData || alertsData.length === 0) return;

      // Subscribe to leads for ALL alerts
      // Note: Supabase real-time filters don't support .in() directly,
      // so we'll filter in the callback instead
      const alertIds = alertsData.map(alert => alert.id);
      
      channel = supabase
        .channel(`leads-channel-${currentUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "leads",
            filter: `status=eq.new`,
          },
          (payload) => {
            // Only add if the lead belongs to one of this user's alerts
            const newLead = payload.new as Post;
            if (alertIds.includes(newLead.alert_id)) {
              // Add new lead to the beginning of the array (newest first)
              setLeads((prev) => [newLead, ...prev]);
            }
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
            Discover new opportunities from Reddit posts
          </p>
        </div>
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
                    Please log in to view your leads
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
                onLeadDeleted={(leadId) => {
                  // Remove the deleted lead from the state
                  setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
                  // Clear selection if the deleted lead was selected
                  if (selectedLeadId === leadId) {
                    setSelectedLeadId(null);
                  }
                }}
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
