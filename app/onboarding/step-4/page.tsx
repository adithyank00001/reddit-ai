"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { ReplyIntelligence } from "@/components/onboarding/ReplyIntelligence";
import { markStep4Skipped } from "@/app/actions/onboarding";
import { updateReplyMode } from "@/app/actions/voice-training";

export default function OnboardingStep4Page() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [replyMode, setReplyMode] = useState<"custom" | "voice">("custom");
  const [customInstructions, setCustomInstructions] = useState("");
  const [voiceExamples, setVoiceExamples] = useState<string[]>([]);
  const [hasSavedData, setHasSavedData] = useState(false);

  // Load current settings and verify step access
  useEffect(() => {
    async function verifyStep() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login?redirectTo=/onboarding/step-4");
          return;
        }

        // Check if user has completed steps 1-3
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

        // If user hasn't completed steps 1-3, redirect to appropriate step
        if (!settings?.website_url) {
          router.push("/onboarding/step-1");
          return;
        }
        
        if (!settings.keywords || settings.keywords.length === 0) {
          router.push("/onboarding/step-2");
          return;
        }
        
        if (!hasSubreddits) {
          router.push("/onboarding/step-3");
          return;
        }

        // Load current reply settings if they exist
        const { data: replySettings } = await supabase
          .from("project_settings")
          .select("reply_mode, custom_instructions, voice_examples")
          .eq("user_id", user.id)
          .maybeSingle();

        if (replySettings) {
          setReplyMode((replySettings.reply_mode as "custom" | "voice") || "custom");
          setCustomInstructions(replySettings.custom_instructions || "");
          setVoiceExamples(
            Array.isArray(replySettings.voice_examples) 
              ? replySettings.voice_examples 
              : []
          );
          
          // Check if user has saved data:
          // - Custom mode: must have custom_instructions (non-empty)
          // - Voice mode: must have at least 3 voice_examples (reply_mode may be null until Complete is clicked)
          const hasCustomData = replySettings.reply_mode === "custom" && 
                               replySettings.custom_instructions && 
                               replySettings.custom_instructions.trim().length > 0;
          const hasVoiceData = Array.isArray(replySettings.voice_examples) && 
                              replySettings.voice_examples.length >= 3;
          
          setHasSavedData(hasCustomData || hasVoiceData);
        }

        setIsChecking(false);
        setIsLoading(false);
      } catch (error) {
        console.error("Error verifying step:", error);
        setIsChecking(false);
        setIsLoading(false);
      }
    }

    verifyStep();
  }, [router]);

  const handleSkip = async () => {
    try {
      setIsLoading(true);
      const result = await markStep4Skipped();
      
      if (result.success) {
        toast.info("You can configure reply settings later in Settings");
        router.push("/onboarding/step-5");
      } else {
        toast.error(result.error || "Failed to skip step. Please try again.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error skipping step 4:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // The ReplyIntelligence component handles saving internally
    // Check if we have enough data to enable Complete button
    // For voice mode, need 3 examples; for custom mode, need instructions
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: replySettings } = await supabase
        .from("project_settings")
        .select("reply_mode, custom_instructions, voice_examples")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (replySettings) {
        const hasCustomData = replySettings.reply_mode === "custom" && 
                             replySettings.custom_instructions && 
                             replySettings.custom_instructions.trim().length > 0;
        const hasVoiceData = Array.isArray(replySettings.voice_examples) && 
                            replySettings.voice_examples.length >= 3;
        
        setHasSavedData(hasCustomData || hasVoiceData);
      }
    } else {
      // Fallback: just enable it if onSave was called
      setHasSavedData(true);
    }
    
    toast.success("Reply settings saved!");
  };

  const handleComplete = async () => {
    try {
      setIsLoading(true);
      
      // Check if user has already saved something
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please log in to continue");
        setIsLoading(false);
        return;
      }

      // Get current settings to determine which mode to save
      const { data: replySettings } = await supabase
        .from("project_settings")
        .select("reply_mode, custom_instructions, voice_examples")
        .eq("user_id", user.id)
        .maybeSingle();

      // Determine which mode to save based on what user has configured
      let modeToSave: "custom" | "voice" = "custom";
      let instructionsToSave = "";

      if (replySettings) {
        // If user has voice examples (3 or more), use voice mode
        const hasVoiceExamples = Array.isArray(replySettings.voice_examples) && 
                                 replySettings.voice_examples.length >= 3;
        
        // If user has custom instructions, use custom mode
        const hasCustomInstructions = replySettings.custom_instructions && 
                                     replySettings.custom_instructions.trim().length > 0;

        if (hasVoiceExamples) {
          modeToSave = "voice";
        } else if (hasCustomInstructions) {
          modeToSave = "custom";
          instructionsToSave = replySettings.custom_instructions;
        }
      }

      // Save the mode to mark step 4 as complete
      const result = await updateReplyMode(modeToSave, instructionsToSave);
      
      if (!result.success) {
        toast.error(result.error || "Failed to save settings. Please try again.");
        setIsLoading(false);
        return;
      }

      // Small delay to ensure database update is committed
      await new Promise(resolve => setTimeout(resolve, 300));

      // Redirect to step 5 (Notification Settings)
      router.push("/onboarding/step-5");
    } catch (error) {
      console.error("Error completing step 4:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // Show loading state while checking
  if (isChecking || isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Reply Intelligence</CardTitle>
        <CardDescription>
          Step 4 of 5 (Optional): Configure how replies are generated
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ReplyIntelligence
          initialMode={replyMode}
          initialCustomInstructions={customInstructions}
          initialVoiceExamples={voiceExamples}
          onSave={handleSave}
        />

        <div className="flex justify-between pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/step-3")}
            size="lg"
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Skipping...
                </>
              ) : (
                <>
                  <SkipForward className="mr-2 h-4 w-4" />
                  Skip
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={handleComplete}
              size="lg"
              disabled={isLoading || !hasSavedData}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  Complete
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
