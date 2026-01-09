import { logger } from "./logger";

/**
 * Checks if a text contains any of the specified keywords using regex word boundaries.
 * This is the Level 1 Filter (fast/free) before sending to AI analysis.
 *
 * @param text - The content to search (e.g., post title + body)
 * @param keywords - Array of keywords to look for
 * @returns true if any keyword is found, false otherwise
 */
export function containsKeyword(text: string, keywords: string[]): boolean {
  const timer = logger.startTimer("KEYWORD_SCAN");
  
  // Handle null/undefined inputs gracefully
  if (!text || !keywords) {
    logger.warn("KEYWORD_SCAN", "Invalid input: text or keywords is null/undefined");
    return false;
  }

  // Early return if keywords array is empty or text is empty
  if (keywords.length === 0 || text.length === 0) {
    logger.debug("KEYWORD_SCAN", "Empty input", {
      keywordsCount: keywords.length,
      textLength: text.length
    });
    return false;
  }

  logger.debug("KEYWORD_SCAN", `Scanning text for keywords`, {
    textLength: text.length,
    keywordsCount: keywords.length,
    keywords: keywords
  });

  // Loop through keywords and check for matches
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    
    // Skip empty keywords
    if (!keyword || keyword.length === 0) {
      logger.debug("KEYWORD_SCAN", `Skipping empty keyword at index ${i}`);
      continue;
    }

    // Create regex with word boundaries and case-insensitive flag
    // \b ensures we match whole words only (e.g., "seo" matches "looking for seo" but not "season")
    const regex = new RegExp(`\\b${keyword}\\b`, "i");

    // Test the text against the regex
    if (regex.test(text)) {
      logger.step("KEYWORD_SCAN", `Match found! Keyword: "${keyword}"`, {
        matchedKeyword: keyword,
        keywordIndex: i,
        totalKeywords: keywords.length
      });
      timer.end();
      // Return true immediately on first match (performance optimization)
      return true;
    }
  }

  // No matches found
  logger.debug("KEYWORD_SCAN", "No keyword matches found", {
    keywordsChecked: keywords.length
  });
  timer.end();
  return false;
}
