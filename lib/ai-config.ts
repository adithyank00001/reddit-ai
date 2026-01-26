/**
 * Centralized AI Model Configuration
 * 
 * Single source of truth for all AI models used in the Next.js app.
 * Uses semantic, use-case-based naming for clarity.
 */

export const AI_USE_CASES = {
  // Used in app/actions/analyze-url.ts
  // High speed, low cost required.
  WEBSITE_CONTENT_ANALYZER: {
    model: "gpt-4.1-nano",
    temperature: 0.5,
    maxTokens: 3000,
  },
  // Used in app/actions/voice-training.ts
  // Generates realistic Reddit posts for voice training
  SIMULATED_REDDIT_POST_GENERATOR: {
    model: "gpt-4.1-nano",
    temperature: 0.8,
    maxTokens: 500,
  },
} as const;
