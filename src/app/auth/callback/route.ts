import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/utils/safe-redirect";

// Where every emailed auth link comes back to: the confirmation link after
// signup, and the recovery link after a password reset.
//
// Supabase's browser client uses PKCE, so those links return a one-time code
// rather than a session. Something has to exchange it, and until this route
// existed nothing did: the code landed on a page that ignored it, the visitor
// stayed signed out, and confirming an account appeared to do nothing at all.

// A code, never a message. The login page renders whatever this says, and the
// value travels in a URL anyone can compose, so free text here would let a
// stranger publish a link to the real login page that displays a sentence they
// wrote above the password field.
type AuthErrorCode = "link_invalid" | "link_expired";

function errorRedirect(req: NextRequest, code: AuthErrorCode) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeRedirect(req.nextUrl.searchParams.get("next"));

  // Supabase reports a rejected link by redirecting here with its own reason,
  // an expired confirmation being much the most common. The reason itself is
  // not forwarded, only the fact of it: it arrives in the query string like
  // everything else here and is no more trustworthy than the rest.
  const providerError =
    req.nextUrl.searchParams.get("error_description") ??
    req.nextUrl.searchParams.get("error");
  if (providerError) return errorRedirect(req, "link_expired");

  if (!code) return errorRedirect(req, "link_invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Codes are single-use and short-lived, so this is usually a link that was
    // already opened or has aged out, not a broken deployment.
    return errorRedirect(req, "link_expired");
  }

  const url = req.nextUrl.clone();
  url.search = "";
  url.pathname = next.split("?")[0];
  const query = next.split("?")[1];
  if (query) url.search = `?${query}`;

  return NextResponse.redirect(url);
}
