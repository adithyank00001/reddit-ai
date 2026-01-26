"use client";

import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadCard } from "./LeadCard";
import type { Post } from "@/types";
import { Inbox, ArrowUpDown } from "lucide-react";

type SortOption = "best" | "lowest" | "newest" | "oldest";

interface LeadFeedProps {
  leads: Post[];
  selectedLeadId?: string | null;
  onLeadSelect?: (leadId: string) => void;
  onLeadDeleted?: (leadId: string) => void;
}

export function LeadFeed({ leads, selectedLeadId, onLeadSelect, onLeadDeleted }: LeadFeedProps) {
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  // Sort leads based on selected option
  const sortedLeads = useMemo(() => {
    const leadsCopy = [...leads];

    switch (sortOption) {
      case "best":
        // Highest opportunity_score first (descending)
        return leadsCopy.sort((a, b) => {
          const scoreA = a.opportunity_score ?? 0;
          const scoreB = b.opportunity_score ?? 0;
          return scoreB - scoreA;
        });

      case "lowest":
        // Lowest opportunity_score first (ascending)
        return leadsCopy.sort((a, b) => {
          const scoreA = a.opportunity_score ?? 0;
          const scoreB = b.opportunity_score ?? 0;
          return scoreA - scoreB;
        });

      case "newest":
        // Highest created_utc first (descending - newest first)
        return leadsCopy.sort((a, b) => b.created_utc - a.created_utc);

      case "oldest":
        // Lowest created_utc first (ascending - oldest first)
        return leadsCopy.sort((a, b) => a.created_utc - b.created_utc);

      default:
        return leadsCopy;
    }
  }, [leads, sortOption]);

  const getSortLabel = (option: SortOption): string => {
    switch (option) {
      case "best":
        return "Best Matches";
      case "lowest":
        return "Lowest Matches";
      case "newest":
        return "Newest";
      case "oldest":
        return "Oldest";
      default:
        return "Newest";
    }
  };


  if (sortedLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No leads found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sorting Dropdown */}
      <div className="p-4 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort: {getSortLabel(sortOption)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSortOption("best")}>
              Best Matches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("lowest")}>
              Lowest Matches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("newest")}>
              Newest
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("oldest")}>
              Oldest
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Lead List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {sortedLeads.map((lead, index) => (
            <div key={lead.id}>
              <LeadCard
                lead={lead}
                isSelected={selectedLeadId === lead.id}
                onClick={() => onLeadSelect?.(lead.id)}
                onDeleted={() => {
                  // Notify parent to remove this lead from the list
                  onLeadDeleted?.(lead.id);
                }}
              />
              {index < sortedLeads.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
