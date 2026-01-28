"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { SetupIssue } from "@/lib/setup-health";
import { Button } from "@/components/ui/button";

type Props = {
  issues: SetupIssue[];
};

const SESSION_STORAGE_KEY = "dismissed-setup-issues";
const LOCAL_STORAGE_KEY = "dismissed-setup-issues-permanent";

export function SetupReminderBanner({ issues }: Props) {
  const [dismissedSessionIds, setDismissedSessionIds] = useState<string[]>([]);
  const [dismissedPermanentIds, setDismissedPermanentIds] = useState<string[]>([]);

  // Load dismissed issue ids from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      const rawPermanent = window.localStorage.getItem(LOCAL_STORAGE_KEY);

      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (Array.isArray(parsed)) {
          setDismissedSessionIds(parsed);
        }
      }

      if (rawPermanent) {
        const parsed = JSON.parse(rawPermanent);
        if (Array.isArray(parsed)) {
          setDismissedPermanentIds(parsed);
        }
      }
    } catch {
      // If anything goes wrong, just ignore and show banners normally
    }
  }, []);

  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (issue) =>
          !dismissedSessionIds.includes(issue.id) &&
          !dismissedPermanentIds.includes(issue.id)
      ),
    [issues, dismissedSessionIds, dismissedPermanentIds]
  );

  // Show only the highest-severity visible issue for now
  const issueToShow = useMemo(() => {
    if (visibleIssues.length === 0) return null;

    const severityRank: Record<SetupIssue["severity"], number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...visibleIssues].sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    )[0];
  }, [visibleIssues]);

  if (!issueToShow) {
    return null;
  }

  const handleDismiss = () => {
    const next = [...dismissedSessionIds, issueToShow.id];
    setDismissedSessionIds(next);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
    }
  };

  const handleEmailEnough = () => {
    // Only applies to the Slack/Discord reminder issue
    // 1) Remember permanently that user is okay with email-only
    const nextPermanent = [...dismissedPermanentIds, issueToShow.id];
    setDismissedPermanentIds(nextPermanent);

    // 2) Also hide the entire banner for this session
    const allIssueIds = issues.map((issue) => issue.id);
    const nextSession = Array.from(new Set([...dismissedSessionIds, ...allIssueIds]));
    setDismissedSessionIds(nextSession);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextPermanent));
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      } catch {
        // Ignore storage errors
      }
    }
  };

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="font-medium">Finish your setup for better results</p>
        <p className="mt-1 text-xs sm:text-sm">{issueToShow.message}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            className="bg-amber-900 text-amber-50 hover:bg-amber-800"
          >
            <a href={issueToShow.ctaHref}>{issueToShow.ctaLabel}</a>
          </Button>

          {issueToShow.id === "missing_slack_discord" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-amber-900 hover:bg-amber-100"
              onClick={handleEmailEnough}
            >
              Email is enough
            </Button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="ml-2 mt-1 text-amber-700 hover:text-amber-900"
        aria-label="Dismiss reminder"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

