import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  const requestStart = Date.now();
  logger.apiRequest("GET", "/api/debug-db");
  logger.step("DEBUG_DB", "Starting database debug check");
  
  try {
    // Check what tables exist by trying common names
    const tableCandidates = [
      "Alert", "alert", "alerts",
      "Post", "post", "posts", "processed_posts",
      "Lead", "lead", "leads"
    ];

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      tables: {},
    };

    // Try to query each table to see which ones exist
    for (const tableName of tableCandidates) {
      try {
        logger.dbQuery("SELECT", tableName, { operation: "existence_check" });
        // Try to get table structure by selecting all columns
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .limit(1);

        if (!error) {
          logger.info("DEBUG_DB", `Table ${tableName} exists`, {
            columns: data && data.length > 0 ? Object.keys(data[0]) : []
          });
          results.tables[tableName] = {
            exists: true,
            sampleRow: data?.[0] || null,
            columnNames: data && data.length > 0 ? Object.keys(data[0]) : [],
            rowCount: null, // We'll get this separately
          };

          // Get row count
          logger.dbQuery("SELECT", tableName, { operation: "count" });
          const { count } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });
          
          results.tables[tableName].rowCount = count ?? 0;
          logger.debug("DEBUG_DB", `Table ${tableName} row count: ${count ?? 0}`);
        } else {
          logger.dbError("SELECT", tableName, error);
          results.tables[tableName] = {
            exists: false,
            error: error.message,
          };
        }
      } catch (err: any) {
        results.tables[tableName] = {
          exists: false,
          error: err.message,
        };
      }
    }

    // Specifically check alerts table structure
    const { data: alertsData, error: alertsError } = await supabase
      .from("alerts")
      .select("id, subreddit, keywords, active")
      .limit(5);

    results.alertsQuery = {
      success: !alertsError,
      error: alertsError?.message || null,
      data: alertsData || [],
      count: alertsData?.length || 0,
    };

    // Check processed_posts structure
    const { data: postsData, error: postsError } = await supabase
      .from("processed_posts")
      .select("*")
      .limit(5);

    results.postsQuery = {
      success: !postsError,
      error: postsError?.message || null,
      data: postsData || [],
      count: postsData?.length || 0,
    };

    const responseTime = Date.now() - requestStart;
    logger.apiResponse("GET", "/api/debug-db", 200, "OK", responseTime);
    logger.step("DEBUG_DB", "Database debug check completed", {
      tablesChecked: tableCandidates.length,
      responseTime: `${responseTime}ms`
    });
    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    const responseTime = Date.now() - requestStart;
    logger.error("DEBUG_DB", "Database debug check failed", {
      error: error.message,
      stack: error.stack
    });
    logger.apiResponse("GET", "/api/debug-db", 500, "Internal Server Error", responseTime);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}



