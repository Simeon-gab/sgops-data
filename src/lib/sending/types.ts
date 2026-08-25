// The seam between "what to send" and "whose mailbox sends it".
//
// Everything above this line, pacing, claiming, screening, suppression and
// unsubscribe, is transport-agnostic and stays that way. Adding SMTP or an
// OAuth-connected mailbox means writing one file that satisfies Transport and
// registering it, not touching the campaign worker.

export type TransportKind = "resend" | "smtp" | "gmail" | "outlook";

export const TRANSPORT_KINDS: TransportKind[] = ["resend", "smtp", "gmail", "outlook"];

// Kinds with a working implementation today. The others exist in the type so
// the database and UI can name them before the code can deliver through them.
export const IMPLEMENTED_KINDS: TransportKind[] = ["resend"];

export interface OutboundMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
}

export interface SentMessage {
  // The provider's id for this message. Stored on outreach_sends.resend_id,
  // which kept its name from when Resend was the only possibility. Delivery
  // webhooks match on it.
  providerId: string;
}

export interface Transport {
  kind: TransportKind;
  from: { email: string; name: string | null };
  send(message: OutboundMessage): Promise<SentMessage>;
}

// A sending identity with its credentials already decrypted, which only ever
// happens server-side inside resolveTransport.
export interface ResolvedIdentity {
  id: string | null;
  kind: TransportKind;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  // Provider-specific credentials. Empty when the identity uses the
  // platform's own.
  secrets: Record<string, string>;
}

export class TransportError extends Error {
  readonly kind: TransportKind;

  constructor(kind: TransportKind, message: string) {
    super(message);
    this.name = "TransportError";
    this.kind = kind;
  }
}
