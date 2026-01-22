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

  // Get mock user ID from cookie (dev mode)
  const getMockUser = () => {
    if (typeof window === 'undefined') return null;
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:26',message:'getMockUser: Reading cookies',data:{allCookies:document.cookie},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    // Read from cookie instead of window global
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        const cookieValue = parts.pop()?.split(';').shift();
        // Decode URL-encoded values (e.g., %40 becomes @)
        return cookieValue ? decodeURIComponent(cookieValue) : null;
      }
      return null;
    };
    
    const userId = getCookie("dev_mock_user_id");
    const email = getCookie("dev_mock_user_email");
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:38',message:'getMockUser: Cookie values',data:{userId,email},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    if (userId && email) {
      return { id: userId, email };
    }
    return null;
  };

  // Check mock authentication
  useEffect(() => {
    function checkUser() {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:45',message:'checkUser: Initial check',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const mockUser = getMockUser();
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:48',message:'checkUser: User state set',data:{userId:mockUser?.id,email:mockUser?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setUser(mockUser);
      setUserLoading(false);
    }

    checkUser();
  }, []);

  // Initial data fetch - filter by user_id via alerts
  useEffect(() => {
    async function fetchLeads() {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:76',message:'fetchLeads: Starting',data:{hasUser:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
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

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:90',message:'fetchLeads: Alerts query result',data:{alertCount:alertsData?.length||0,alertIds:alertsData?.map(a=>a.id),error:alertsError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

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

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:115',message:'fetchLeads: Leads query result',data:{leadCount:data?.length||0,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})}).catch(()=>{});
        // #endregion

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
      // Get ALL user's alert_ids (user can have multiple alerts)
      const { data: alertsData } = await supabase
        .from("alerts")
        .select("id")
        .eq("user_id", user.id);

      if (!alertsData || alertsData.length === 0) return;

      // Subscribe to leads for ALL alerts
      // Note: Supabase real-time filters don't support .in() directly,
      // so we'll filter in the callback instead
      const alertIds = alertsData.map(alert => alert.id);
      
      channel = supabase
        .channel(`leads-channel-${user.id}`)
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
            Reddit opportunities with status: new
            {user?.email && (
              <span className="ml-2 text-orange-500 font-medium">
                • Logged in as: {user.email}
              </span>
            )}
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
