import { createServiceClient } from "@/lib/supabase/server";
import { decryptSecrets } from "./crypto";
import { createResendTransport } from "./transports/resend";
import type { ResolvedIdentity, Transport, TransportKind } from "./types";
import { TransportError } from "./types";
import type { SendingIdentity, Workspace } from "@/lib/utils/types";

// Picking the mailbox a message leaves from, and building the transport that
// delivers it.
//
// Order: the identity the campaign names, then the workspace's default, then
// the platform itself. That last step is what keeps this change invisible: a
// workspace with no identities behaves exactly as it did before the table
// existed.

type TransportFactory = (identity: ResolvedIdentity) => Transport;

// Adding SMTP is a file under transports/ and a line here.
const FACTORIES: Partial<Record<TransportKind, TransportFactory>> = {
  resend: createResendTransport,
};

export interface ResolveOptions {
  workspace: Workspace;
  // The campaign's chosen identity, when it has one.
  identityId?: string | null;
  // Where to send from when no identity applies. This is the pre-identity
  // behaviour, preserved verbatim by each caller.
  fallback: { email: string | null; name: string | null };
}

export async function resolveTransport(options: ResolveOptions): Promise<Transport> {
  const identity = await resolveIdentity(options);
  const factory = FACTORIES[identity.kind];

  if (!factory) {
    throw new TransportError(
      identity.kind,
      `Sending through ${identity.kind} is not implemented yet. Choose another identity.`
    );
  }

  return factory(identity);
}

export async function resolveIdentity(options: ResolveOptions): Promise<ResolvedIdentity> {
  const { workspace, identityId, fallback } = options;

  // Credentials are read with the service client and never with the caller's,
  // because the secrets column is deliberately unreadable by any browser
  // session. The workspace filter below is what scopes it instead.
  const admin = createServiceClient();

  let row: SendingIdentity | null = null;

  if (identityId) {
    const { data } = await admin
      .from("sending_identities")
      .select("*")
      .eq("id", identityId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    row = (data as SendingIdentity) ?? null;
  }

  if (!row) {
    const { data } = await admin
      .from("sending_identities")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_default", true)
      .maybeSingle();

    row = (data as SendingIdentity) ?? null;
  }

  if (row) {
    return {
      id:        row.id,
      kind:      row.kind,
      fromEmail: row.from_email,
      fromName:  row.from_name,
      replyTo:   row.reply_to,
      secrets:   decryptSecrets(row.secrets ?? null),
    };
  }

  // ── Platform fallback ───────────────────────────────────────────────────────

  const email = fallback.email?.trim();

  if (!email || !email.includes("@")) {
    throw new TransportError(
      "resend",
      "No sending address. Add a sending identity, or set one on the campaign."
    );
  }

  return {
    id: null,
    kind: "resend",
    fromEmail: email,
    fromName: fallback.name,
    replyTo: null,
    // Empty, so the transport falls through to the platform's own key.
    secrets: {},
  };
}
