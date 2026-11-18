import { test } from "node:test";
import assert from "node:assert/strict";
import { lintColdEmail, openingSentence, stripEmDashes } from "@/lib/ai/email-lint";

// The first line of a cold email is the only one most recipients read, and it
// is also the inbox preview. These guard against spending it on the sender.

const GOOD = `Hi Harvest Table Foods team,

Your website links to a careers page with three production roles open.

Hiring at that pace usually means the line is running ahead of the people on it.

I schedule and train shift teams for food plants, and have done it for four years at a 400-person site.

Would it be worth a short conversation about your openings?

Ada Obi, Production Supervisor`;

test("an email that opens on the recipient passes clean", () => {
  assert.deepEqual(lintColdEmail("Your production roles", GOOD), []);
});

test("the opening sentence is the one after the greeting", () => {
  assert.equal(
    openingSentence(GOOD),
    "Your website links to a careers page with three production roles open."
  );
  assert.equal(openingSentence("My name is Ada. I make things."), "My name is Ada.");
});

test("openers about the sender are caught", () => {
  const openers = [
    "My name is Ada and I run a studio.",
    "I am a video producer based in Lagos.",
    "I'm reaching out because I saw your page.",
    "I hope this email finds you well.",
    "I wanted to introduce our agency.",
    "I came across your business on Google.",
    "We are a leading packaging supplier.",
    "Sorry to bother you, I know you are busy.",
  ];

  for (const opener of openers) {
    const issues = lintColdEmail("Your packaging", `Hi team,\n\n${opener}\n\nWorth a chat?`);
    assert.ok(
      issues.some((i) => i.includes("filler")),
      `"${opener}" should be rejected as a filler opening`
    );
  }
});

test("a sentence about the recipient is not mistaken for filler", () => {
  const openers = [
    "Your bakery has 240 Google reviews and a 4.7 rating.",
    "This is the season most breweries in Lagos run short on bottling capacity.",
    "Harvest Table has been operating since 1998.",
  ];

  for (const opener of openers) {
    const issues = lintColdEmail("Your bakery", `Hi team,\n\n${opener}\n\nWorth a chat?`);
    assert.deepEqual(issues, [], `"${opener}" is a fine way to open`);
  }
});

test("a long body, a long subject and a buzzword are each reported", () => {
  const long = `Hi team,\n\n${"Your plant runs two shifts. ".repeat(40)}\n\nWorth a chat?`;

  assert.ok(lintColdEmail("Your plant", long).some((i) => /words/.test(i)));
  assert.ok(
    lintColdEmail("A much longer subject line than anyone will read", GOOD).some((i) =>
      /subject/i.test(i)
    )
  );
  assert.ok(
    lintColdEmail("Your plant", GOOD.replace("schedule", "leverage")).some((i) =>
      /buzzword/.test(i)
    )
  );
  assert.ok(lintColdEmail("Quick question!", GOOD).some((i) => /mass email/.test(i)));
});

test("an unfilled placeholder is caught before it reaches anyone", () => {
  const issues = lintColdEmail("Your plant", GOOD.replace("Ada Obi", "[Your Name]"));
  assert.ok(issues.some((i) => /placeholder/.test(i)));
});

test("em dashes are removed, whatever spacing they came with", () => {
  assert.equal(stripEmDashes("Fast — and cheap"), "Fast, and cheap");
  assert.equal(stripEmDashes("Fast—and cheap"), "Fast, and cheap");
  assert.equal(stripEmDashes("No dashes here"), "No dashes here");
});
