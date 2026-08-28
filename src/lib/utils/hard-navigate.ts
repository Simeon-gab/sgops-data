// A full document load, for the moments when who is signed in changes.
//
// The client router keeps rendered payloads for routes it has already visited,
// keyed by path and with no notion of who fetched them. Signing in with
// router.push() is a soft navigation, so it can be answered out of that cache:
// the arriving account gets the previous session's copy of the page, rendered
// under the previous session's server checks. That is how a brand new account
// landed on /prospect instead of /onboarding, having been handed a shell built
// for someone who had already onboarded.
//
// router.refresh() is not enough on its own. It revalidates the route being
// displayed, not the entries sitting in the cache for every other route, and it
// resolves after the push it is meant to protect has already been served.
//
// A full load throws the whole client cache away, which is the only thing that
// is actually true at an identity boundary. Sign-in, sign-out, a password reset
// that signs you in, and finishing onboarding all cross one, so they all go
// through here rather than through the router.
export function hardNavigate(path: string): void {
  window.location.assign(path);
}
