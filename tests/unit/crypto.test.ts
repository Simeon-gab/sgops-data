import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { decryptSecrets, encryptSecrets, isEncryptionConfigured } from "@/lib/sending/crypto";

// The key is read on every call rather than at import, so setting it here
// covers every test below, and individual tests can change it back and forth.
process.env.SENDING_SECRET_KEY = randomBytes(32).toString("hex");

// Mailbox credentials. These are encrypted in the application so that a
// database backup or a leaked connection string yields ciphertext rather than
// a working password.

const secrets = { host: "smtp.example.com", port: "587", user: "mary", pass: "hunter2" };

test("round-trips", () => {
  assert.deepEqual(decryptSecrets(encryptSecrets(secrets)), secrets);
});

test("the ciphertext carries a version and none of the plaintext", () => {
  const sealed = encryptSecrets(secrets);
  assert.ok(sealed.startsWith("v1."));
  assert.ok(!sealed.includes("hunter2"));
  assert.ok(!sealed.includes("smtp.example.com"));
});

test("the same input encrypts differently every time", () => {
  // A fresh IV per call, so identical credentials are not identifiable as
  // identical by looking at the column.
  assert.notEqual(encryptSecrets(secrets), encryptSecrets(secrets));
});

test("no stored credentials decrypts to nothing, rather than throwing", () => {
  // An identity that sends through the platform has no secrets of its own.
  assert.deepEqual(decryptSecrets(null), {});
  assert.deepEqual(decryptSecrets(""), {});
});

test("a tampered ciphertext is rejected", () => {
  // GCM is authenticated, so a flipped byte fails rather than decrypting to
  // garbage that then gets sent to a mail server.
  const [version, iv, tag, body] = encryptSecrets(secrets).split(".");
  const flipped = Buffer.from(body, "base64");
  flipped[0] ^= 0xff;

  assert.throws(() => decryptSecrets([version, iv, tag, flipped.toString("base64")].join(".")));
});

test("a tampered auth tag is rejected", () => {
  const [version, iv, tag, body] = encryptSecrets(secrets).split(".");
  const flipped = Buffer.from(tag, "base64");
  flipped[0] ^= 0xff;

  assert.throws(() => decryptSecrets([version, iv, flipped.toString("base64"), body].join(".")));
});

test("a payload from another key is rejected", () => {
  const sealed = encryptSecrets(secrets);
  const original = process.env.SENDING_SECRET_KEY;

  process.env.SENDING_SECRET_KEY = randomBytes(32).toString("hex");
  assert.throws(() => decryptSecrets(sealed));

  process.env.SENDING_SECRET_KEY = original;
});

test("a malformed payload is rejected with a clear message", () => {
  assert.throws(() => decryptSecrets("not-a-payload"), /format/);
  assert.throws(() => decryptSecrets("v2.a.b.c"), /format/);
});

test("a missing key is reported rather than silently doing nothing", () => {
  const original = process.env.SENDING_SECRET_KEY;
  delete process.env.SENDING_SECRET_KEY;

  assert.equal(isEncryptionConfigured(), false);
  assert.throws(() => encryptSecrets(secrets), /SENDING_SECRET_KEY/);

  process.env.SENDING_SECRET_KEY = original;
  assert.equal(isEncryptionConfigured(), true);
});

test("a key of the wrong length is refused", () => {
  const original = process.env.SENDING_SECRET_KEY;

  process.env.SENDING_SECRET_KEY = "tooshort";
  assert.throws(() => encryptSecrets(secrets), /32 bytes/);

  process.env.SENDING_SECRET_KEY = original;
});

test("a base64 key works as well as hex", () => {
  const original = process.env.SENDING_SECRET_KEY;

  process.env.SENDING_SECRET_KEY = randomBytes(32).toString("base64");
  assert.deepEqual(decryptSecrets(encryptSecrets(secrets)), secrets);

  process.env.SENDING_SECRET_KEY = original;
});
