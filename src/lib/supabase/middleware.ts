import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Reachable without a session. /auth/* has to be here above all: it is where
  // the confirmation and recovery links land, and bouncing those to /login
  // would discard the one-time code before anything could exchange it, which
  // makes email confirmation impossible to complete.
  const PUBLIC_PREFIXES = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/",
  ];
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Deliberately not the whole public list. Someone who followed a recovery
  // link is signed in by the time they reach /reset-password, so sending
  // signed-in users away from it would leave them unable to set a password.
  const isSignedOutOnly = pathname.startsWith("/login") || pathname.startsWith("/signup");

  // API routes authenticate themselves, each one calling getUser and scoping
  // every query to the caller's workspace. Redirecting them here would answer
  // a fetch with a login page instead of a 401.
  const isApiRoute = pathname.startsWith("/api");

  if (!user && !isPublic && !isApiRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Cleared before `next` goes on, or the intercepted page's own query string
    // rides along into the login URL. That is not just untidy: the login form
    // renders an `error` param, so /leads?error=... would arrive as
    // /login?error=... and print whatever it said above the password field.
    url.search = "";
    // So the login page can send them back where they were headed rather than
    // dropping everyone on the same landing page.
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && isSignedOutOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/prospect";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
