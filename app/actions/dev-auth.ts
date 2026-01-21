"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

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
 * Switch to an existing user by email
 * Signs in with the default dev password
 */
export async function switchUser(email: string) {
  const devCheck = checkDevMode();
  if (devCheck) return devCheck;

  const supabase = await createServerSupabaseClient();

  try {
    // Sign in with email and default password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: DEV_PASSWORD,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: "Failed to sign in" };
    }

    revalidatePath("/dashboard");
    return { success: true, userId: data.user.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new user or switch to existing one
 * If user exists, just signs them in
 * If new, creates account, inserts project_settings, and signs in
 */
export async function createUser(formData: FormData) {
  const devCheck = checkDevMode();
  if (devCheck) return devCheck;

  const supabase = await createServerSupabaseClient();

  const email = String(formData.get("email") || "").trim();
  const subreddit = String(formData.get("subreddit") || "").trim();
  const keywords = String(formData.get("keywords") || "");
  const productDescription = String(formData.get("productDescription") || "");

  if (!email) {
    return { success: false, error: "Email is required" };
  }

  try {
    // First, try to sign in (user might already exist)
    const signInResult = await supabase.auth.signInWithPassword({
      email,
      password: DEV_PASSWORD,
    });

    // If sign in succeeds, user exists - just return success
    if (signInResult.data.user && !signInResult.error) {
      revalidatePath("/dashboard");
      return { success: true, userId: signInResult.data.user.id, existing: true };
    }

    // User doesn't exist, create new account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: DEV_PASSWORD,
      options: {
        emailRedirectTo: undefined, // No email confirmation needed
      },
    });

    if (signUpError) {
      return { success: false, error: signUpError.message };
    }

    if (!signUpData.user) {
      return { success: false, error: "Failed to create user" };
    }

    const userId = signUpData.user.id;

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
        .insert({
          user_id: userId,
          keywords: limitedKeywords,
          product_description_raw: productDescription,
        });

      if (settingsError) {
        console.error("Failed to insert project_settings:", settingsError);
        // Don't fail the whole operation, just log it
      }
    }

    // Insert subreddits if provided
    if (subreddit) {
      // Split by comma and clean up
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

        // Also save to alerts table (you can keep the first one for compatibility)
        const { error: alertError } = await supabase
          .from("alerts")
          .insert({
            user_id: userId,
            subreddit: subredditNames[0], // Store first subreddit in alerts
          });

        if (alertError) {
          console.error("Failed to insert alert:", alertError);
        }
      }
    }

    // Sign in the newly created user
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: DEV_PASSWORD,
    });

    if (signInError) {
      return { success: false, error: "User created but failed to sign in" };
    }

    revalidatePath("/dashboard");
    return { success: true, userId, existing: false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
