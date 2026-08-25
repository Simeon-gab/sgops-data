import { Resend } from "resend";
import type { OutboundMessage, ResolvedIdentity, SentMessage, Transport } from "../types";
import { TransportError } from "../types";

// Resend, either through the platform's own account or through a key the
// workspace supplied. Both go through the same code; the only difference is
// which key builds the client.
//
// A per-workspace key is what makes this multi-tenant: that workspace's
// bounces and complaints land on its own reputation rather than on shared
// infrastructure every other user also depends on.

export function createResendTransport(identity: ResolvedIdentity): Transport {
  const apiKey = identity.secrets.api_key || process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new TransportError(
      "resend",
      "No Resend API key. Set RESEND_API_KEY, or give this identity a key of its own."
    );
  }

  const client = new Resend(apiKey);

  return {
    kind: "resend",
    from: { email: identity.fromEmail, name: identity.fromName },

    async send(message: OutboundMessage): Promise<SentMessage> {
      const from = identity.fromEmail.includes("@") && identity.fromName
        ? `${identity.fromName} <${identity.fromEmail}>`
        : identity.fromEmail;

      const replyTo = message.replyTo ?? identity.replyTo;

      const { data, error } = await client.emails.send({
        from,
        to:      message.to,
        subject: message.subject,
        html:    message.html,
        ...(message.text    ? { text: message.text } : {}),
        ...(replyTo         ? { replyTo } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
      });

      if (error || !data?.id) {
        throw new TransportError(
          "resend",
          (error as { message?: string })?.message ?? "Resend rejected the message"
        );
      }

      return { providerId: data.id };
    },
  };
}
