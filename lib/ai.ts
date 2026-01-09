import { logger } from "./logger";
import OpenAI from "openai";

/**
 * AI intent checker using OpenAI API.
 * Analyzes Reddit posts to detect buying intent.
 */
const MODEL = "gpt-4.1-nano";
const INPUT_COST_PER_MILLION_TOKENS = 0.10;

// Initialize OpenAI client (singleton)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeIntent(
  title: string,
  content: string
): Promise<boolean> {
  const timer = logger.startTimer("AI_ANALYSIS");
  const postId = title.substring(0, 50);

  // #region agent log
  fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "debug-session",
      runId: "debug",
      hypothesisId: "H1",
      location: "lib/ai.ts:analyzeIntent:entry",
      message: "AI analysis called",
      data: { postId, titleLength: title.length, contentLength: content.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  logger.step("AI_ANALYSIS", `AI analysis start`, {
    postId,
    titleLength: title.length,
    contentLength: content.length
  });

  // Truncate content to limit token usage (first 500 characters)
  const contentTruncated = content.slice(0, 500);
  const originalContentLength = content.length;
  const truncatedContentLength = contentTruncated.length;

  // Build concise system prompt
  const systemPrompt = "You are a classifier. Analyze if a Reddit post shows buying intent for services. Answer only YES or NO.";
  
  // Build user message with title and truncated content
  const userMessage = `Title: ${title}\n\nContent: ${contentTruncated}`;
  const promptText = `${systemPrompt}\n\n${userMessage}`;

  // Log model and request details
  logger.info("AI_CALL", `Model: ${MODEL}`);
  logger.aiRequest(MODEL, promptText);

  const requestStart = Date.now();

  try {
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 5,
      temperature: 0,
    });

    const responseTime = Date.now() - requestStart;
    const responseText = response.choices[0]?.message?.content?.trim() || "";
    
    // Extract token usage from response
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const totalTokens = response.usage?.total_tokens || (promptTokens + completionTokens);

    // Log token usage breakdown
    logger.info("AI_USAGE", `Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}`);

    // Calculate and log cost estimate
    const costEstimate = (promptTokens * INPUT_COST_PER_MILLION_TOKENS) / 1_000_000;
    logger.info("AI_COST", `Estimated input cost: $${costEstimate.toFixed(6)}`);

    // Log response details
    logger.aiResponse(MODEL, responseText, totalTokens, responseTime);

    // Parse response to boolean (YES = true, anything else = false)
    const hasIntent = responseText.toUpperCase().startsWith("YES");
    const approved = hasIntent;

    logger.step("AI_ANALYSIS", `AI analysis result: ${hasIntent ? "YES" : "NO"}`, {
      approved,
      responseText,
      promptTokens,
      completionTokens,
      totalTokens,
      responseTime,
      originalContentLength,
      truncatedContentLength
    });

    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "debug",
        hypothesisId: "H1",
        location: "lib/ai.ts:analyzeIntent:result",
        message: `AI analysis ${hasIntent ? "approved" : "rejected"}`,
        data: { 
          postId, 
          approved, 
          responseText,
          promptTokens,
          completionTokens,
          totalTokens,
          costEstimate
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    timer.end();

    return hasIntent;

  } catch (error) {
    const responseTime = Date.now() - requestStart;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log error using existing logger method
    logger.aiError(MODEL, error);

    // Log detailed error context
    logger.error("AI_CALL", "OpenAI call failed", {
      message: errorMessage,
      name: errorName,
      stack: errorStack,
      responseTime,
      postId,
      titleLength: title.length,
      contentLength: content.length
    });

    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "debug",
        hypothesisId: "H1",
        location: "lib/ai.ts:analyzeIntent:error",
        message: "AI analysis failed",
        data: { 
          postId, 
          error: errorMessage,
          errorName,
          responseTime
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    timer.end();

    // Return false on error (treat as "no intent" to continue pipeline)
    return false;
  }
}
