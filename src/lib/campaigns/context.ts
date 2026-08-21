import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import type { ApiError, Campaign, Workspace } from "@/lib/utils/types";

// Every campaign route starts the same way: authenticate, resolve the
// workspace, load the campaign and confirm it belongs to that workspace.
// RLS already blocks cross-workspace reads; the explicit check turns what would
// otherwise surface as a confusing empty result into a plain 404.

export interface CampaignContext {
  supabase: SupabaseClient;
  user: User;
  workspace: Workspace;
  campaign: Campaign;
}

export type ContextResult =
  | { ok: true; context: CampaignContext }
  | { ok: false; response: NextResponse };

function fail(error: string, code: string, status: number): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json<ApiError>({ error, code }, { status }) };
}

export async function loadCampaign(campaignId: string): Promise<ContextResult> {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Unauthorized", "unauthorized", 401);

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) return fail("Could not initialize workspace", "workspace_error", 500);

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) return fail(error.message, "db_error", 500);
  if (!data)  return fail("Campaign not found", "not_found", 404);

  return { ok: true, context: { supabase, user, workspace, campaign: data as Campaign } };
}
