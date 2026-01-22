"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ReplyDraftSection } from "@/components/ReplyDraftSection";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Post } from "@/types";
import { ExternalLink, AlertCircle } from "lucide-react";

interface LeadDetailProps {
  leadId: string;
}

/**
 * Get the badge variant and styling for opportunity score
 * Theme-aware colors that work in both light and dark mode
 */
function getScoreBadgeStyle(score: number | null | undefined): string {
  if (score === null || score === undefined) return "";
  
  if (score > 80) {
    return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 dark:border-green-500/20";
  }
  if (score > 50) {
    return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 dark:border-yellow-500/20";
  }
  return "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30 dark:border-red-500/20";
}

export function LeadDetail({ leadId }: LeadDetailProps) {
  const [lead, setLead] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchLead() {
      if (!leadId) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .single();

        if (fetchError) {
          console.error("Error fetching lead:", fetchError);
          setError("Failed to load lead details");
          return;
        }

        setLead(data as Post);
      } catch (err) {
        console.error("Error fetching lead:", err);
        setError("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchLead();
  }, [leadId, supabase]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Separator />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">
              {error || "Lead not found"}
            </p>
            <p className="text-xs text-muted-foreground">
              Please try selecting another lead
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl font-bold leading-tight pr-2">
            {lead.title}
          </CardTitle>
          {lead.opportunity_score !== null && lead.opportunity_score !== undefined && (
            <Badge className={cn("shrink-0", getScoreBadgeStyle(lead.opportunity_score))}>
              Score: {lead.opportunity_score}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            r/{lead.subreddit}
          </Badge>
          <Badge variant="outline" className="text-xs">
            u/{lead.author}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Posted {formatRelativeTime(lead.created_utc)}
          </span>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
        >
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View on Reddit
          </a>
        </Button>
      </div>

      <Separator />

      {/* Post Body */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {lead.body || "No content available"}
          </p>
        </CardContent>
      </Card>

      {/* Opportunity Analysis */}
      {lead.opportunity_reason && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why this lead?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lead.opportunity_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Suggested Angle */}
      {lead.suggested_angle && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Suggested Angle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lead.suggested_angle}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reply Draft Section */}
      <ReplyDraftSection
        replyDraft={lead.ai_reply}
        redditUrl={lead.url}
        leadId={lead.id}
      />
    </div>
  );
}
