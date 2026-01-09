import * as fsSync from "fs";
import path from "path";

/**
 * Comprehensive logging utility that writes to workflow.log
 * Logs everything with timestamps and context
 */
class Logger {
  private logPath: string;
  private startTime: number;

  constructor() {
    this.logPath = path.join(process.cwd(), "workflow.log");
    this.startTime = Date.now();
    this.ensureLogFile();
  }

  private ensureLogFile() {
    try {
      const logDir = path.dirname(this.logPath);
      if (!fsSync.existsSync(logDir)) {
        fsSync.mkdirSync(logDir, { recursive: true });
      }
      // Create file if it doesn't exist
      if (!fsSync.existsSync(this.logPath)) {
        fsSync.writeFileSync(this.logPath, "", "utf8");
      }
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "debug",
          hypothesisId: "H2",
          location: "lib/logger.ts:ensureLogFile",
          message: "Log file ensured",
          data: { logPath: this.logPath },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch (err) {
      console.error(`[LOGGER ERROR] Failed to initialize log file:`, err);
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 23);
  }

  private getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    return `${elapsed}ms`;
  }

  private writeLog(level: string, category: string, message: string, data?: any) {
    const timestamp = this.formatTimestamp();
    const elapsed = this.getElapsedTime();
    const dataStr = data ? ` | DATA: ${JSON.stringify(data)}` : "";
    const logMessage = `[${timestamp}] [${elapsed}] [${level}] [${category}] ${message}${dataStr}\n`;
    
    // #region agent log
    fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "debug",
        hypothesisId: "H3",
        location: "lib/logger.ts:writeLog:beforeAppend",
        message: "About to append workflow log",
        data: { level, category },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // Always log to console
    console.log(logMessage.trim());
    
    // Append to workflow.log file
    try {
      fsSync.appendFileSync(this.logPath, logMessage, "utf8");
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "debug",
          hypothesisId: "H3",
          location: "lib/logger.ts:writeLog:afterAppend",
          message: "Append success",
          data: { level, category },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[LOGGER ERROR] Failed to write to workflow.log: ${errorMsg}`);
      // #region agent log
      fetch("http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "debug",
          hypothesisId: "H3",
          location: "lib/logger.ts:writeLog:error",
          message: "Append failed",
          data: { level, category, error: errorMsg },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }
  }

  // API Request logging
  apiRequest(method: string, url: string, headers?: Record<string, string>, body?: any) {
    const headerStr = headers ? ` | HEADERS: ${JSON.stringify(headers)}` : "";
    const bodyStr = body ? ` | BODY: ${JSON.stringify(body)}` : "";
    this.writeLog("API_REQ", "HTTP", `${method} ${url}${headerStr}${bodyStr}`);
  }

  apiResponse(method: string, url: string, status: number, statusText: string, responseTime: number, body?: any) {
    const bodyStr = body ? ` | RESPONSE: ${JSON.stringify(body)}` : "";
    this.writeLog("API_RES", "HTTP", `${method} ${url} | STATUS: ${status} ${statusText} | TIME: ${responseTime}ms${bodyStr}`);
  }

  // Database operations
  dbQuery(operation: string, table: string, query?: any, result?: any) {
    const queryStr = query ? ` | QUERY: ${JSON.stringify(query)}` : "";
    const resultStr = result ? ` | RESULT: ${JSON.stringify(result)}` : "";
    this.writeLog("DB", "QUERY", `${operation} on table '${table}'${queryStr}${resultStr}`);
  }

  dbError(operation: string, table: string, error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.writeLog("DB_ERROR", "QUERY", `${operation} on table '${table}' failed | ERROR: ${errorMsg}`);
  }

  // AI operations
  aiRequest(model: string, prompt: string, tokens?: number) {
    const tokenStr = tokens ? ` | TOKENS: ${tokens}` : "";
    this.writeLog("AI_REQ", "OPENAI", `Model: ${model} | Prompt length: ${prompt.length} chars${tokenStr}`);
  }

  aiResponse(model: string, response: string, tokens?: number, responseTime?: number) {
    const tokenStr = tokens ? ` | TOKENS: ${tokens}` : "";
    const timeStr = responseTime ? ` | TIME: ${responseTime}ms` : "";
    this.writeLog("AI_RES", "OPENAI", `Model: ${model} | Response: ${response.substring(0, 100)}...${tokenStr}${timeStr}`);
  }

  aiError(model: string, error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.writeLog("AI_ERROR", "OPENAI", `Model: ${model} | ERROR: ${errorMsg}`);
  }

  // Reddit API operations
  redditRequest(subreddit: string, url: string) {
    this.writeLog("REDDIT_REQ", "API", `Fetching from r/${subreddit} | URL: ${url}`);
  }

  redditResponse(subreddit: string, postCount: number, responseTime: number) {
    this.writeLog("REDDIT_RES", "API", `r/${subreddit} | Posts fetched: ${postCount} | TIME: ${responseTime}ms`);
  }

  redditError(subreddit: string, error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.writeLog("REDDIT_ERROR", "API", `r/${subreddit} | ERROR: ${errorMsg}`);
  }

  // General logging
  info(category: string, message: string, data?: any) {
    this.writeLog("INFO", category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.writeLog("WARN", category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.writeLog("ERROR", category, message, data);
  }

  debug(category: string, message: string, data?: any) {
    this.writeLog("DEBUG", category, message, data);
  }

  // Workflow steps
  step(stepName: string, message: string, data?: any) {
    this.writeLog("STEP", stepName, message, data);
  }

  // Timing
  startTimer(label: string) {
    return {
      label,
      start: Date.now(),
      end: () => {
        const duration = Date.now() - this.start;
        this.writeLog("TIMER", label, `Completed in ${duration}ms`);
        return duration;
      }
    };
  }
}

// Export singleton instance
export const logger = new Logger();
