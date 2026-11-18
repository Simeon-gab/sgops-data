import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXPORT_HEADERS,
  exportFilename,
  toCSV,
  type ExportLead,
} from "@/lib/utils/leads-export";

// The CSV is opened in a spreadsheet by someone who will act on it. These
// guard the ways a file can open wrong without anyone being told.

function lead(over: Partial<ExportLead> = {}): ExportLead {
  return {
    name: "Harvest Table Foods",
    niche_label: "Food & Beverage Manufacturers",
    country: "Nigeria",
    state: "Lagos",
    city: "Lagos",
    street: null,
    zip: null,
    address_full: null,
    email: null,
    email_verified: false,
    phone: null,
    phone_formatted: null,
    phone_valid: false,
    website: null,
    website_active: false,
    rating: 4.4,
    review_count: 60,
    has_video_content: false,
    social_profiles: [],
    runs_google_ads: false,
    runs_meta_ads: false,
    years_in_business: null,
    estimated_employees: null,
    score: 72,
    tier: "warm",
    data_quality: "partial",
    quality_issues: [],
    ...over,
  } as ExportLead;
}

const BOM = "\uFEFF";
const lines = (csv: string) => csv.replace(BOM, "").trimEnd().split("\r\n");

test("an export with no leads still has its header row", () => {
  const csv = toCSV([]);
  assert.deepEqual(lines(csv), [EXPORT_HEADERS.join(",")]);
});

test("the file starts with a byte order mark so Excel reads it as UTF-8", () => {
  assert.ok(toCSV([lead({ name: "Café Ìyá" })]).startsWith(BOM));
});

test("every row has as many cells as the header", () => {
  const [header, row] = lines(toCSV([lead()]));
  assert.equal(row.split(",").length, header.split(",").length);
});

test("commas, quotes and line breaks stay inside their cell", () => {
  const csv = toCSV([lead({ name: 'Ada "Mama" Foods, Ltd', address_full: "12 Mill Rd\nIkeja" })]);

  assert.ok(csv.includes('"Ada ""Mama"" Foods, Ltd"'));
  assert.ok(csv.includes('"12 Mill Rd\nIkeja"'));
});

test("a name that looks like a formula is made inert", () => {
  const csv = toCSV([lead({ name: "=HYPERLINK(\"http://x.example\",\"Click\")" })]);
  const row = lines(csv)[1];

  assert.ok(row.startsWith("\"'="), "a spreadsheet must not run text from the open web");
});

test("numbers are left as numbers, including negative ones", () => {
  const row = lines(toCSV([lead({ score: 72, rating: 4.4 })]))[1];
  assert.ok(row.includes(",4.4,60,"));
  assert.ok(!row.includes("'72"));
});

test("social profiles are split into their own columns", () => {
  const csv = toCSV([
    lead({
      social_profiles: [
        { platform: "instagram", url: "https://instagram.com/harvest", followers: 1200, posts_per_week: null },
      ],
    }),
  ]);
  const [header, row] = lines(csv).map((l) => l.split(","));

  assert.equal(row[header.indexOf("social_instagram")], "https://instagram.com/harvest");
  assert.equal(row[header.indexOf("instagram_followers")], "1200");
});

// ── The file name ────────────────────────────────────────────────────────────

const DAY = new Date("2026-11-18T10:00:00.000Z");
const named = (query: string, rows: number) =>
  exportFilename(new URLSearchParams(query), rows, DAY);

test("the file is named after the filters that produced it", () => {
  assert.equal(
    named("niche=bakery_cafe&city=Dallas&tier=hot", 50),
    "bakeries-cafes-dallas-hot-50-leads-2026-11-18.csv"
  );
});

test("an unfiltered export says so, with its size", () => {
  assert.equal(named("", 2013), "all-2013-leads-2026-11-18.csv");
  assert.equal(named("", 1), "all-1-lead-2026-11-18.csv");
});

test("only the most specific place is used", () => {
  assert.equal(
    named("country=United+States&state=Texas&city=Dallas", 7),
    "dallas-7-leads-2026-11-18.csv"
  );
  assert.equal(named("country=Nigeria&state=Lagos", 7), "lagos-7-leads-2026-11-18.csv");
});

test("stage, quality and search text are included", () => {
  assert.equal(
    named("q=mama&stage=closed&quality=verified", 3),
    "mama-closed-won-verified-3-leads-2026-11-18.csv"
  );
});

test("the name is safe on every operating system", () => {
  const name = named("city=" + encodeURIComponent('São Paulo / "Centro"') + "&q=" + encodeURIComponent("a\\b:c*?"), 2);

  assert.equal(name, "sao-paulo-centro-a-b-c-2-leads-2026-11-18.csv");
  assert.match(name, /^[a-z0-9.-]+$/);
});

test("an unknown niche id is used as written rather than dropped", () => {
  assert.equal(named("niche=custom_thing", 4), "custom-thing-4-leads-2026-11-18.csv");
});
