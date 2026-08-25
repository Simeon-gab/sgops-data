import { test } from "node:test";
import assert from "node:assert/strict";
import { availableFields, fieldsUsed, mergeContext, render } from "@/lib/utils/merge-fields";
import type { Lead } from "@/lib/utils/types";

// Merge fields decide who gets mailed and who gets skipped, so the rules here
// are the difference between a personalised email and "Hi ," sent five hundred
// times.

function lead(over: Partial<Lead> = {}): Lead {
  return {
    name: "Bella Trattoria",
    email: "hello@bella.example",
    phone: "+2348012345678",
    phone_formatted: "0801 234 5678",
    website: "https://bella.example",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    niche_label: "Restaurants",
    rating: 4.5,
    review_count: 120,
    custom_fields: {},
    ...over,
  } as unknown as Lead;
}

test("fills built-in fields from the lead", () => {
  const result = render("{{name}} in {{city}}, {{country}}", lead());
  assert.equal(result.text, "Bella Trattoria in Lagos, Nigeria");
  assert.deepEqual(result.unresolved, []);
});

test("company falls back to the business name", () => {
  assert.equal(render("{{company}}", lead()).text, "Bella Trattoria");
  assert.equal(
    render("{{company}}", lead({ custom_fields: { company: "Bella Group" } })).text,
    "Bella Group"
  );
});

test("location joins the parts that exist", () => {
  assert.equal(render("{{location}}", lead()).text, "Lagos, Lagos");
  assert.equal(render("{{location}}", lead({ state: "" as never })).text, "Lagos");
});

test("an empty field with no fallback is reported rather than silently blanked", () => {
  // This is the whole point: the campaign layer skips the recipient instead of
  // mailing them a sentence with a hole in it.
  const result = render("Hi {{first_name}}, about {{missing_thing}}", lead({ name: "" as never }));
  assert.deepEqual(result.unresolved.sort(), ["first_name", "missing_thing"]);
});

test("a fallback resolves the field and clears the report", () => {
  const result = render("Hi {{first_name|there}},", lead({ name: "" as never }));
  assert.equal(result.text, "Hi there,");
  assert.deepEqual(result.unresolved, []);
});

test("an empty fallback is still a fallback", () => {
  const result = render("Hello{{suffix|}}", lead());
  assert.equal(result.text, "Hello");
  assert.deepEqual(result.unresolved, []);
});

test("each unresolved field is reported once, however often it appears", () => {
  const result = render("{{nope}} {{nope}} {{nope}}", lead());
  assert.deepEqual(result.unresolved, ["nope"]);
});

test("field names are matched loosely", () => {
  const withCustom = lead({ custom_fields: { "Contact Name": "Ada", "job-title": "Owner" } });
  assert.equal(render("{{contact_name}} the {{job_title}}", withCustom).text, "Ada the Owner");
  // Whitespace and case inside the braces are tolerated too.
  assert.equal(render("{{ CITY }}", lead()).text, "Lagos");
});

test("built-in fields win over a custom column of the same name", () => {
  // A CSV column called "city" must not quietly override the cleaned address.
  const context = mergeContext(lead({ custom_fields: { city: "Wrong Town" } }));
  assert.equal(context.city, "Lagos");
});

test("numbers are rendered as text", () => {
  assert.equal(render("{{rating}} from {{review_count}}", lead()).text, "4.5 from 120");
});

test("a lead with no rating leaves it unresolved rather than printing null", () => {
  const result = render("{{rating}}", lead({ rating: null }));
  assert.deepEqual(result.unresolved, ["rating"]);
  assert.equal(result.text, "");
});

test("fieldsUsed lists placeholders whether or not they resolve", () => {
  assert.deepEqual(
    fieldsUsed("{{name}} {{nope}} {{first_name|there}}").sort(),
    ["first_name", "name", "nope"]
  );
});

test("availableFields includes custom columns, for showing the user their options", () => {
  const fields = availableFields(lead({ custom_fields: { "Contact Name": "Ada" } }));
  assert.ok(fields.includes("contact_name"));
  assert.ok(fields.includes("city"));
  // Sorted, because it is rendered as a list of chips.
  assert.deepEqual(fields, [...fields].sort());
});

test("text with no placeholders passes through untouched", () => {
  const result = render("Plain text, no fields.", lead());
  assert.equal(result.text, "Plain text, no fields.");
  assert.deepEqual(result.unresolved, []);
});
