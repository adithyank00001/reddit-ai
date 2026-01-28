"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeywordManager } from "@/components/shared/KeywordManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getOnboardingData, saveOnboardingData } from "@/lib/onboarding-storage";

export default function OnboardingStep2Page() {
  const router = useRouter();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(true);

  // Load data from localStorage on mount
  useEffect(() => {
    const stored = getOnboardingData();
    if (stored.keywords && Array.isArray(stored.keywords)) {
      setKeywords(stored.keywords);
    }
  }, []);

  // Verify user authentication and onboarding completion
  // Check localStorage for step 1 data (website_url) instead of database
  useEffect(() => {
    async function verifyStep() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login?redirectTo=/onboarding/step-2");
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

        // Check localStorage or database for step 1 data
        const stored = getOnboardingData();
        const hasWebsiteUrl = stored.websiteUrl || settings?.website_url;
        
        if (!hasWebsiteUrl) {
          // No website URL in localStorage or database, redirect to step 1
          router.push("/onboarding/step-1");
          return;
        }

        // Allow access to step 2 (user has step 1 data)
        setIsChecking(false);
      } catch (error) {
        console.error("Error verifying step:", error);
        setIsChecking(false);
      }
    }

    verifyStep();
  }, [router]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const handleKeywordsChange = (newKeywords: string[]) => {
    setKeywords(newKeywords);
    // Auto-save to localStorage as user adds/removes keywords
    saveOnboardingData({
      keywords: newKeywords,
    });
  };

  const handleContinue = async () => {
    // Validate keywords
    if (keywords.length === 0) {
      toast.error("Please add at least one keyword");
      return;
    }

    if (keywords.length > 10) {
      toast.error("Maximum 10 keywords allowed");
      return;
    }

    // Save to localStorage (not database yet)
    saveOnboardingData({
      keywords,
    });

    // Redirect to step 3 (subreddits - future)
    router.push("/onboarding/step-3");
  };

  // Check if form is valid (at least 1 keyword required)
  const isFormValid = keywords.length >= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Define your keywords</CardTitle>
        <CardDescription>
          Step 2 of 5: Add keywords to track on Reddit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <KeywordManager
          keywords={keywords}
          onChange={handleKeywordsChange}
          maxKeywords={10}
          minKeywords={1}
          placeholder="e.g., saas, startup, marketing"
          label="Keywords"
          showCounter={false}
        />
        <p className="text-sm text-muted-foreground">
          These keywords help us find relevant Reddit posts that match your product. You can add up to 10 keywords during onboarding.
        </p>

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/step-1")}
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
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
