import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables for client-side usage");
}

/**
 * Client-side Supabase client for browser usage
 * Use this for real-time subscriptions and client-side queries
 * 
 * Note: This uses the anon key, not the service role key.
 * The service role key should only be used server-side.
 */
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
