"use client";

import type { ReactNode } from "react";
import type { SetupIssue } from "@/lib/setup-health";
import { SetupReminderBanner } from "@/components/dashboard/SetupReminderBanner";

type Props = {
  children: ReactNode;
  setupIssues: SetupIssue[];
};

export function DashboardShell({ children, setupIssues }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex h-full max-w-6xl flex-col">
          <SetupReminderBanner issues={setupIssues} />
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

