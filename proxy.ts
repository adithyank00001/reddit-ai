import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

/**
 * Proxy function for Next.js 16+
 * Handles session updates and routing concerns only
 * Authentication checks are handled in Server Layout Guards
 * Note: Next.js 16.1.1 still uses NextRequest (ProxyRequest may not exist yet)
 */
export async function proxy(request: NextRequest) {
  // Update the user's session (routing concern)
  const response = await updateSession(request);

  // Allow all routes - authentication is handled in layout guards
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
