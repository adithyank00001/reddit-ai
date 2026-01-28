"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateSettings } from "@/app/actions/settings";
import { toast } from "sonner";
import { Loader2, X, Plus } from "lucide-react";
import { WebsiteAnalyzerForm } from "@/components/onboarding/WebsiteAnalyzerForm";
import { KeywordManager } from "@/components/shared/KeywordManager";

const scraperSchema = z.object({
  keywords: z.array(z.string()).min(1, "At least one keyword is required"),
  productDescription: z.string().min(10, "Product description must be at least 10 characters"),
});

type ScraperFormData = z.infer<typeof scraperSchema>;

interface ScraperSettingsProps {
  initialKeywords?: string[];
  initialProductDescription?: string;
  initialSubreddits?: string[];
  initialWebsiteUrl?: string;
  onSave?: () => void;
}

export function ScraperSettings({
  initialKeywords = [],
  initialProductDescription = "",
  initialSubreddits = [],
  initialWebsiteUrl = "",
  onSave,
}: ScraperSettingsProps) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<ScraperFormData>({
    resolver: zodResolver(scraperSchema),
    defaultValues: {
      keywords: initialKeywords,
      productDescription: initialProductDescription,
    },
  });

  const [subreddits, setSubreddits] = useState<string[]>(initialSubreddits);
  const [currentSubreddit, setCurrentSubreddit] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl || "");
  const [productDescription, setProductDescription] = useState(initialProductDescription || "");

  // Sync keywords with form state
  const handleKeywordsChange = (newKeywords: string[]) => {
    setKeywords(newKeywords);
    setValue("keywords", newKeywords, { shouldValidate: true });
  };

  // Update keywords when initialKeywords change (e.g., after refetch)
  useEffect(() => {
    setKeywords(initialKeywords);
    setValue("keywords", initialKeywords, { shouldValidate: true });
  }, [initialKeywords, setValue]);

  // Update subreddits when initialSubreddits change
  useEffect(() => {
    setSubreddits(initialSubreddits);
  }, [initialSubreddits]);

  // Update website URL and description when initial values change
  useEffect(() => {
    setWebsiteUrl(initialWebsiteUrl || "");
    setProductDescription(initialProductDescription || "");
    setValue("productDescription", initialProductDescription, { shouldValidate: true });
  }, [initialWebsiteUrl, initialProductDescription, setValue]);

  // Detect if any values have changed from the latest initial props
  const hasKeywordChanges = JSON.stringify(keywords) !== JSON.stringify(initialKeywords);
  const hasSubredditChanges = JSON.stringify(subreddits) !== JSON.stringify(initialSubreddits);
  const hasWebsiteUrlChanges = (websiteUrl || "") !== (initialWebsiteUrl || "");
  const hasProductDescriptionChanges =
    (productDescription || "") !== (initialProductDescription || "");

  const hasChanges =
    hasKeywordChanges || hasSubredditChanges || hasWebsiteUrlChanges || hasProductDescriptionChanges;

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
      setSubreddits((prev) => [...prev, clean]);
    }
    setCurrentSubreddit("");
  };

  const removeSubreddit = (value: string) => {
    setSubreddits((prev) => prev.filter((s) => s !== value));
  };

  const handleSubredditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubreddit(currentSubreddit);
    }
  };

  const handleWebsiteAnalyzerChange = (data: { websiteUrl: string; description: string }) => {
    setWebsiteUrl(data.websiteUrl);
    setProductDescription(data.description);
    // Sync with form state for validation
    setValue("productDescription", data.description);
  };

  async function onSubmit(data: ScraperFormData) {
    // Allow 0 subreddits - users who completed onboarding can remove all subreddits
    // The validation for minimum requirements is handled during onboarding, not in settings

    if (keywords.length === 0) {
      toast.error("Please add at least one keyword.");
      return;
    }

    const formData = new FormData();
    // Send keywords as JSON array (same format as subreddits)
    formData.append("keywords", JSON.stringify(keywords));
    // Use productDescription from state (synced from WebsiteAnalyzerForm)
    formData.append("productDescription", productDescription || data.productDescription);
    formData.append("subreddits", JSON.stringify(subreddits));
    formData.append("websiteUrl", websiteUrl);

    const result = await updateSettings(formData);

    if (result.success) {
      toast.success("Scraper settings saved successfully!");
      // Trigger refresh callback if provided
      if (onSave) {
        onSave();
      }
    } else {
      toast.error("error" in result ? result.error : "Failed to save settings");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scraper Configuration</CardTitle>
        <CardDescription>
          Configure keywords, subreddits, and product description for Reddit scraping
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
            These keywords help us find relevant Reddit posts that match your product. You can add up to 10 keywords.
          </p>

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
                {subreddits.map((subreddit, index) => (
                  <Badge
                    key={`${subreddit}-${index}`}
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

          <WebsiteAnalyzerForm
            initialWebsiteUrl={initialWebsiteUrl}
            initialDescription={initialProductDescription}
            onChange={handleWebsiteAnalyzerChange}
          />

          {hasChanges && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Scraper Settings
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
