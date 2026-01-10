import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Post } from "@/types";
import { logger } from "@/lib/logger";
import { updateGlobalSettings } from "@/app/actions/globalSettings";
import { ReplyDraftSection } from "@/components/ReplyDraftSection";

export const dynamic = 'force-dynamic';

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

function getScoreBadgeVariant(score: number | null | undefined): string {
  if (score === null || score === undefined) return "";
  if (score > 79) return "bg-green-500 text-white border-transparent";
  if (score > 69) return "bg-yellow-500 text-white border-transparent";
  return "bg-gray-500 text-white border-transparent";
}

type GlobalSettings = {
  product_description_raw: string | null;
  product_context: string | null;
  keywords: string[] | null;
};

async function getGlobalSettings(): Promise<GlobalSettings> {
  logger.dbQuery("SELECT", "project_settings", { operation: "global_fetch" });
  const { data, error } = await supabase
    .from("project_settings")
    .select("product_description_raw, product_context, keywords")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    logger.error("GLOBAL_FETCH", "Failed to load global project settings", {
      message: error.message,
    });
    return {
      product_description_raw: null,
      product_context: null,
      keywords: null,
    };
  }

  logger.info("GLOBAL_FETCH", "Loaded global project settings", {
    hasContext: !!data?.product_context,
    keywordCount: Array.isArray(data?.keywords) ? data?.keywords.length : 0,
  });

  return (data as GlobalSettings) || {
    product_description_raw: null,
    product_context: null,
    keywords: null,
  };
}

export default async function DashboardPage() {
  const [posts, stats, globalSettings] = await Promise.all([
    getPosts(),
    getStats(),
    getGlobalSettings(),
  ]);

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

      {/* Global Configuration */}
      <div className="space-y-4 mb-12">
        <h2 className="text-2xl font-semibold mb-4">Global Configuration</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Product & Keywords</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={updateGlobalSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Product description
                </label>
                <textarea
                  name="rawDescription"
                  defaultValue={globalSettings.product_description_raw ?? ""}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Paste a long, messy description of your product here. Example: We build an AI chatbot for Shopify stores that answers customer questions 24/7..."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The AI will generate a concise context (about 15–20 words) used across all alerts.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Global keywords
                </label>
                <input
                  type="text"
                  name="keywordsString"
                  defaultValue={
                    Array.isArray(globalSettings.keywords)
                      ? globalSettings.keywords.join(", ")
                      : ""
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Example: saas, marketing, ai, chatbot"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Comma-separated keywords monitored across all alerts and subreddits.
                </p>
              </div>
              <Button
                type="submit"
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save &amp; Optimize Configuration
              </Button>
            </form>
            <div>
              <p className="text-sm font-medium mb-1">Current summarized context</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {globalSettings.product_context
                  ? globalSettings.product_context
                  : "Not set yet. Save a product description to generate it."}
              </p>
            </div>
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
                  {post.opportunity_score !== null && post.opportunity_score !== undefined && (
                    <Badge className={getScoreBadgeVariant(post.opportunity_score)}>
                      Score: {post.opportunity_score}
                    </Badge>
                  )}
                  <CardTitle className="text-lg">{post.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {truncateText(post.body)}
                </p>
                
                {post.opportunity_reason && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-semibold mb-2">Why this lead?</p>
                    <p className="text-sm text-muted-foreground">{post.opportunity_reason}</p>
                  </div>
                )}
                
                {post.suggested_angle && (
                  <div className="pt-3 border-t bg-muted/50 p-3 rounded-md">
                    <p className="text-sm font-semibold mb-2">Suggested Angle</p>
                    <p className="text-sm text-muted-foreground">{post.suggested_angle}</p>
                  </div>
                )}
                
                <ReplyDraftSection
                  replyDraft={post.reply_draft}
                  redditUrl={post.url}
                  leadId={post.id}
                />
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
