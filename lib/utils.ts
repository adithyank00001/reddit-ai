import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a Unix timestamp (seconds since epoch) to a relative time string
 * Examples: "2h ago", "5m ago", "3d ago", "just now"
 */
export function formatRelativeTime(created_utc: number): string {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const diff = now - created_utc; // Difference in seconds

  if (diff < 60) {
    return "just now";
  }

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(diff / 3600);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(diff / 86400);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * Clean and format Reddit post content
 * - Decodes HTML entities (like &amp;, &lt;, &gt;, etc.)
 * - Removes extra whitespace while preserving line breaks
 * - Cleans up formatting issues and unwanted characters
 */
export function cleanRedditContent(content: string | null | undefined): string {
  if (!content) return "No content available";

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/utils.ts:55',message:'cleanRedditContent entry',data:{contentLength:content?.length,contentPreview:content?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  let cleaned = content;

  // Remove any remaining HTML tags (safety check - do this first)
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Decode HTML entities (common ones first)
  const htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
    '&apos;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
  };

  // Replace HTML entities
  for (const [entity, char] of Object.entries(htmlEntities)) {
    cleaned = cleaned.replace(new RegExp(entity, 'gi'), char);
  }

  // Decode numeric HTML entities (like &#8217;)
  cleaned = cleaned.replace(/&#(\d+);/g, (match, dec) => {
    const code = parseInt(dec, 10);
    // Only decode printable characters (32-126 and common extended chars)
    if (code >= 32 && code <= 126) {
      return String.fromCharCode(code);
    }
    // Common extended characters
    if (code === 8217 || code === 8216) return "'";
    if (code === 8220 || code === 8221) return '"';
    if (code === 8211) return '–';
    if (code === 8212) return '—';
    if (code === 8230) return '…';
    return match; // Keep if unknown
  });

  // Decode hex HTML entities (like &#x27;)
  cleaned = cleaned.replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => {
    const code = parseInt(hex, 16);
    if (code >= 32 && code <= 126) {
      return String.fromCharCode(code);
    }
    return match;
  });

  // Remove control characters except newlines, tabs, and carriage returns
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize line endings (handle Windows \r\n and Mac \r)
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Normalize whitespace: preserve line breaks but clean up excessive spaces
  // Replace multiple spaces with single space (but keep line breaks)
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Remove spaces at the start/end of lines (but preserve intentional indentation for code blocks)
  cleaned = cleaned.split('\n').map(line => {
    // Don't trim lines that look like code blocks (start with 4+ spaces)
    if (/^ {4,}/.test(line)) {
      return line.trimEnd();
    }
    return line.trim();
  }).join('\n');
  
  // Remove excessive blank lines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove Reddit RSS metadata footer (e.g., "Link: https://... submitted by /u/username [link] [comments]")
  // This pattern appears at the end of link posts in Reddit RSS feeds
  // Handle usernames with hyphens, underscores, and numbers (e.g., /u/Goran-CRO)
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/utils.ts:141',message:'Before metadata removal',data:{cleanedLength:cleaned.length,cleanedPreview:cleaned.substring(0,200),lastChars:cleaned.slice(-100)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Remove metadata from the END of content only (not from middle or beginning)
  // This handles cases where metadata is appended to the post content on the same line
  const beforeRemoval = cleaned;
  
  // Pattern 1: Remove "submitted by /u/username [link] [comments]" from the end
  cleaned = cleaned.replace(
    /\s+submitted\s+by\s+\/u\/[^\s]+\s*\[link\]\s*\[comments\]\s*$/gim,
    ''
  );
  
  // Pattern 2: Remove "Link: URL submitted by /u/username [link] [comments]" from the end
  cleaned = cleaned.replace(
    /\s+(?:Link|link):\s*https?:\/\/[^\s]+\s+submitted\s+by\s+\/u\/[^\s]+\s*\[link\]\s*\[comments\]\s*$/gim,
    ''
  );
  
  // Pattern 3: Remove "URL submitted by /u/username [link] [comments]" from the end
  cleaned = cleaned.replace(
    /\s+https?:\/\/[^\s]+\s+submitted\s+by\s+\/u\/[^\s]+\s*\[link\]\s*\[comments\]\s*$/gim,
    ''
  );
  
  // Pattern 4: If the last line is ONLY metadata (starts with Link: or URL and ends with metadata), remove that entire line
  const lines = cleaned.split('\n');
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    // Only remove the entire line if it's ONLY metadata (starts with Link:/link: or http and contains the pattern)
    const isOnlyMetadata = /^(?:Link|link):\s*https?:\/\/[^\s]+\s+submitted\s+by\s+\/u\/[^\s]+\s*\[link\]\s*\[comments\]\s*$/i.test(lastLine) ||
                           /^https?:\/\/[^\s]+\s+submitted\s+by\s+\/u\/[^\s]+\s*\[link\]\s*\[comments\]\s*$/i.test(lastLine);
    // #region agent log
    if (isOnlyMetadata) fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/utils.ts:163',message:'Removing metadata-only line',data:{lastLine:lastLine.substring(0,150)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (isOnlyMetadata) {
      lines.pop();
      cleaned = lines.join('\n');
    }
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/utils.ts:170',message:'After metadata removal',data:{beforeLength:beforeRemoval.length,afterLength:cleaned.length,cleanedPreview:cleaned.substring(0,200),wasRemoved:beforeRemoval.length!==cleaned.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // Remove leading/trailing whitespace from entire content
  cleaned = cleaned.trim();

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/utils.ts:170',message:'cleanRedditContent exit',data:{finalLength:cleaned.length,finalPreview:cleaned.substring(0,200),isEmpty:cleaned.length===0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  return cleaned;
}
