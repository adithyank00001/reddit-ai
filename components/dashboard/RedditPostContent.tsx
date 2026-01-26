"use client";

import type { ReactNode } from "react";
import { cleanRedditContent } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface RedditPostContentProps {
  content: string | null | undefined;
  className?: string;
}

/**
 * Component that renders Reddit post content with proper formatting
 * Handles markdown-like formatting: bold, italic, lists, links, paragraphs
 */
export function RedditPostContent({ content, className }: RedditPostContentProps) {
  if (!content) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No content available
      </p>
    );
  }

  // Clean the content first
  let cleaned = cleanRedditContent(content);

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/dashboard/RedditPostContent.tsx:26',message:'After cleanRedditContent',data:{cleanedLength:cleaned.length,cleanedPreview:cleaned.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  // Additional safety: Remove Reddit RSS metadata from the end if it still exists
  // Only check the last line to avoid removing legitimate content
  const lines = cleaned.split('\n');
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    const isMetadataLine = /submitted\s+by\s+\/u\/[^\s]+\s*\[link\]\s*\[comments\]/i.test(lastLine);
    // #region agent log
    if (isMetadataLine) fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/dashboard/RedditPostContent.tsx:30',message:'Removing metadata from last line',data:{lastLine:lastLine.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (isMetadataLine) {
      lines.pop();
      cleaned = lines.join('\n');
    }
  }
  
  // Also remove from end of content string (in case it's not on its own line)
  cleaned = cleaned.replace(
    /\s*submitted\s+by\s+\/u\/[^\s]+\s*\[link\]\s*\[comments\]\s*$/gim,
    ''
  );
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/dashboard/RedditPostContent.tsx:42',message:'After additional filtering',data:{cleanedLength:cleaned.length,cleanedPreview:cleaned.substring(0,200),isEmpty:cleaned.length===0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  // Parse and format the content
  const formatted = parseRedditMarkdown(cleaned);

  return (
    <div className={cn("text-sm text-foreground leading-relaxed", className)}>
      {formatted}
    </div>
  );
}

/**
 * Parses Reddit markdown and returns React elements
 */
function parseRedditMarkdown(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for code blocks (4+ spaces at start)
    if (/^ {4,}/.test(line)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLines = [];
      }
      codeBlockLines.push(line);
      i++;
      continue;
    } else if (inCodeBlock) {
      // End of code block
      elements.push(
        <pre
          key={`code-${i}`}
          className="bg-muted p-3 rounded-md my-2 overflow-x-auto text-xs font-mono border"
        >
          <code>{codeBlockLines.join('\n').replace(/^ {4}/gm, '')}</code>
        </pre>
      );
      inCodeBlock = false;
      codeBlockLines = [];
    }

    // Empty line = paragraph break
    if (trimmed === '') {
      if (elements.length > 0 && elements[elements.length - 1] !== null) {
        elements.push(null); // Mark for paragraph break
      }
      i++;
      continue;
    }

    // Check for bullet points
    if (/^[•\-\*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = [];
      let listType: 'bullet' | 'numbered' = /^[•\-\*]\s/.test(trimmed) ? 'bullet' : 'numbered';
      
      // Collect consecutive list items
      while (i < lines.length) {
        const currentLine = lines[i].trim();
        if (listType === 'bullet' && /^[•\-\*]\s/.test(currentLine)) {
          listItems.push(currentLine.replace(/^[•\-\*]\s/, ''));
          i++;
        } else if (listType === 'numbered' && /^\d+\.\s/.test(currentLine)) {
          listItems.push(currentLine.replace(/^\d+\.\s/, ''));
          i++;
        } else {
          break;
        }
      }

      // Render list
      const ListTag = listType === 'bullet' ? 'ul' : 'ol';
      elements.push(
        <ListTag
          key={`list-${i}`}
          className={cn(
            "my-3 space-y-2 ml-6",
            listType === 'bullet' ? "list-disc" : "list-decimal"
          )}
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="pl-1">
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Regular paragraph
    const paragraph = parseInlineMarkdown(trimmed);
    elements.push(
      <p key={`p-${i}`} className="my-2">
        {paragraph}
      </p>
    );
    i++;
  }

  // Handle remaining code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key={`code-end`}
        className="bg-muted p-3 rounded-md my-2 overflow-x-auto text-xs font-mono border"
      >
        <code>{codeBlockLines.join('\n').replace(/^ {4}/gm, '')}</code>
      </pre>
    );
  }

  // Insert paragraph breaks (null elements become <br />)
  return elements.map((el, idx) => {
    if (el === null) {
      return <br key={`br-${idx}`} className="my-1" />;
    }
    return el;
  });
}

/**
 * Parses inline markdown (bold, italic, links) and returns React elements
 */
function parseInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let currentIndex = 0;
  let keyCounter = 0;

  // Pattern for markdown: **bold**, *italic*, [link](url), or just URLs
  const patterns = [
    { regex: /\*\*([^*]+)\*\*/g, type: 'bold' }, // **bold**
    { regex: /\*([^*]+)\*/g, type: 'italic' }, // *italic*
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' }, // [text](url)
    { regex: /(https?:\/\/[^\s]+)/g, type: 'url' }, // plain URLs
  ];

  // Find all matches
  const matches: Array<{
    start: number;
    end: number;
    type: string;
    content: string;
    url?: string;
  }> = [];

  patterns.forEach(({ regex, type }) => {
    let match;
    regex.lastIndex = 0; // Reset regex
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type,
        content: match[1] || match[0],
        url: match[2],
      });
    }
  });

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep first)
  const filteredMatches: typeof matches = [];
  for (const match of matches) {
    const overlaps = filteredMatches.some(
      (m) => !(match.end <= m.start || match.start >= m.end)
    );
    if (!overlaps) {
      filteredMatches.push(match);
    }
  }

  // Build React elements
  filteredMatches.forEach((match) => {
    // Add text before match
    if (match.start > currentIndex) {
      const beforeText = text.slice(currentIndex, match.start);
      if (beforeText) {
        parts.push(beforeText);
      }
    }

    // Add formatted element
    if (match.type === 'bold') {
      parts.push(
        <strong key={`bold-${keyCounter++}`} className="font-semibold">
          {match.content}
        </strong>
      );
    } else if (match.type === 'italic') {
      parts.push(
        <em key={`italic-${keyCounter++}`} className="italic">
          {match.content}
        </em>
      );
    } else if (match.type === 'link' || match.type === 'url') {
      const url = match.url || match.content;
      parts.push(
        <a
          key={`link-${keyCounter++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {match.type === 'link' ? match.content : url}
        </a>
      );
    }

    currentIndex = match.end;
  });

  // Add remaining text
  if (currentIndex < text.length) {
    const remaining = text.slice(currentIndex);
    if (remaining) {
      parts.push(remaining);
    }
  }

  // If no matches, return text as-is
  if (parts.length === 0) {
    return [text];
  }

  return parts;
}
