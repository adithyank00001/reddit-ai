import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Update the user's session
  const response = await updateSession(request);

  // Get the pathname
  const pathname = request.nextUrl.pathname;

  // Allow access to login and auth callback routes
  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) {
    return response;
  }

  // Protect dashboard routes - require authentication
  if (pathname.startsWith("/dashboard")) {
    // Check if user has a valid session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Cookies are set by updateSession above
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If no user, redirect to login
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return Response.redirect(loginUrl);
    }
  }

  // Allow all other routes (landing page, etc.)
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
