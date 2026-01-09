import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Post } from "@/types";
import { logger } from "@/lib/logger";

async function getPosts(): Promise<Post[]> {
  logger.step("DASHBOARD", "Fetching leads for dashboard");
  logger.dbQuery("SELECT", "leads", { operation: "dashboard_fetch", limit: 50 });
  const startTime = Date.now();
  
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_utc", { ascending: false })
    .limit(50);

  const queryTime = Date.now() - startTime;

  if (error) {
    logger.dbError("SELECT", "leads", error);
    logger.error("DASHBOARD", "Error fetching posts", { error: error.message });
    return [];
  }

  logger.info("DASHBOARD", `Fetched ${data?.length || 0} leads`, { queryTime: `${queryTime}ms` });
  return (data as Post[]) || [];
}

async function getStats() {
  logger.step("DASHBOARD", "Fetching dashboard statistics");
  const statsStart = Date.now();
  
  logger.dbQuery("SELECT", "leads", { operation: "count" });
  logger.dbQuery("SELECT", "alerts", { operation: "count" });
  
  const [postsResult, alertsResult] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("alerts").select("*", { count: "exact", head: true }),
  ]);

  const totalLeads = postsResult.count || 0;
  const totalAlerts = alertsResult.count || 0;

  // Get active alerts count
  logger.dbQuery("SELECT", "alerts", { operation: "active_count", filter: "is_active=true" });
  const { count: activeAlertsCount } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const activeAlerts = activeAlertsCount || 0;
  const statsTime = Date.now() - statsStart;

  logger.info("DASHBOARD", "Dashboard statistics fetched", {
    totalLeads,
    totalAlerts,
    activeAlerts,
    queryTime: `${statsTime}ms`
  });

  return { totalLeads, activeAlerts };
}

function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export default async function DashboardPage() {
  const [posts, stats] = await Promise.all([getPosts(), getStats()]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.activeAlerts}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Feed */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold mb-4">Lead Feed</h2>
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No leads found yet. Check back later!
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{post.subreddit}</Badge>
                  <CardTitle className="text-lg">{post.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {truncateText(post.body)}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Reddit
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
