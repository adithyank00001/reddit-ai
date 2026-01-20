"use client";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Post } from "@/types";
import { ChevronRight } from "lucide-react";

interface LeadCardProps {
  lead: Post;
  isSelected?: boolean;
  onClick?: () => void;
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

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number = 60): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function LeadCard({ lead, isSelected = false, onClick }: LeadCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight flex-1">
            {truncateText(lead.title, 60)}
          </CardTitle>
          {lead.opportunity_score !== null && lead.opportunity_score !== undefined && (
            <Badge className={cn("shrink-0", getScoreBadgeStyle(lead.opportunity_score))}>
              {lead.opportunity_score}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            r/{lead.subreddit}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Posted {formatRelativeTime(lead.created_utc)}
          </span>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 pb-3 flex justify-end">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </CardFooter>
    </Card>
  );
}
