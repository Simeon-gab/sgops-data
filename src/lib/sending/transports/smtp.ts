import nodemailer, { type Transporter } from "nodemailer";
import type { OutboundMessage, ResolvedIdentity, SentMessage, Transport } from "../types";
import { TransportError } from "../types";

// The workspace's own mail server, which is what makes a message actually come
// from the user rather than from the platform. Covers a Gmail app password, an
// Outlook account, and any custom domain, with no OAuth review to pass first.
//
// The trade against Resend, worth understanding before choosing it: an SMTP
// server accepts a message and says nothing afterwards. There is no delivery
// webhook, so a bounce arrives in the sender's own inbox rather than in
// /api/webhooks, and the suppression list never learns about it. Bounce-driven
// suppression only works on transports that report back.

// A hanging mail server must not eat the drain's whole time budget. These are
// deliberately short: the worker's per-run deadline is measured in seconds.
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

// Hosts a user must not be able to point the platform at. Their SMTP server is
// their business, but an arbitrary host from an arbitrary account turns this
// into a way to reach things only the server can see, including cloud instance
// metadata. Refusing these costs nothing legitimate.
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^\[?::1\]?$/,
  /^f[cd][0-9a-f]{2}:/i,
  /\.internal$/i,
  /\.local$/i,
];

function parseConfig(identity: ResolvedIdentity): SmtpConfig {
  const { secrets } = identity;

  const host = (secrets.host ?? "").trim();
  const user = (secrets.user ?? "").trim();
  const pass = secrets.pass ?? "";

  if (!host) throw new TransportError("smtp", "SMTP host is missing");
  if (!user) throw new TransportError("smtp", "SMTP username is missing");
  if (!pass) throw new TransportError("smtp", "SMTP password is missing");

  // The escape hatch is for a deployment whose mail server genuinely is on the
  // same private network, and for local development. It must stay off on a
  // multi-tenant deployment, where the host comes from whoever signed up.
  const allowPrivate = process.env.SMTP_ALLOW_PRIVATE_HOSTS === "true";

  if (!allowPrivate && BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    throw new TransportError("smtp", `${host} is not a reachable mail server`);
  }

  const port = Number(secrets.port ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TransportError("smtp", `${secrets.port} is not a valid port`);
  }

  // 465 is implicit TLS. Everything else starts plaintext and upgrades with
  // STARTTLS, which nodemailer does on its own when the server offers it.
  const secure = secrets.secure !== undefined ? secrets.secure === "true" : port === 465;

  return { host, port, secure, user, pass };
}

export function createSmtpTransport(identity: ResolvedIdentity): Transport {
  const config = parseConfig(identity);

  // Pooled with a single connection: the drain sends sequentially and spaced
  // out, and opening a fresh connection per message is what makes a mail
  // server start refusing them.
  const transporter: Transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    pool: true,
    maxConnections: 1,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  const from = identity.fromName
    ? `${identity.fromName} <${identity.fromEmail}>`
    : identity.fromEmail;

  return {
    kind: "smtp",
    from: { email: identity.fromEmail, name: identity.fromName },

    async send(message: OutboundMessage): Promise<SentMessage> {
      try {
        const info = await transporter.sendMail({
          from,
          to:      message.to,
          subject: message.subject,
          html:    message.html,
          ...(message.text ? { text: message.text } : {}),
          ...(message.replyTo ?? identity.replyTo
            ? { replyTo: message.replyTo ?? identity.replyTo ?? undefined }
            : {}),
          ...(message.headers ? { headers: message.headers } : {}),
        });

        if (!info.messageId) {
          throw new TransportError("smtp", "The mail server accepted the message without an id");
        }

        // Angle brackets are part of the Message-ID header, not of the id.
        return { providerId: info.messageId.replace(/^<|>$/g, "") };
      } catch (err) {
        if (err instanceof TransportError) throw err;
        throw new TransportError("smtp", describe(err));
      }
    },

    async verify(): Promise<void> {
      try {
        await transporter.verify();
      } catch (err) {
        throw new TransportError("smtp", describe(err));
      }
    },

    async close(): Promise<void> {
      transporter.close();
    },
  };
}

// Nodemailer's errors carry the useful part in a code rather than the message,
// and "Invalid login" on its own tells the user nothing about what to fix.
function describe(err: unknown): string {
  const error = err as { code?: string; responseCode?: number; message?: string };

  const HINTS: Record<string, string> = {
    EAUTH:      "The mail server rejected those credentials. For Gmail this needs an app password rather than your account password.",
    ECONNECTION: "Could not reach the mail server. Check the host and port.",
    ETIMEDOUT:  "The mail server did not respond in time.",
    ESOCKET:    "The connection failed. If the port is 465 the connection must be TLS, otherwise try 587.",
    EENVELOPE:  "The mail server rejected the sender or recipient address.",
    EMESSAGE:   "The mail server rejected the message itself.",
  };

  const hint = error.code ? HINTS[error.code] : undefined;
  const detail = error.message ?? "SMTP send failed";

  return hint ? `${hint} (${detail})` : detail;
}
