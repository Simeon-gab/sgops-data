// Where a post-login redirect is allowed to send someone.
//
// The target arrives in a query string: put there by the middleware when it
// intercepts a protected page, and carried through links that get emailed out.
// Neither is trustworthy. A value the browser reads as absolute would let
// anyone hand out a link to this domain that quietly lands the visitor on
// theirs, with this app's login page as the referrer, which is the shape most
// credential-phishing pages want.
//
// So: relative paths only, and the fallback when anything looks off.

export const DEFAULT_REDIRECT = "/prospect";

// Control characters, including the newlines and tabs a browser strips out
// before it parses a URL. That stripping is the attack: "/\t/evil.example"
// passes a naive leading-slash check and then becomes "//evil.example".
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

// A scheme cannot appear in a path, so anything carrying one is an attempt to
// smuggle "/javascript:..." or similar past the leading-slash check.
const EMBEDDED_SCHEME = /^\/[a-z][a-z0-9+.-]*:/i;

export function safeRedirect(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_REDIRECT;

  const target = raw.trim();
  if (!target.startsWith("/")) return DEFAULT_REDIRECT;

  // "//evil.example" and "/\evil.example" both start with a slash and are both
  // absolute to a browser. A backslash is normalised to a forward slash by
  // every major engine, so it has to be treated as one here.
  if (target.startsWith("//") || target.startsWith("/\\")) return DEFAULT_REDIRECT;

  if (EMBEDDED_SCHEME.test(target)) return DEFAULT_REDIRECT;
  if (CONTROL_CHARS.test(target)) return DEFAULT_REDIRECT;

  return target;
}
