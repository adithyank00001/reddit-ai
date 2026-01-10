"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateReplyDraftForLead } from "@/app/actions/generateReplyDraft";

interface ReplyDraftSectionProps {
  replyDraft: string | null | undefined;
  redditUrl: string;
  leadId: string;
}

export function ReplyDraftSection({ replyDraft, redditUrl, leadId }: ReplyDraftSectionProps) {
  const [copied, setCopied] = useState(false);
  const [draftText, setDraftText] = useState(replyDraft || "");
  const [isGenerating, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Sync draftText with replyDraft prop when it changes (e.g., after generation)
  useEffect(() => {
    if (replyDraft && replyDraft.trim().length > 0) {
      setDraftText(replyDraft);
    }
  }, [replyDraft]);

  // Show "Generate Reply" button if no draft exists
  if (!replyDraft || replyDraft.trim().length === 0) {
    const handleGenerate = () => {
      setError(null);
      startTransition(async () => {
        const result = await generateReplyDraftForLead(leadId);
        if (result.success && result.draft) {
          // Update local state with the new draft
          setDraftText(result.draft);
          // Refresh the page data (revalidatePath in the action should have updated the cache)
          router.refresh();
        } else {
          setError(result.error || "Failed to generate draft");
        }
      });
    };

    return (
      <div className="pt-3 border-t bg-gray-50 dark:bg-gray-900/20 p-4 rounded-md">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">💬 Reply Draft</p>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="default"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Reply"}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          No draft available yet. Click "Generate Reply" to create one.
        </p>
      </div>
    );
  }

  const handleCopyAndOpen = async () => {
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(draftText);
      
      setCopied(true);
      
      // Reset "Copied!" message after 2 seconds
      setTimeout(() => setCopied(false), 2000);

      // Open Reddit in new tab
      window.open(redditUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      // Show user-friendly error (could be enhanced with a toast library)
      alert("Failed to copy to clipboard. Please copy manually.");
    }
  };

  return (
    <div className="pt-3 border-t bg-blue-50 dark:bg-blue-950/20 p-4 rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">💬 Draft Reply</p>
        <Button
          onClick={handleCopyAndOpen}
          variant="default"
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {copied ? "✓ Copied!" : "Copy & Open Reddit"}
        </Button>
      </div>
      <textarea
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
        placeholder="Reply draft will appear here..."
      />
      <p className="text-xs text-muted-foreground">
        Edit the draft above if needed, then click "Copy & Open Reddit" to copy and open the post.
      </p>
    </div>
  );
}
