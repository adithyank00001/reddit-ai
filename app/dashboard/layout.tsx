import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getOnboardingStep } from "@/lib/onboarding";
import { getSetupIssues } from "@/lib/setup-health";

/**
 * Dashboard Layout
 * Wraps all dashboard pages with the global navigation sidebar
 * Server Layout Guard: Protects dashboard routes with authentication and onboarding completion
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user, redirect to login
  // The login page will redirect back to /dashboard after successful login
  if (!user) {
    redirect("/login");
  }

  // Check if user has completed onboarding
  // If not, redirect them to the appropriate onboarding step
  const requiredStep = await getOnboardingStep();
  if (requiredStep) {
    redirect(requiredStep);
  }

  // Check for any setup issues to show as reminders in the dashboard
  const setupIssues = await getSetupIssues();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <DashboardShell setupIssues={setupIssues}>
        {children}
      </DashboardShell>
    </div>
  );
}
