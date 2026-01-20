"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase-client";
import { LeadFeed } from "@/components/dashboard/LeadFeed";
import { LeadDetail } from "@/components/dashboard/LeadDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { MessageSquare } from "lucide-react";
import type { Post } from "@/types";

export default function DashboardPage() {
  const [leads, setLeads] = useState<Post[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Create Supabase client once and reuse it
  const supabase = useMemo(() => createClient(), []);

  // Initial data fetch
  useEffect(() => {
    async function fetchLeads() {
      try {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("status", "new")
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

    fetchLeads();
  }, [supabase]);

  // Real-time subscription for new leads
  useEffect(() => {
    const channel = supabase
      .channel("leads-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
          filter: "status=eq.new",
        },
        (payload) => {
          // Add new lead to the beginning of the array (newest first)
          setLeads((prev) => [payload.new as Post, ...prev]);
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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
    </div>
  );
}
