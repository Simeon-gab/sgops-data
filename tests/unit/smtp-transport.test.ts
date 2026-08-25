import { test } from "node:test";
import assert from "node:assert/strict";
import { createSmtpTransport } from "@/lib/sending/transports/smtp";
import type { ResolvedIdentity } from "@/lib/sending/types";
import { startSmtpServer } from "../helpers/smtp-server";

// The SMTP transport, driven against a mail server over a real socket rather
// than a mock, so the protocol conversation itself is under test.

function identity(port: number, over: Record<string, string> = {}): ResolvedIdentity {
  return {
    id: "test", kind: "smtp",
    fromEmail: "mary@test.invalid", fromName: "Mary Test", replyTo: null,
    secrets: { host: "127.0.0.1", port: String(port), user: "mary", pass: "secret", ...over },
  };
}

// ── Host guard ───────────────────────────────────────────────────────────────

test("refuses hosts that are not reachable mail servers", () => {
  // On a multi-tenant deployment the host comes from whoever signed up, so an
  // arbitrary one turns the sender into a way to reach internal services.
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "";

  for (const host of [
    "127.0.0.1", "localhost", "0.0.0.0", "10.0.0.5", "192.168.1.1",
    "172.16.0.1", "169.254.169.254", "mail.internal", "printer.local",
  ]) {
    assert.throws(
      () => createSmtpTransport(identity(25, { host })),
      new RegExp(host.replace(/\./g, "\\.")),
      `${host} should be refused`
    );
  }
});

test("allows a public mail host", () => {
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "";
  assert.doesNotThrow(() => createSmtpTransport(identity(587, { host: "smtp.gmail.com" })));
});

test("the escape hatch reopens private hosts for local development", () => {
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "true";
  assert.doesNotThrow(() => createSmtpTransport(identity(587, { host: "127.0.0.1" })));
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "";
});

test("incomplete or nonsensical credentials are refused up front", () => {
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "";
  const base = { host: "smtp.gmail.com" };

  assert.throws(() => createSmtpTransport(identity(587, { ...base, host: "" })), /host/i);
  assert.throws(() => createSmtpTransport(identity(587, { ...base, user: "" })), /username/i);
  assert.throws(() => createSmtpTransport(identity(587, { ...base, pass: "" })), /password/i);
  assert.throws(() => createSmtpTransport(identity(587, { ...base, port: "99999" })), /port/i);
  assert.throws(() => createSmtpTransport(identity(587, { ...base, port: "0" })), /port/i);
});

// ── A real conversation ──────────────────────────────────────────────────────

test("sends over the wire, and reports what the server assigned", async (t) => {
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "true";
  const server = await startSmtpServer();
  const transport = createSmtpTransport(identity(server.port));

  t.after(async () => {
    await transport.close?.();
    await server.stop();
    process.env.SMTP_ALLOW_PRIVATE_HOSTS = "";
  });

  await transport.verify?.();

  const sent = await transport.send({
    to: "hr@hospital.invalid",
    subject: "Application: Medical Laboratory Scientist",
    html: "<p>Hello</p>",
    headers: { "List-Unsubscribe": "<https://example.invalid/u?r=1>" },
  });

  assert.ok(sent.providerId.length > 0);
  // The angle brackets belong to the Message-ID header, not to the id.
  assert.doesNotMatch(sent.providerId, /^<|>$/);

  // A second message over the same pooled connection, which is how the drain
  // uses it. Opening a fresh connection per message is what makes a mail
  // server start refusing them.
  await transport.send({ to: "second@hospital.invalid", subject: "Second", html: "<p>Two</p>" });

  assert.equal(server.received.length, 2);
  assert.match(server.received[0], /Mary Test/);
  assert.match(server.received[0], /mary@test\.invalid/);
  assert.match(server.received[0], /Application: Medical Laboratory Scientist/);
  assert.match(server.received[0], /List-Unsubscribe/);
  assert.match(server.received[1], /second@hospital\.invalid/);
});

test("reply-to is set when the identity carries one", async (t) => {
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "true";
  const server = await startSmtpServer();
  const transport = createSmtpTransport({
    ...identity(server.port),
    replyTo: "replies@test.invalid",
  });

  t.after(async () => {
    await transport.close?.();
    await server.stop();
    process.env.SMTP_ALLOW_PRIVATE_HOSTS = "";
  });

  await transport.send({ to: "hr@hospital.invalid", subject: "x", html: "<p>x</p>" });
  assert.match(server.received[0], /replies@test\.invalid/);
});

// ── Failure ──────────────────────────────────────────────────────────────────

test("rejected credentials fail loudly, and explain the likely fix", async (t) => {
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "true";
  const server = await startSmtpServer({ rejectAuth: true });
  const transport = createSmtpTransport(identity(server.port));

  t.after(async () => {
    await transport.close?.();
    await server.stop();
    process.env.SMTP_ALLOW_PRIVATE_HOSTS = "";
  });

  // "Invalid login" on its own tells nobody that Gmail wants an app password.
  await assert.rejects(() => transport.verify!(), /app password/i);
  await assert.rejects(
    () => transport.send({ to: "hr@hospital.invalid", subject: "x", html: "<p>x</p>" }),
    /app password/i
  );

  assert.equal(server.received.length, 0, "nothing may be delivered");
});
