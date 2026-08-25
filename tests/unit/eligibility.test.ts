import { test } from "node:test";
import assert from "node:assert/strict";
import { screen, screenAddress } from "@/lib/campaigns/eligibility";
import type { Lead } from "@/lib/utils/types";

// Who is safe to mail. These rules are the last thing standing between a
// scraped address and a sending domain's reputation.

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    name: "Bella Trattoria",
    email: "hello@bella.example",
    email_status: "verified",
    city: "Lagos",
    custom_fields: {},
    ...over,
  } as unknown as Lead;
}

const open = { allowGuessed: false, suppressed: new Set<string>() };

test("a verified address passes", () => {
  const result = screenAddress(lead(), open);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.email, "hello@bella.example");
});

test("the address is lowercased, so suppression matching is case-insensitive", () => {
  const result = screenAddress(lead({ email: "Hello@Bella.Example" }), open);
  assert.equal(result.ok && result.email, "hello@bella.example");
});

test("no address at all is skipped", () => {
  const result = screenAddress(lead({ email: null }), open);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, "no_email");
});

test("an address confirmed not to exist is skipped", () => {
  const result = screenAddress(lead({ email_status: "invalid" }), open);
  assert.equal(!result.ok && result.reason, "invalid_email");
});

test("a guessed address is skipped unless the campaign opts in", () => {
  const guessed = lead({ email_status: "guessed" });

  const refused = screenAddress(guessed, open);
  assert.equal(!refused.ok && refused.reason, "guessed_email");

  const allowed = screenAddress(guessed, { ...open, allowGuessed: true });
  assert.equal(allowed.ok, true);
});

test("a suppressed address is skipped even when it is otherwise perfect", () => {
  const suppressed = new Set(["hello@bella.example"]);
  const result = screenAddress(lead(), { allowGuessed: true, suppressed });
  assert.equal(!result.ok && result.reason, "suppressed");
});

// ── Full screen, templates included ──────────────────────────────────────────

test("renders the message when everything resolves", () => {
  const result = screen(lead(), "Hi {{name}}", "About {{city}}.", open);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.message.subject, "Hi Bella Trattoria");
  assert.equal(result.ok && result.message.body, "About Lagos.");
});

test("a placeholder this lead cannot fill skips the lead, and says which", () => {
  const result = screen(lead(), "Hi {{name}}", "About {{industry_award}}.", open);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, "unresolved_fields");
  assert.equal(!result.ok && result.detail, "industry_award");
});

test("an unresolved field in the subject counts too", () => {
  const result = screen(lead(), "Hi {{nope}}", "Body", open);
  assert.equal(!result.ok && result.reason, "unresolved_fields");
});

test("a fallback rescues a lead that would otherwise be skipped", () => {
  const result = screen(lead({ city: null as never }), "Hi", "About {{city|your area}}.", open);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.message.body, "About your area.");
});

test("a message that renders to nothing is refused", () => {
  const result = screen(lead(), "   ", "Body", open);
  assert.equal(!result.ok && result.reason, "empty_body");
});

test("the address is checked before the templates are", () => {
  // A lead with no address and a broken template reports the address, which is
  // the more useful of the two.
  const result = screen(lead({ email: null }), "Hi {{nope}}", "{{alsonope}}", open);
  assert.equal(!result.ok && result.reason, "no_email");
});

test("the subject is trimmed but the body keeps its shape", () => {
  const result = screen(lead(), "  Hi {{name}}  ", "Line one\n\nLine two", open);
  assert.equal(result.ok && result.message.subject, "Hi Bella Trattoria");
  assert.equal(result.ok && result.message.body, "Line one\n\nLine two");
});
