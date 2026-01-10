/**
 * Centralized AI model configuration.
 * Single source of truth for all OpenAI model names used in the application.
 */

/**
 * Model used for opportunity analysis (scoring/filtering Reddit posts).
 * Currently: gpt-4.1-nano (fast, cost-effective for classification tasks)
 */
export const AI_MODEL_ANALYSIS = "gpt-4.1-nano";

/**
 * Model used for generating reply drafts (writing Reddit comments).
 * Currently: gpt-4o-mini (balanced performance for natural language generation)
 */
export const AI_MODEL_DRAFTING = "gpt-4o-mini";

/**
 * Model used for summarizing product descriptions into concise context.
 * Currently: gpt-4o-mini (efficient for summarization tasks)
 */
export const AI_MODEL_SUMMARIZER = "gpt-4o-mini";
