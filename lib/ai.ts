import { logger } from "./logger";
import OpenAI from "openai";
import {
  AI_MODEL_ANALYSIS,
  AI_MODEL_DRAFTING,
} from "./ai-config";

/**
 * AI intent checker using OpenAI API.
 * Analyzes Reddit posts to detect buying intent.
 */
const MODEL = AI_MODEL_ANALYSIS;
const REPLY_MODEL = AI_MODEL_DRAFTING;
const INPUT_COST_PER_MILLION_TOKENS = 0.1;

// Initialize OpenAI client (singleton)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type OpportunityResult = {
  is_opportunity: boolean;
  opportunity_type:
    | "direct_buying_intent"
    | "problem_awareness"
    | "recommendation_request"
    | "competitor_discussion"
    | "other_marketing";
  score: number;
  short_reason: string;
  suggested_angle: string;
};

/**
 * New Growth Scout classifier.
 * Uses product context + Reddit post to detect broad sales/marketing opportunities.
 */
export async function analyzeOpportunity(
  title: string,
  content: string,
  productContext: string
): Promise<OpportunityResult> {
  const timer = logger.startTimer("AI_ANALYSIS_OPPORTUNITY");
  const postId = title.substring(0, 50);

  // Truncate content to limit token usage
  const contentTruncated = content.slice(0, 500);
  const originalContentLength = content.length;
  const truncatedContentLength = contentTruncated.length;

  // Build system prompt with product context
  const effectiveProductContext =
    productContext && productContext.trim().length > 0
      ? productContext.trim()
      : "No specific product context provided. Assume a generic SaaS product that helps people solve problems discussed in the post.";

  const systemPrompt = `
You are an expert growth marketer for a product described as:
"${effectiveProductContext}"

Your job is to read Reddit posts and identify any useful sales or marketing opportunities for this product.
`.trim();

  // Build user message with clear instructions + schema
  const userMessage = `
You will be given a Reddit post (title and content).
Decide if this post is a good sales or marketing opportunity for the product described above.

Treat the following as valid opportunities:
- "direct_buying_intent": The user clearly wants to buy or sign up for something (e.g. "Looking for a chatbot tool for my Shopify store").
- "problem_awareness": The user clearly describes a problem that this product can solve (e.g. "I struggle to reply to customer questions on my store").
- "recommendation_request": The user asks for tools, services, or solutions (e.g. "Best tool for X?", "What do you use for Y?").
- "competitor_discussion": The user mentions tools/services that could be competitors (e.g. "Alternative to Z?", "Anyone using ToolABC?").
- "other_marketing": Any other discussion where a reply from this product could reasonably be helpful and relevant.

Ignore posts that are:
- Spam, memes, jokes, pure self-promotion unrelated to the product.
- Completely off-topic for the product.

Return your answer as JSON ONLY, with this exact schema:
{
  "is_opportunity": boolean,
  "opportunity_type": "direct_buying_intent" | "problem_awareness" | "recommendation_request" | "competitor_discussion" | "other_marketing",
  "score": number,          // 0-100, higher = better opportunity
  "short_reason": string,   // very short explanation in plain language
  "suggested_angle": string // short phrase for how to position the product
}

Do NOT include any extra text outside the JSON.

Here is the post:
Title: ${title}

Content: ${contentTruncated}
`.trim();

  const promptText = `${systemPrompt}\n\n${userMessage}`;

  // Log model and request details (keep existing style)
  logger.info("AI_CALL", `Model: ${MODEL}`);
  logger.aiRequest(MODEL, promptText);

  // Hyper-logging: product context
  logger.info("AI_CONTEXT", "Product context for opportunity analysis", {
    productContext: effectiveProductContext,
    originalProductContext: productContext,
    postId,
  });

  const requestStart = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 80,
      temperature: 0,
    });

    const responseTime = Date.now() - requestStart;
    const responseText = response.choices[0]?.message?.content?.trim() || "";

    // Hyper-logging: raw response string
    logger.info("AI_RAW_RES", "Raw OpenAI response before parsing", {
      postId,
      raw: responseText,
    });

    // Extract token usage
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const totalTokens =
      response.usage?.total_tokens || promptTokens + completionTokens;

    logger.info(
      "AI_USAGE",
      `Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}`
    );

    const costEstimate =
      (promptTokens * INPUT_COST_PER_MILLION_TOKENS) / 1_000_000;
    logger.info("AI_COST", `Estimated input cost: $${costEstimate.toFixed(6)}`);

    logger.aiResponse(MODEL, responseText, totalTokens, responseTime);

    let parsed: OpportunityResult;
    try {
      parsed = JSON.parse(responseText) as OpportunityResult;

      // Hyper-logging: parsed object
      logger.info("AI_PARSED", "Parsed opportunity result", {
        postId,
        parsed,
        promptTokens,
        completionTokens,
        totalTokens,
        responseTime,
        originalContentLength,
        truncatedContentLength,
      });
    } catch (parseError) {
      const errorMessage =
        parseError instanceof Error ? parseError.message : String(parseError);

      // Hyper-logging: full parse error + raw string
      logger.error("AI_ERROR_FULL", "Failed to parse OpenAI JSON", {
        postId,
        error: errorMessage,
        raw: responseText,
      });

      // Fallback safe default
      parsed = {
        is_opportunity: false,
        opportunity_type: "other_marketing",
        score: 0,
        short_reason: "parse_error",
        suggested_angle: "",
      };
    }

    timer.end();
    return parsed;
  } catch (error) {
    const responseTime = Date.now() - requestStart;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.aiError(MODEL, error);
    logger.error("AI_CALL", "OpenAI call failed", {
      message: errorMessage,
      name: errorName,
      stack: errorStack,
      responseTime,
      postId,
      titleLength: title.length,
      contentLength: content.length,
    });

    timer.end();

    // On hard API error, return a safe default
    return {
      is_opportunity: false,
      opportunity_type: "other_marketing",
      score: 0,
      short_reason: "api_error",
      suggested_angle: "",
    };
  }
}

export async function analyzeIntent(
  title: string,
  content: string
): Promise<boolean> {
  const timer = logger.startTimer("AI_ANALYSIS");
  const postId = title.substring(0, 50);
  const requestStart = Date.now();

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
      data: {
        postId,
        titleLength: title.length,
        contentLength: content.length,
        requestStart,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  logger.step("AI_ANALYSIS", `AI analysis start`, {
    postId,
    titleLength: title.length,
    contentLength: content.length,
  });
  try {
    // Backwards-compatibility wrapper around the new opportunity classifier.
    // Uses an empty product context and applies a fixed threshold.
    const opportunity = await analyzeOpportunity(title, content, "");
    const hasIntent = opportunity.is_opportunity && opportunity.score >= 70;
    const approved = hasIntent;

    logger.step(
      "AI_ANALYSIS",
      `AI analysis result: ${hasIntent ? "YES" : "NO"}`,
      {
        approved,
        opportunity,
      }
    );

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
          opportunity,
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

    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "debug",
        hypothesisId: "H1",
        location: "lib/ai.ts:analyzeIntent:error:before_logger",
        message: "Error caught, responseTime calculated",
        data: {
          postId,
          responseTime,
          requestStart,
          currentTime: Date.now(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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
      contentLength: content.length,
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
          responseTime,
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

/**
 * Generates a helpful, natural-sounding Reddit comment draft for a high-quality lead.
 * The reply should be conversational, helpful, and not sound like a bot or advertisement.
 *
 * @param title - The Reddit post title
 * @param body - The Reddit post body/content
 * @param productContext - The product context/description
 * @param opportunity - The opportunity analysis results (for context)
 * @returns The generated reply draft text, or null if generation fails
 */
export async function generateReplyDraft(
  title: string,
  body: string,
  productContext: string,
  opportunity: OpportunityResult
): Promise<string | null> {
  const timer = logger.startTimer("REPLY_GENERATION");
  const postId = title.substring(0, 50);
  const requestStart = Date.now();

  logger.step("REPLY_GENERATION_START", "Starting reply draft generation", {
    postId,
    titleLength: title.length,
    bodyLength: body.length,
    hasProductContext: !!productContext,
    opportunityScore: opportunity.score,
    opportunityType: opportunity.opportunity_type,
  });

  // Truncate content to limit token usage
  const bodyTruncated = body.slice(0, 800);
  const titleTruncated = title.slice(0, 200);

  // Build effective product context
  const effectiveProductContext =
    productContext && productContext.trim().length > 0
      ? productContext.trim()
      : "A helpful product that can assist with the problem discussed in the post.";

  const systemPrompt = `
You are a helpful Reddit user who genuinely wants to help others. You have experience with a product that might be relevant to this discussion.

Your goal: Write a short, natural, helpful Reddit comment that:
- Sounds like a real person, not a bot or advertisement
- Provides genuine value to the discussion
- If mentioning the product, does so naturally as a recommendation, not a sales pitch
- Is conversational and authentic
- Keeps it brief (2-4 sentences typically)

Do NOT:
- Sound promotional or salesy
- Use marketing language
- Make it obvious you're promoting something
- Write a long comment

Product context: ${effectiveProductContext}
`.trim();

  const userMessage = `
Write a helpful Reddit comment reply for this post. Be natural and conversational.

Post Title: ${titleTruncated}

Post Content: ${bodyTruncated}

Opportunity Type: ${opportunity.opportunity_type}
Suggested Angle: ${opportunity.suggested_angle || "Be helpful and relevant"}

Write ONLY the comment text. Do not include any prefixes, explanations, or metadata. Just the comment itself.
`.trim();

  const promptText = `${systemPrompt}\n\n${userMessage}`;

  logger.info("AI_CALL", `Reply Model: ${REPLY_MODEL}`);
  logger.aiRequest(REPLY_MODEL, promptText);

  logger.info("REPLY_GENERATION_CONTEXT", "Reply generation context", {
    postId,
    productContext: effectiveProductContext,
    opportunityScore: opportunity.score,
    opportunityType: opportunity.opportunity_type,
    suggestedAngle: opportunity.suggested_angle,
  });

  try {
    const response = await openai.chat.completions.create({
      model: REPLY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 200,
      temperature: 0.7, // Slightly higher temperature for more natural, varied responses
    });

    const responseTime = Date.now() - requestStart;
    const draftText = response.choices[0]?.message?.content?.trim() || "";

    // Extract token usage
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const totalTokens =
      response.usage?.total_tokens || promptTokens + completionTokens;

    logger.info(
      "REPLY_GENERATION_USAGE",
      `Prompt: ${promptTokens} | Completion: ${completionTokens} | Total: ${totalTokens}`
    );

    const costEstimate =
      (totalTokens * INPUT_COST_PER_MILLION_TOKENS) / 1_000_000;
    logger.info(
      "REPLY_GENERATION_COST",
      `Estimated cost: $${costEstimate.toFixed(6)}`
    );

    logger.aiResponse(REPLY_MODEL, draftText, totalTokens, responseTime);

    if (!draftText || draftText.length === 0) {
      logger.error("REPLY_GENERATION_ERROR", "Generated draft is empty", {
        postId,
        responseTime,
        promptTokens,
        completionTokens,
      });
      timer.end();
      return null;
    }

    // Log success with preview (first 100 chars)
    const draftPreview =
      draftText.length > 100 ? draftText.substring(0, 100) + "..." : draftText;
    logger.step(
      "REPLY_GENERATION_SUCCESS",
      "Reply draft generated successfully",
      {
        postId,
        draftLength: draftText.length,
        draftPreview,
        responseTime,
        totalTokens,
      }
    );

    timer.end();
    return draftText;
  } catch (error) {
    const responseTime = Date.now() - requestStart;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.aiError(REPLY_MODEL, error);
    logger.error("REPLY_GENERATION_ERROR", "Reply generation failed", {
      message: errorMessage,
      name: errorName,
      stack: errorStack,
      responseTime,
      postId,
      titleLength: title.length,
      bodyLength: body.length,
    });

    timer.end();
    return null;
  }
}
