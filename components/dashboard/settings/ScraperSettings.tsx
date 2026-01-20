"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings } from "@/app/actions/settings";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const scraperSchema = z.object({
  keywords: z.string().min(1, "At least one keyword is required"),
  productDescription: z.string().min(10, "Product description must be at least 10 characters"),
});

type ScraperFormData = z.infer<typeof scraperSchema>;

interface ScraperSettingsProps {
  initialKeywords?: string[];
  initialProductDescription?: string;
}

export function ScraperSettings({
  initialKeywords = [],
  initialProductDescription = "",
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

  async function onSubmit(data: ScraperFormData) {
    const formData = new FormData();
    formData.append("keywords", data.keywords);
    formData.append("productDescription", data.productDescription);

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
          Configure keywords and product description for Reddit scraping
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
