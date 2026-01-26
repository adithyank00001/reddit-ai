"use client";

import { useEffect, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ArrowRight, X, Plus } from "lucide-react";
import { getOnboardingData, saveOnboardingData, getAllOnboardingData, clearOnboardingData } from "@/lib/onboarding-storage";
import { saveCompleteOnboarding } from "@/app/actions/onboarding";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function OnboardingStep3Page() {
  const router = useRouter();
  const [subreddits, setSubreddits] = useState<string[]>([]);
  const [currentSubreddit, setCurrentSubreddit] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Load data from localStorage on mount
  useEffect(() => {
    const stored = getOnboardingData();
    if (stored.subreddits && Array.isArray(stored.subreddits)) {
      setSubreddits(stored.subreddits);
    }
  }, []);

  // Verify user authentication and step 2 completion
  useEffect(() => {
    async function verifyStep() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login?redirectTo=/onboarding/step-3");
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
        // If step 4 is not complete (reply_mode is null), allow user to stay on step 3
        // This allows users to go back from step 4 to step 3 to edit their subreddits
        if (settings?.website_url && settings.keywords && settings.keywords.length > 0 && hasSubreddits && replySettings?.reply_mode) {
          router.push("/dashboard");
          return;
        }

        // Check localStorage or database for step 1 and step 2 data
        const stored = getOnboardingData();
        const hasWebsiteUrl = stored.websiteUrl || settings?.website_url;
        const hasKeywords = (stored.keywords && stored.keywords.length > 0) || 
                           (settings?.keywords && settings.keywords.length > 0);
        
        // If no website_url, redirect to step 1
        if (!hasWebsiteUrl) {
          router.push("/onboarding/step-1");
          return;
        }
        
        // If no keywords, redirect to step 2
        if (!hasKeywords) {
          router.push("/onboarding/step-2");
          return;
        }

        // Allow access to step 3 (user has completed step 1 and 2, but not step 3 yet)
        setIsChecking(false);
      } catch (error) {
        console.error("Error verifying step:", error);
        setIsChecking(false);
      }
    }

    verifyStep();
  }, [router]);

  const addSubreddit = (value: string) => {
    let clean = value.trim().toLowerCase();
    if (!clean) return;

    // Check if already at max limit (10 subreddits)
    if (subreddits.length >= 10) {
      return;
    }

    // Allow user to type "r/saas" or "saas"
    if (clean.startsWith("r/")) {
      clean = clean.slice(2);
    }

    if (!clean) return;

    if (!subreddits.includes(clean)) {
      const newSubreddits = [...subreddits, clean];
      setSubreddits(newSubreddits);
      // Auto-save to localStorage
      saveOnboardingData({
        subreddits: newSubreddits,
      });
    }
    setCurrentSubreddit("");
  };

  const removeSubreddit = (value: string) => {
    const newSubreddits = subreddits.filter((s) => s !== value);
    setSubreddits(newSubreddits);
    // Auto-save to localStorage
    saveOnboardingData({
      subreddits: newSubreddits,
    });
  };

  const handleSubredditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubreddit(currentSubreddit);
    }
  };

  const handleComplete = async () => {
    // Validate subreddits
    if (subreddits.length === 0) {
      toast.error("Please add at least one subreddit");
      return;
    }

    // Get all data from localStorage
    const data = getAllOnboardingData();

    // Validate that we have all required data
    if (!data.websiteUrl || !data.productDescription || !data.keywords || data.keywords.length === 0) {
      toast.error("Please complete all previous steps");
      router.push("/onboarding/step-1");
      return;
    }

    // Save to database
    setIsSaving(true);
    try {
      const result = await saveCompleteOnboarding(
        data.websiteUrl,
        data.productDescription,
        data.keywords,
        subreddits
      );

      if (result.success) {
        // Clear localStorage
        clearOnboardingData();
        
        toast.success("Step 3 completed! Moving to step 4...");
        
        // Use hard redirect with window.location to force a full page reload
        // This ensures the database update is committed and visible before layout check
        // Wait longer to ensure database transaction is fully committed and visible
        setTimeout(() => {
          window.location.href = "/onboarding/step-4";
        }, 1000);
      } else {
        toast.error(result.error || "Failed to save onboarding data. Please try again.");
        setIsSaving(false);
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsSaving(false);
    }
  };

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

  // Check if form is valid (at least 1 subreddit required)
  const isFormValid = subreddits.length >= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Choose your subreddits</CardTitle>
        <CardDescription>
          Step 3 of 5: Add subreddits to monitor for leads
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="subredditInput">Subreddits</Label>
          <div className="flex gap-2">
            <Input
              id="subredditInput"
              placeholder="saas or r/saas"
              value={currentSubreddit}
              onChange={(e) => setCurrentSubreddit(e.target.value)}
              onKeyDown={handleSubredditKeyDown}
              disabled={subreddits.length >= 10}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addSubreddit(currentSubreddit)}
              disabled={subreddits.length >= 10 || !currentSubreddit.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Add one or more subreddits to monitor (without the r/ prefix is fine).
          </p>
          {subreddits.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {subreddits.map((subreddit) => (
                <Badge
                  key={subreddit}
                  variant="secondary"
                  className="flex items-center gap-1 px-2 py-1"
                >
                  <span>r/{subreddit}</span>
                  <button
                    type="button"
                    onClick={() => removeSubreddit(subreddit)}
                    className="ml-1 inline-flex rounded-full hover:bg-muted"
                    aria-label={`Remove r/${subreddit}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/step-2")}
            size="lg"
            disabled={isSaving}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!isFormValid || isSaving}
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
