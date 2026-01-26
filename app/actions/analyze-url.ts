"use server";

import * as cheerio from "cheerio";
import OpenAI from "openai";
import { AI_USE_CASES } from "@/lib/ai-config";

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetches website content with timeout and proper headers
 */
async function fetchWebsite(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout: Website took too long to respond");
    }
    throw error;
  }
}

/**
 * Extracts visible text from HTML using cheerio
 * Excludes scripts, styles, and navigation elements
 */
function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $("script, style, nav, header, footer, aside, .navbar, .nav, .menu").remove();

  // Get text from body
  const bodyText = $("body").text();

  // Clean up whitespace
  return bodyText
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

/**
 * Analyzes a website URL and generates a product description using AI
 */
export async function analyzeWebsite(url: string): Promise<{
  success: boolean;
  description?: string;
  error?: string;
}> {
  try {
    // Validate URL format
    if (!url || typeof url !== "string") {
      return {
        success: false,
        error: "Please provide a valid URL",
      };
    }

    let trimmedUrl = url.trim();
    
    // Automatically add https:// if protocol is missing
    if (!trimmedUrl.match(/^https?:\/\//i)) {
      trimmedUrl = "https://" + trimmedUrl;
    }
    
    if (!isValidUrl(trimmedUrl)) {
      return {
        success: false,
        error: "Invalid URL format. Please enter a valid website address.",
      };
    }

    // Fetch website content
    let html: string;
    try {
      html = await fetchWebsite(trimmedUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("timeout")) {
        return {
          success: false,
          error: "Website took too long to respond. Please try again or fill manually.",
        };
      }
      if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
        return {
          success: false,
          error: "Could not read website (access denied). Please fill manually.",
        };
      }
      return {
        success: false,
        error: "Could not read website. Please fill manually.",
      };
    }

    // Extract visible text
    const visibleText = extractVisibleText(html);

    if (!visibleText || visibleText.length < 50) {
      return {
        success: false,
        error: "Could not extract enough content from the website. Please fill manually.",
      };
    }

    // Truncate to 2500 characters (middle ground between 2000-3000)
    const truncatedText =
      visibleText.length > 2500
        ? visibleText.substring(0, 2500) + "..."
        : visibleText;

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "OpenAI API key not configured. Please contact support.",
      };
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Generate product description using AI
    const systemPrompt =
      "You are an expert copywriter. Analyze this website content and write a concise, 2-sentence product description specifically designed to find sales leads on Reddit. Focus on the problem it solves and who it is for.";

    const completion = await openai.chat.completions.create({
      model: AI_USE_CASES.WEBSITE_CONTENT_ANALYZER.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Website content:\n\n${truncatedText}` },
      ],
      max_tokens: AI_USE_CASES.WEBSITE_CONTENT_ANALYZER.maxTokens,
      temperature: AI_USE_CASES.WEBSITE_CONTENT_ANALYZER.temperature,
    });

    const description =
      completion.choices[0]?.message?.content?.trim() || "";

    if (!description) {
      return {
        success: false,
        error: "Failed to generate description. Please try again.",
      };
    }

    return {
      success: true,
      description,
    };
  } catch (error) {
    console.error("Error analyzing website:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
    };
  }
}
