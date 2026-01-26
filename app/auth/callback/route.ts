import { createClient } from "@/utils/supabase/server";
import { supabase as supabaseServiceRole } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");

  if (code) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/callback/route.ts:12',message:'auth callback: exchanging code for session',data:{hasCode:!!code,requestedNext},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/callback/route.ts:15',message:'auth callback: after exchangeCodeForSession',data:{hasError:!!error,hasUser:!!data?.user,userId:data?.user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (!error && data.user) {
      // Check if user has completed onboarding steps
      const { data: settings, error: settingsError } = await supabaseServiceRole
        .from("project_settings")
        .select("website_url, keywords")
        .eq("user_id", data.user.id)
        .maybeSingle();

      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/callback/route.ts:22',message:'auth callback: database query result',data:{hasSettings:!!settings,websiteUrl:settings?.website_url,hasKeywords:!!settings?.keywords,keywordCount:settings?.keywords?.length || 0,error:settingsError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // Determine redirect destination
      // Always check onboarding status first - only use requestedNext if onboarding is complete
      let next: string;
      if (!settings?.website_url) {
        // No website_url - redirect to step 1
        next = "/onboarding/step-1";
      } else if (!settings.keywords || settings.keywords.length === 0) {
        // Has website_url but no keywords - redirect to step 2
        next = "/onboarding/step-2";
      } else {
        // Check if user has subreddits in alerts table (step 3)
        const { data: alerts } = await supabaseServiceRole
          .from("alerts")
          .select("id")
          .eq("user_id", data.user.id)
          .limit(1);

        const hasSubreddits = alerts && alerts.length > 0;

        if (!hasSubreddits) {
          // Has website_url and keywords but no subreddits - redirect to step 3
          next = "/onboarding/step-3";
        } else {
          // User has completed onboarding - use requested redirect or default to dashboard
          next = requestedNext || "/dashboard";
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f26b0d71-5d71-4d69-b4d0-1706630ff879',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/callback/route.ts:35',message:'auth callback: redirecting',data:{next,reason:!settings?.website_url?'no website_url':!settings?.keywords || settings.keywords.length === 0?'no keywords':'onboarding complete'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
