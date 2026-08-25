import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { encryptSecrets, isEncryptionConfigured } from "@/lib/sending/crypto";
import { IMPLEMENTED_KINDS, TRANSPORT_KINDS, type TransportKind } from "@/lib/sending/types";
import type { ApiError, SendingIdentity, SendingIdentityPublic } from "@/lib/utils/types";

// Credentials never leave the server, so every response is built from this
// list and the secrets column is never selected into it.
const PUBLIC_COLUMNS =
  "id, workspace_id, kind, label, from_email, from_name, reply_to, is_default, status, verified_at, last_error, daily_limit, created_at, updated_at";

interface CreateBody {
  kind?: string;
  label?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  is_default?: boolean;
  daily_limit?: number;
  // Provider credentials, encrypted before storage. Omit to send through the
  // platform's own account.
  secrets?: Record<string, string>;
}

// ── GET /api/sending-identities ───────────────────────────────────────────────

export async function GET() {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) return NextResponse.json({ identities: [] });

  const { data, error } = await supabase
    .from("sending_identities")
    .select(PUBLIC_COLUMNS)
    .eq("workspace_id", workspace.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "db_error" },
      { status: 500 }
    );
  }

  // Whether credentials exist is safe to report and is what the UI needs to
  // distinguish "sends through the platform" from "sends through its own key".
  const admin = createServiceClient();
  const { data: flags } = await admin
    .from("sending_identities")
    .select("id, secrets")
    .eq("workspace_id", workspace.id);

  const withCredentials = new Set(
    ((flags ?? []) as { id: string; secrets: string | null }[])
      .filter((row) => Boolean(row.secrets))
      .map((row) => row.id)
  );

  const identities: SendingIdentityPublic[] = (data ?? []).map((row) => ({
    ...(row as Omit<SendingIdentity, "secrets">),
    has_credentials: withCredentials.has((row as { id: string }).id),
  }));

  return NextResponse.json({
    identities,
    // The UI hides the credential fields when the platform cannot store them.
    encryption_ready: isEncryptionConfigured(),
    implemented_kinds: IMPLEMENTED_KINDS,
  });
}

// ── POST /api/sending-identities ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const fromEmail = body.from_email?.trim().toLowerCase();
  if (!fromEmail || !fromEmail.includes("@")) {
    return NextResponse.json<ApiError>(
      { error: "A valid sending address is required", code: "bad_request" },
      { status: 400 }
    );
  }

  const kind = (body.kind ?? "resend") as TransportKind;
  if (!TRANSPORT_KINDS.includes(kind)) {
    return NextResponse.json<ApiError>(
      { error: `Unknown transport "${body.kind}"`, code: "bad_request" },
      { status: 400 }
    );
  }

  if (!IMPLEMENTED_KINDS.includes(kind)) {
    return NextResponse.json<ApiError>(
      {
        error: `Sending through ${kind} is not implemented yet`,
        code: "transport_unavailable",
      },
      { status: 400 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  const hasSecrets = Boolean(body.secrets && Object.keys(body.secrets).length > 0);

  let encrypted: string | null = null;
  if (hasSecrets) {
    try {
      encrypted = encryptSecrets(body.secrets!);
    } catch (err) {
      return NextResponse.json<ApiError>(
        {
          error: err instanceof Error ? err.message : "Could not encrypt credentials",
          code: "encryption_unavailable",
        },
        { status: 500 }
      );
    }
  }

  // Written with the service client because the secrets column is unreadable,
  // and unwritable, by any browser session. Workspace ownership was already
  // established above.
  const admin = createServiceClient();

  const { count: existing } = await admin
    .from("sending_identities")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  // The first identity a workspace creates becomes its default, otherwise
  // creating one would change nothing and the user would wonder why.
  const makeDefault = body.is_default ?? (existing ?? 0) === 0;

  if (makeDefault) await clearDefault(admin, workspace.id);

  const { data, error } = await admin
    .from("sending_identities")
    .insert({
      workspace_id: workspace.id,
      kind,
      label:      body.label?.trim() || null,
      from_email: fromEmail,
      from_name:  body.from_name?.trim() || null,
      reply_to:   body.reply_to?.trim().toLowerCase() || null,
      is_default: makeDefault,
      daily_limit: typeof body.daily_limit === "number" ? body.daily_limit : null,
      secrets: encrypted,
    })
    .select(PUBLIC_COLUMNS)
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json<ApiError>(
      {
        error: duplicate ? "That address is already a sending identity" : error.message,
        code: duplicate ? "duplicate" : "db_error",
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({
    identity: { ...(data as Omit<SendingIdentity, "secrets">), has_credentials: hasSecrets },
  });
}

// Not exported: a route module may only export route handlers, and Next fails
// the build on anything else.
// biome-ignore lint: Supabase client generic is not exported in a usable form
async function clearDefault(admin: any, workspaceId: string) {
  await admin
    .from("sending_identities")
    .update({ is_default: false })
    .eq("workspace_id", workspaceId)
    .eq("is_default", true);
}
