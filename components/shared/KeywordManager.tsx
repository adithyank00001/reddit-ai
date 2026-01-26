"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

interface KeywordManagerProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  maxKeywords?: number;
  minKeywords?: number;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  showCounter?: boolean;
}

export function KeywordManager({
  keywords = [],
  onChange,
  maxKeywords = 10,
  minKeywords = 1,
  disabled = false,
  placeholder = "Enter a keyword",
  label = "Keywords",
  showCounter = true,
}: KeywordManagerProps) {
  const [currentKeyword, setCurrentKeyword] = useState("");

  const addKeyword = (value: string) => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      return;
    }

    // Check if already at max limit
    if (keywords.length >= maxKeywords) {
      toast.error(`Maximum ${maxKeywords} keywords allowed`);
      return;
    }

    // Check if keyword already exists (case-insensitive)
    const normalized = trimmed.toLowerCase();
    if (keywords.some((k) => k.toLowerCase() === normalized)) {
      toast.error("This keyword already exists");
      return;
    }

    // Validate minimum length
    if (trimmed.length < 2) {
      toast.error("Keyword must be at least 2 characters");
      return;
    }

    // Add keyword (preserve original case)
    const newKeywords = [...keywords, trimmed];
    onChange(newKeywords);
    setCurrentKeyword("");
  };

  const removeKeyword = (keywordToRemove: string) => {
    const newKeywords = keywords.filter((k) => k !== keywordToRemove);
    onChange(newKeywords);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword(currentKeyword);
    }
  };

  const isAtMaxLimit = keywords.length >= maxKeywords;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="keywordInput">{label}</Label>
        {showCounter && (
          <span className="text-sm text-muted-foreground">
            {keywords.length}/{maxKeywords}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id="keywordInput"
          placeholder={placeholder}
          value={currentKeyword}
          onChange={(e) => setCurrentKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isAtMaxLimit}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => addKeyword(currentKeyword)}
          disabled={disabled || isAtMaxLimit || !currentKeyword.trim()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      {isAtMaxLimit && (
        <p className="text-sm text-muted-foreground">
          Maximum {maxKeywords} keywords reached. Remove one to add another.
        </p>
      )}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {keywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              <span>{keyword}</span>
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                className="ml-1 inline-flex rounded-full hover:bg-muted"
                aria-label={`Remove ${keyword}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
