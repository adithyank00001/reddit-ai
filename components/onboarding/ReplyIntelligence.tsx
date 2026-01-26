"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Mic, 
  Loader2, 
  CheckCircle2, 
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { 
  generateSimulatedPost, 
  saveVoiceExample, 
  updateReplyMode 
} from "@/app/actions/voice-training";
import { RedditPostContent } from "@/components/dashboard/RedditPostContent";
import { cn } from "@/lib/utils";

// Reddit Logo SVG Component (Snoo - Reddit's mascot)
function RedditLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Orange circle background */}
      <circle cx="10" cy="10" r="10" fill="#FF4500" />
      {/* Reddit alien face (Snoo) */}
      {/* Head outline */}
      <ellipse cx="10" cy="9" rx="6" ry="6" fill="white" />
      {/* Eyes */}
      <circle cx="7.5" cy="8" r="1.2" fill="#FF4500" />
      <circle cx="12.5" cy="8" r="1.2" fill="#FF4500" />
      {/* Smile */}
      <path
        d="M7 11 Q10 13 13 11"
        stroke="#FF4500"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Antenna */}
      <circle cx="10" cy="4" r="1.5" fill="white" />
      <line x1="10" y1="3" x2="10" y2="5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface ReplyIntelligenceProps {
  initialMode?: "custom" | "voice";
  initialCustomInstructions?: string;
  initialVoiceExamples?: string[];
  onSave?: () => void;
}

export function ReplyIntelligence({
  initialMode = "custom",
  initialCustomInstructions = "",
  initialVoiceExamples = [],
  onSave,
}: ReplyIntelligenceProps) {
  const [mode, setMode] = useState<"custom" | "voice">(initialMode);
  const [customInstructions, setCustomInstructions] = useState(initialCustomInstructions);
  const [voiceExamples, setVoiceExamples] = useState<string[]>(initialVoiceExamples);
  const [currentPost, setCurrentPost] = useState<{ title: string; body: string; subreddit?: string } | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExample, setIsSavingExample] = useState(false);

  const generateNewPost = async () => {
    setIsGeneratingPost(true);
    try {
      const result = await generateSimulatedPost();
      if (result.success && result.post) {
        setCurrentPost(result.post);
        setReplyInput("");
      } else {
        toast.error(result.error || "Failed to generate post");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const handleSaveCustomInstructions = async () => {
    setIsSaving(true);
    try {
      const result = await updateReplyMode("custom", customInstructions);
      if (result.success) {
        toast.success("Custom instructions saved!");
        if (onSave) {
          onSave();
        }
      } else {
        toast.error(result.error || "Failed to save instructions");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVoiceExample = async () => {
    if (!replyInput.trim() || replyInput.trim().length < 5) {
      toast.error("Please enter a reply (at least 5 characters)");
      return;
    }

    setIsSavingExample(true);
    try {
      const result = await saveVoiceExample(replyInput.trim());
      if (result.success) {
        const newCount = result.count || voiceExamples.length + 1;
        setVoiceExamples((prev) => [...prev, replyInput.trim()]);
        setReplyInput("");
        
        if (newCount >= 3) {
          toast.success("Training complete! You've collected 3 examples. Click 'Complete' to finish onboarding.");
          // Don't generate new post when training is complete
          // User should click "Complete" button to finish
        } else {
          toast.success("Example saved! Generating new post...");
          // Generate new post for next example
          await generateNewPost();
        }
        
        if (onSave) {
          onSave();
        }
      } else {
        toast.error(result.error || "Failed to save example");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSavingExample(false);
    }
  };


  const isTrainingComplete = voiceExamples.length >= 3;

  return (
    <div className="space-y-6">
      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Custom Instructions Card */}
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            mode === "custom" && "ring-2 ring-primary border-primary"
          )}
          onClick={() => setMode("custom")}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <CardTitle className="text-lg">Custom Instructions</CardTitle>
            </div>
            <CardDescription>
              Write your own instructions for how replies should be generated
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Voice Training Card */}
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            mode === "voice" && "ring-2 ring-primary border-primary"
          )}
          onClick={() => setMode("voice")}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mic className="h-6 w-6 text-primary" />
              <CardTitle className="text-lg">Train My Voice</CardTitle>
            </div>
            <CardDescription>
              Provide example replies to train the AI to match your style
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Active Section */}
      {mode === "custom" && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Instructions</CardTitle>
            <CardDescription>
              Describe how you want replies to be generated. Be specific about tone, style, and approach.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Example: Always be friendly and helpful. Include a link to our product when relevant. Keep replies under 200 words..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <Button 
              onClick={handleSaveCustomInstructions} 
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Instructions"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "voice" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Voice Training</CardTitle>
                <CardDescription>
                  Provide 3 example replies to train the AI to match your writing style
                </CardDescription>
              </div>
              <Badge variant={isTrainingComplete ? "default" : "secondary"}>
                Examples Collected: {voiceExamples.length}/3
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isTrainingComplete ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-medium">Training Complete!</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  You've successfully provided 3 examples. The AI will now use your writing style when generating replies.
                </p>
              </div>
            ) : (
              <>
                {/* Generate Post Button */}
                {!currentPost && (
                  <div className="flex justify-center">
                    <Button
                      onClick={generateNewPost}
                      disabled={isGeneratingPost}
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      {isGeneratingPost ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Reddit Post"
                      )}
                    </Button>
                  </div>
                )}

                {/* Simulated Reddit Post */}
                {currentPost && (
                  <div className="space-y-3">
                    <Card className="bg-card border">
                      <CardContent className="p-4">
                        {/* Reddit Header */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <RedditLogo className="h-4 w-4 shrink-0" />
                          <span className="font-medium">r/{currentPost.subreddit || "webdev"}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            Sample {voiceExamples.length + 1} of 3
                          </span>
                        </div>
                        
                        {/* Post Title */}
                        <h3 className="text-base font-semibold text-foreground mb-2 leading-tight">
                          {currentPost.title}
                        </h3>
                        
                        {/* Post Body */}
                        <p className="text-sm text-foreground leading-relaxed">
                          {currentPost.body}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Reply Input - Only show when post is generated */}
                {currentPost && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="replyInput" className="text-sm font-medium">
                        Your Reply
                      </label>
                      <Textarea
                        id="replyInput"
                        placeholder="Type your reply here... (at least 5 characters)"
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Write how you would naturally reply to this post. This helps train the AI to match your style.
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleSaveVoiceExample}
                        disabled={isSavingExample || !replyInput.trim() || replyInput.trim().length < 5}
                        className="flex-1"
                      >
                        {isSavingExample ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            Save & Next
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={generateNewPost}
                        disabled={isGeneratingPost}
                      >
                        {isGeneratingPost ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          "Generate New Post"
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
