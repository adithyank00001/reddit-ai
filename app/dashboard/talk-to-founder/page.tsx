import { FounderContactCard } from "@/components/shared/FounderContactCard";

export default function TalkToFounderPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header (same pattern as other dashboard pages) */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Talk to the Founder</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reach out directly on WhatsApp for support and feature requests.
          </p>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <FounderContactCard />
        </div>
      </div>
    </div>
  );
}



