import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Credentials are encrypted here, in the application, before they are ever
// handed to Postgres. A database backup, a leaked connection string or a
// misconfigured policy therefore yields ciphertext rather than a working
// mailbox password.
//
// AES-256-GCM: authenticated, so a tampered value fails to decrypt instead of
// silently producing garbage that gets sent to a mail server.

const VERSION = "v1";

// Only needed once a workspace stores credentials of its own. Identities that
// send through the platform's account carry no secrets, so a deployment that
// has not reached that point does not need this set.
function key(): Buffer {
  const raw = process.env.SENDING_SECRET_KEY;

  if (!raw) {
    throw new Error(
      "SENDING_SECRET_KEY is not set. It is required to store sending credentials. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  const parsed = /^[0-9a-fA-F]{64}$/.test(raw.trim())
    ? Buffer.from(raw.trim(), "hex")
    : Buffer.from(raw, "base64");

  if (parsed.length !== 32) {
    throw new Error(
      "SENDING_SECRET_KEY must be 32 bytes: 64 hex characters, or base64 of 32 bytes."
    );
  }

  return parsed;
}

export function isEncryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecrets(secrets: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptSecrets(payload: string | null): Record<string, string> {
  if (!payload) return {};

  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Stored credentials are not in a format this version understands");
  }

  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as Record<string, string>;
}
