"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LeadCard } from "./LeadCard";
import type { Post } from "@/types";
import { Inbox } from "lucide-react";

interface LeadFeedProps {
  leads: Post[];
  selectedLeadId?: string | null;
  onLeadSelect?: (leadId: string) => void;
}

export function LeadFeed({ leads, selectedLeadId, onLeadSelect }: LeadFeedProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No leads found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {leads.map((lead, index) => (
          <div key={lead.id}>
            <LeadCard
              lead={lead}
              isSelected={selectedLeadId === lead.id}
              onClick={() => onLeadSelect?.(lead.id)}
            />
            {index < leads.length - 1 && <Separator className="my-2" />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
