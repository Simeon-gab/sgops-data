import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { resolveTransport } from "@/lib/sending/resolve";
import type { ApiError, Workspace } from "@/lib/utils/types";

export const maxDuration = 30;

// ── POST /api/sending-identities/[id]/verify ──────────────────────────────────
//
// Opens a connection to the mail server and logs in, without sending anything.
// The alternative is discovering that a password is wrong on the first message
// of a four hundred person campaign, having already marked that recipient
// failed.
//
// Not every transport can answer this. An API key is only really tested by
// using it, so a resend identity reports back that there was nothing to check
// rather than claiming a verification it did not perform.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  const admin = createServiceClient();

  const { data: identity } = await admin
    .from("sending_identities")
    .select("id, from_email")
    .eq("id", params.id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!identity) {
    return NextResponse.json<ApiError>(
      { error: "Sending identity not found", code: "not_found" },
      { status: 404 }
    );
  }

  const failed = async (message: string) => {
    await admin
      .from("sending_identities")
      .update({ status: "failed", verified_at: null, last_error: message })
      .eq("id", params.id);

    return NextResponse.json(
      { verified: false, error: message },
      { status: 200 }
    );
  };

  let transport;
  try {
    transport = await resolveTransport({
      workspace: workspace as Workspace,
      identityId: params.id,
      fallback: { email: null, name: null },
    });
  } catch (err) {
    return failed(err instanceof Error ? err.message : "Could not build this transport");
  }

  // Nothing to prove without sending. Saying so is more honest than stamping
  // it verified.
  if (!transport.verify) {
    await transport.close?.();
    return NextResponse.json({
      verified: false,
      checked: false,
      message: `A ${transport.kind} identity cannot be checked without sending a message.`,
    });
  }

  try {
    await transport.verify();
  } catch (err) {
    await transport.close?.();
    return failed(err instanceof Error ? err.message : "The mail server rejected the connection");
  }

  await transport.close?.();

  await admin
    .from("sending_identities")
    .update({
      status: "verified",
      verified_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", params.id);

  return NextResponse.json({ verified: true, checked: true });
}
