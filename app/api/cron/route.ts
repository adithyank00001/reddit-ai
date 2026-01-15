import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * TEMPORARY ECHO ENDPOINT FOR CONNECTIVITY TESTING
 * This is a simplified version to test Google Apps Script → Vercel connection
 * TODO: Replace with full Reddit data processing logic after testing
 */
export async function POST(req: Request) {
  try {
    // Step 1: Check Authorization header
    const authHeader = req.headers.get("authorization");
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("❌ Authorization failed:", {
        provided: authHeader ? "present" : "missing",
        expected: `Bearer ${process.env.CRON_SECRET ? "***" : "MISSING"}`,
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("✅ Authorization successful");

    // Step 2: Read and parse JSON body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.log("❌ Failed to parse JSON body:", error);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Step 3: Log the entire body (you'll see this in Vercel logs)
    console.log("📦 Received data from Google Apps Script:");
    console.log(JSON.stringify(body, null, 2));

    // Step 4: Return success response
    return NextResponse.json({
      status: "Connection Successful",
      receivedData: body,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Unhandled error:", errorMessage);
    
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}
