"use server";

import { createClient } from "@/utils/supabase/server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Sign in with email and password
 */
export async function signInWithPassword(formData: FormData) {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:11',message:'signInWithPassword: function entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:25',message:'signInWithPassword: after signInWithPassword',data:{hasError:!!error,hasUser:!!data?.user,userId:data?.user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (error) {
    return { error: error.message };
  }

  // Check if user has completed onboarding steps
  if (data.user) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:31',message:'signInWithPassword: checking onboarding status',data:{userId:data.user.id,userEmail:data.user.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("project_settings")
      .select("website_url, keywords")
      .eq("user_id", data.user.id)
      .maybeSingle();

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:36',message:'signInWithPassword: database query result',data:{hasSettings:!!settings,websiteUrl:settings?.website_url,hasKeywords:!!settings?.keywords,keywordCount:settings?.keywords?.length || 0,error:settingsError?.message,queryError:settingsError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    revalidatePath("/", "layout");
    
    // If no website_url, redirect to step 1
    if (!settings?.website_url) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:42',message:'signInWithPassword: redirecting to step 1',data:{reason:'no website_url'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      redirect("/onboarding/step-1");
    } 
    // If has website_url but no keywords, redirect to step 2
    else if (!settings.keywords || settings.keywords.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:48',message:'signInWithPassword: redirecting to step 2',data:{reason:'no keywords'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      redirect("/onboarding/step-2");
    } 
    // If has website_url and keywords, check for subreddits (step 3)
    else {
      // Check if user has subreddits in alerts table
      const { data: alerts, error: alertsError } = await supabaseServiceRole
        .from("alerts")
        .select("id")
        .eq("user_id", data.user.id)
        .limit(1);

      const hasSubreddits = alerts && alerts.length > 0;

      // If no subreddits, redirect to step 3
      if (!hasSubreddits) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:62',message:'signInWithPassword: redirecting to step 3',data:{reason:'no subreddits'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        redirect("/onboarding/step-3");
      }
      // If all three completed, redirect to dashboard
      else {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:68',message:'signInWithPassword: redirecting to dashboard',data:{reason:'onboarding complete',websiteUrl:settings.website_url,keywordCount:settings.keywords.length,subredditCount:alerts.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        redirect("/dashboard");
      }
    }
  } else {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/actions.ts:48',message:'signInWithPassword: no user data, redirecting to dashboard',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
}

/**
 * Sign up with email and password
 */
export async function signUpWithPassword(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // New users should always go to onboarding step 1
  revalidatePath("/", "layout");
  redirect("/onboarding/step-1");
}
