"use client";

import { useState, KeyboardEvent } from "react";
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

const scraperSchema = z.object({
  keywords: z.string().min(1, "At least one keyword is required"),
  productDescription: z.string().min(10, "Product description must be at least 10 characters"),
});

type ScraperFormData = z.infer<typeof scraperSchema>;

interface ScraperSettingsProps {
  initialKeywords?: string[];
  initialProductDescription?: string;
  initialSubreddits?: string[];
}

export function ScraperSettings({
  initialKeywords = [],
  initialProductDescription = "",
  initialSubreddits = [],
}: ScraperSettingsProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ScraperFormData>({
    resolver: zodResolver(scraperSchema),
    defaultValues: {
      keywords: initialKeywords.join(", "),
      productDescription: initialProductDescription,
    },
  });

  const [subreddits, setSubreddits] = useState<string[]>(initialSubreddits);
  const [currentSubreddit, setCurrentSubreddit] = useState("");

  const addSubreddit = (value: string) => {
    let clean = value.trim().toLowerCase();
    if (!clean) return;

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

  async function onSubmit(data: ScraperFormData) {
    if (subreddits.length === 0) {
      toast.error("Please add at least one subreddit.");
      return;
    }

    const formData = new FormData();
    formData.append("keywords", data.keywords);
    formData.append("productDescription", data.productDescription);
    formData.append("subreddits", JSON.stringify(subreddits));

    const result = await updateSettings(formData);

    if (result.success) {
      toast.success("Scraper settings saved successfully!");
    } else {
      toast.error(result.error || "Failed to save settings");
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
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords</Label>
            <Input
              id="keywords"
              placeholder="saas, startup, marketing, growth"
              {...register("keywords")}
            />
            <p className="text-sm text-muted-foreground">
              Enter keywords separated by commas (max 20 keywords)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subredditInput">Subreddits</Label>
            <div className="flex gap-2">
              <Input
                id="subredditInput"
                placeholder="saas or r/saas"
                value={currentSubreddit}
                onChange={(e) => setCurrentSubreddit(e.target.value)}
                onKeyDown={handleSubredditKeyDown}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addSubreddit(currentSubreddit)}
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

          <div className="space-y-2">
            <Label htmlFor="productDescription">Product Description</Label>
            <Textarea
              id="productDescription"
              placeholder="Describe your product or service in detail..."
              rows={8}
              {...register("productDescription")}
            />
            <p className="text-sm text-muted-foreground">
              This description helps the AI understand your product when analyzing Reddit posts
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Scraper Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
