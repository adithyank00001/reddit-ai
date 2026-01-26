import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getOnboardingStep } from "@/lib/onboarding";

/**
 * Onboarding Layout
 * Minimal layout without sidebar/navbar for focused onboarding experience
 * Checks authentication and completion status
 * Only redirects if onboarding is complete or user is not authenticated
 * Allows children to render so users can stay on their current step
 */
export default async function OnboardingLayout({
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
  if (!user) {
    redirect("/login?redirectTo=/onboarding/step-1");
  }

  // Get the step the user should be on based on their progress
  const requiredStep = await getOnboardingStep();

  // If onboarding is complete, redirect to dashboard
  // This is the only redirect we do - we let users stay on their current step
  // Each step page will handle verifying the user should be on that step
  if (!requiredStep) {
    redirect("/dashboard");
  }

  // Don't redirect here - let the children render
  // Each step page will verify the user should be on that step
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}
