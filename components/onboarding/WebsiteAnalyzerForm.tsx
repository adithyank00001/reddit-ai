"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeWebsite } from "@/app/actions/analyze-url";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const websiteAnalyzerSchema = z.object({
  websiteUrl: z.string().min(1, "Website URL is required"),
  description: z.string().min(10, "Product description must be at least 10 characters"),
});

type WebsiteAnalyzerFormData = z.infer<typeof websiteAnalyzerSchema>;

interface WebsiteAnalyzerFormProps {
  initialWebsiteUrl?: string;
  initialDescription?: string;
  onChange?: (data: { websiteUrl: string; description: string }) => void;
  onAnalyze?: (url: string) => void;
  disabled?: boolean;
}

export function WebsiteAnalyzerForm({
  initialWebsiteUrl = "",
  initialDescription = "",
  onChange,
  onAnalyze,
  disabled = false,
}: WebsiteAnalyzerFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WebsiteAnalyzerFormData>({
    resolver: zodResolver(websiteAnalyzerSchema),
    defaultValues: {
      websiteUrl: initialWebsiteUrl,
      description: initialDescription,
    },
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Watch form values to trigger onChange callback
  const websiteUrl = watch("websiteUrl");
  const description = watch("description");

  useEffect(() => {
    if (onChange) {
      onChange({
        websiteUrl: websiteUrl || "",
        description: description || "",
      });
    }
  }, [websiteUrl, description, onChange]);

  const handleAnalyzeWebsite = async () => {
    const currentUrl = websiteUrl?.trim() || "";
    
    if (!currentUrl) {
      toast.error("Please enter a website URL");
      return;
    }

    if (onAnalyze) {
      onAnalyze(currentUrl);
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeWebsite(currentUrl);

      if (result.success && result.description) {
        setValue("description", result.description);
        toast.success("Description generated!");
      } else {
        toast.error(result.error || "Failed to generate description");
      }
    } catch (error) {
      console.error("Error analyzing website:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="websiteUrl">Auto-Fill from Website</Label>
        <div className="flex gap-2">
          <Input
            id="websiteUrl"
            type="text"
            placeholder="example.com or https://example.com"
            {...register("websiteUrl")}
            disabled={isAnalyzing || disabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAnalyzeWebsite}
            disabled={isAnalyzing || !websiteUrl?.trim() || disabled}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Auto-Fill Description
              </>
            )}
          </Button>
        </div>
        {errors.websiteUrl && (
          <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Paste your website URL and click to automatically generate a product description
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Product Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your product or service in detail..."
          rows={8}
          {...register("description")}
          disabled={disabled}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
        <p className="text-sm text-muted-foreground">
          This description helps the AI understand your product when analyzing Reddit posts
        </p>
      </div>
    </div>
  );
}

// Export helper function to get form values for validation
export function validateWebsiteAnalyzerForm(data: {
  websiteUrl: string;
  description: string;
}): { isValid: boolean; errors?: z.ZodError } {
  const result = websiteAnalyzerSchema.safeParse(data);
  if (result.success) {
    return { isValid: true };
  }
  return { isValid: false, errors: result.error };
}
