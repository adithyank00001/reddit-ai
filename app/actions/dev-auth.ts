"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { v5 as uuidv5 } from "uuid";
import { cookies } from "next/headers";

// UUID namespace for deterministic user ID generation
const UUID_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const DEV_PASSWORD = "dev123";

/**
 * Security check: Only allow in development
 */
function checkDevMode() {
  if (process.env.NODE_ENV === "production") {
    return { error: "Dev mode only - not available in production" };
  }
  return null;
}

/**
 * Switch to a mock user by email
 * Uses cookies to simulate authentication
 */
export async function switchUser(email: string) {
  const devCheck = checkDevMode();
  if (devCheck) return devCheck;

  const supabase = await createServerSupabaseClient();

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Generate deterministic UUID from email
    const mockUserId = uuidv5(cleanEmail, UUID_NAMESPACE);

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dev-auth.ts:36',message:'switchUser: Before setting cookie',data:{email:cleanEmail,userId:mockUserId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Set cookie to store user ID (accessible from both server and client)
    const cookieStore = await cookies();
    cookieStore.set("dev_mock_user_id", mockUserId, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    cookieStore.set("dev_mock_user_email", cleanEmail, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dev-auth.ts:55',message:'switchUser: After setting cookie',data:{email:cleanEmail,userId:mockUserId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Ensure user "exists" by upserting project_settings
    const { error: upsertError } = await supabase
      .from("project_settings")
      .upsert({
        user_id: mockUserId,
        product_description_raw: "",
        keywords: [],
      });

    if (upsertError) {
      console.error("Failed to create mock user:", upsertError);
      // Don't fail the operation
    }

    revalidatePath("/dashboard");
    return { success: true, userId: mockUserId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new mock user or switch to existing one
 * Redirects to switchUser logic for consistency
 */
export async function createUser(formData: FormData) {
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    return { success: false, error: "Email is required" };
  }

  // Handle subreddits and keywords setup
  const supabase = await createServerSupabaseClient();
  const mockUserId = uuidv5(email.trim().toLowerCase(), UUID_NAMESPACE);

  const subreddit = String(formData.get("subreddit") || "").trim();
  const keywords = String(formData.get("keywords") || "");
  const productDescription = String(formData.get("productDescription") || "");

  try {
    // Insert project_settings if keywords or description provided
    if (keywords || productDescription) {
      const cleanedKeywords = keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length >= 2);

      const maxKeywords = 20;
      const limitedKeywords =
        cleanedKeywords.length > maxKeywords
          ? cleanedKeywords.slice(0, maxKeywords)
          : cleanedKeywords;

      const { error: settingsError } = await supabase
        .from("project_settings")
        .upsert(
          {
            user_id: mockUserId,
            keywords: limitedKeywords,
            product_description_raw: productDescription,
          },
          { onConflict: "user_id" }
        );

      if (settingsError) {
        console.error("Failed to insert project_settings:", settingsError);
      }
    }

    // Insert subreddits if provided
    if (subreddit) {
      const subredditNames = subreddit
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

      if (subredditNames.length > 0) {
        // Insert into global subreddits table (will ignore duplicates)
        for (const name of subredditNames) {
          const { error: subredditError } = await supabase
            .from("subreddits")
            .upsert(
              { name },
              { onConflict: "name", ignoreDuplicates: true }
            );

          if (subredditError) {
            console.error(`Failed to insert subreddit ${name}:`, subredditError);
          }
        }

        // Save ALL subreddits to alerts table (one row per subreddit)
        for (const subredditName of subredditNames) {
          const { error: alertError } = await supabase
            .from("alerts")
            .insert({
              user_id: mockUserId,
              subreddit: subredditName,
              is_active: true,
              product_description_raw: productDescription || null,
            });

          if (alertError) {
            console.error(`Failed to insert alert for subreddit ${subredditName}:`, alertError);
          }
        }
      }
    }

    // Now switch to this user (sets cookies)
    return await switchUser(email);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
