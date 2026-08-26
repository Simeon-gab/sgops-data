import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { encryptSecrets } from "@/lib/sending/crypto";
import type { ApiError, SendingIdentity, Workspace } from "@/lib/utils/types";

const PUBLIC_COLUMNS =
  "id, workspace_id, kind, label, from_email, from_name, reply_to, is_default, status, verified_at, last_error, daily_limit, created_at, updated_at";

const EDITABLE = ["label", "from_name", "reply_to", "daily_limit"] as const;

async function context(): Promise<
  { ok: true; workspace: Workspace } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json<ApiError>(
        { error: "Unauthorized", code: "unauthorized" },
        { status: 401 }
      ),
    };
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return {
      ok: false,
      response: NextResponse.json<ApiError>(
        { error: "Could not initialize workspace", code: "workspace_error" },
        { status: 500 }
      ),
    };
  }

  return { ok: true, workspace };
}

// ── PATCH /api/sending-identities/[id] ────────────────────────────────────────
// Body: editable fields, plus { is_default: true } or { secrets: {...} }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await context();
  if (!ctx.ok) return ctx.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();

  // Scoped by workspace as well as id, so an id from another workspace is a
  // 404 rather than an edit.
  const { data: existing } = await admin
    .from("sending_identities")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json<ApiError>(
      { error: "Sending identity not found", code: "not_found" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};

  for (const field of EDITABLE) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  // The address is not editable: campaigns already sent from it, and changing
  // it in place would rewrite history rather than create a new mailbox.
  if (body.from_email !== undefined) {
    return NextResponse.json<ApiError>(
      {
        error: "The sending address cannot be changed. Add another identity instead.",
        code: "immutable_field",
      },
      { status: 409 }
    );
  }

  if (body.secrets !== undefined) {
    const secrets = body.secrets as Record<string, string> | null;
    try {
      updates.secrets =
        secrets && Object.keys(secrets).length > 0 ? encryptSecrets(secrets) : null;
    } catch (err) {
      return NextResponse.json<ApiError>(
        {
          error: err instanceof Error ? err.message : "Could not encrypt credentials",
          code: "encryption_unavailable",
        },
        { status: 500 }
      );
    }
    // New credentials have not been proven to work yet.
    updates.status = "unverified";
    updates.verified_at = null;
    updates.last_error = null;
  }

  if (body.is_default === true) {
    await admin
      .from("sending_identities")
      .update({ is_default: false })
      .eq("workspace_id", ctx.workspace.id)
      .eq("is_default", true);

    updates.is_default = true;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json<ApiError>(
      { error: "Nothing to update", code: "bad_request" },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("sending_identities")
    .update(updates)
    .eq("id", id)
    .select(PUBLIC_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ identity: data as Omit<SendingIdentity, "secrets"> });
}

// ── DELETE /api/sending-identities/[id] ───────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await context();
  if (!ctx.ok) return ctx.response;

  const admin = createServiceClient();

  // A campaign mid-flight would lose its mailbox and fall back to the
  // workspace default, which is not what anyone deleting this intended.
  const { count: active } = await admin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("sending_identity_id", id)
    .in("status", ["sending", "scheduled", "paused"]);

  if ((active ?? 0) > 0) {
    return NextResponse.json<ApiError>(
      {
        error: `${active} campaign${active === 1 ? " is" : "s are"} still sending from this address`,
        code: "identity_in_use",
      },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("sending_identities")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id)
    .select("id, is_default")
    .maybeSingle();

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json<ApiError>(
      { error: "Sending identity not found", code: "not_found" },
      { status: 404 }
    );
  }

  // Removing the default would otherwise leave the workspace with identities
  // but nothing marked default, which silently falls back to the platform.
  if ((data as { is_default: boolean }).is_default) {
    const { data: next } = await admin
      .from("sending_identities")
      .select("id")
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await admin
        .from("sending_identities")
        .update({ is_default: true })
        .eq("id", (next as { id: string }).id);
    }
  }

  return NextResponse.json({ deleted: true });
}
