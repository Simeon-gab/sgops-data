-- Take EXECUTE on current_workspace_ids() away from anon.
--
-- The campaigns migration revoked it FROM PUBLIC and granted it to
-- authenticated, which reads as if anon were covered. It was not: Supabase
-- grants EXECUTE on public-schema functions to anon and authenticated by
-- default, and a REVOKE FROM PUBLIC does not touch a grant held by a named
-- role. So anon kept the privilege and the function stayed callable, unsigned,
-- at /rest/v1/rpc/current_workspace_ids.
--
-- Nothing leaked. The function selects workspaces owned by auth.uid(), which is
-- NULL for anon, so it returned an empty set to anyone who called it. This is
-- closing the reachable surface rather than fixing a disclosure: a SECURITY
-- DEFINER function runs as its owner, and one of those should not be sitting
-- on the public API for callers who have not signed in.

REVOKE EXECUTE ON FUNCTION public.current_workspace_ids() FROM anon;

-- Restated so the intended grants are visible in one place. The RLS policies
-- that call this function run as the authenticated role, and the service role
-- bypasses RLS entirely but still executes it through those policies.
GRANT EXECUTE ON FUNCTION public.current_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_workspace_ids() TO service_role;
