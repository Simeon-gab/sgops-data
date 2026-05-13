import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Workspace } from "@/lib/utils/types";

// Returns the user's workspace, creating one if it doesn't exist yet.
// Handles the case where signup's workspace creation failed silently,
// and guards against concurrent-request races with a retry-on-conflict.
export async function getOrCreateWorkspace(
  supabase: SupabaseClient,
  user: User
): Promise<Workspace | null> {
  const { data: existing } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) return existing as Workspace;

  // Workspace missing — auto-create (slug is deterministic so concurrent
  // inserts will fail on the unique constraint rather than create duplicates)
  const slug = `ws-${user.id.replace(/-/g, "").slice(0, 16)}`;
  const { data: created } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name:     "My Workspace",
      slug,
      settings: {},
    })
    .select()
    .single();

  if (created) return created as Workspace;

  // Insert failed (race condition: concurrent request created it first).
  // Retry the lookup to return the row that now exists.
  const { data: retry } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (retry as Workspace) ?? null;
}
