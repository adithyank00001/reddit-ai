"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WebsiteAnalyzerForm, validateWebsiteAnalyzerForm } from "@/components/onboarding/WebsiteAnalyzerForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getOnboardingData, saveOnboardingData } from "@/lib/onboarding-storage";

export default function OnboardingStep1Page() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load data from localStorage on mount (before rendering form)
  useEffect(() => {
    const stored = getOnboardingData();
    if (stored.websiteUrl) {
      setWebsiteUrl(stored.websiteUrl);
    }
    if (stored.productDescription) {
      setDescription(stored.productDescription);
    }
    setIsLoadingData(false);
  }, []);

  // Verify user authentication and onboarding completion
  // Allow users to go back to step 1 even if they've completed it (for editing)
  useEffect(() => {
    async function verifyStep() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login?redirectTo=/onboarding/step-1");
          return;
        }

        const { data: settings } = await supabase
          .from("project_settings")
          .select("website_url, keywords")
          .eq("user_id", user.id)
          .maybeSingle();

        // Check if user has active subreddits in alerts table
        const { data: alerts } = await supabase
          .from("alerts")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);

        const hasSubreddits = alerts && alerts.length > 0;

        // Check if step 4 (Reply Intelligence) is complete
        const { data: replySettings } = await supabase
          .from("project_settings")
          .select("reply_mode")
          .eq("user_id", user.id)
          .maybeSingle();

        // Only redirect to dashboard if onboarding is fully complete (including step 4)
        // This allows users to go back to any step to edit their information
        if (settings?.website_url && settings.keywords && settings.keywords.length > 0 && hasSubreddits && replySettings?.reply_mode) {
          router.push("/dashboard");
          return;
        }

        // Allow access to step 1 (user can always go back to edit)
        setIsChecking(false);
      } catch (error) {
        console.error("Error verifying step:", error);
        setIsChecking(false);
      }
    }

    verifyStep();
  }, [router]);

  // Show loading state while checking or loading data
  if (isChecking || isLoadingData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const handleFormChange = (data: { websiteUrl: string; description: string }) => {
    setWebsiteUrl(data.websiteUrl);
    setDescription(data.description);
    // Auto-save to localStorage as user types
    saveOnboardingData({
      websiteUrl: data.websiteUrl,
      productDescription: data.description,
    });
  };

  const handleContinue = async () => {
    // Validate form data
    const validation = validateWebsiteAnalyzerForm({
      websiteUrl,
      description,
    });

    if (!validation.isValid) {
      // Show first error message (ZodError uses .issues, not .errors)
      const firstError = validation.errors?.issues?.[0];
      if (firstError) {
        toast.error(firstError.message);
      } else {
        toast.error("Please fill in all required fields");
      }
      return;
    }

    // Save to localStorage (not database yet)
    saveOnboardingData({
      websiteUrl,
      productDescription: description,
    });

    // Redirect to step 2 (keywords)
    router.push("/onboarding/step-2");
  };

  // Check if form is valid (both fields required)
  const isFormValid =
    websiteUrl.trim().length > 0 && description.trim().length >= 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Welcome! Let's get started</CardTitle>
        <CardDescription>
          Step 1 of 5: Tell us about your product
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <WebsiteAnalyzerForm
          initialWebsiteUrl={websiteUrl}
          initialDescription={description}
          onChange={handleFormChange}
        />

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/login")}
            size="lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!isFormValid}
            size="lg"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
