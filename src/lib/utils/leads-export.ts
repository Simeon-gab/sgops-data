import type { Lead, CleanedExportRecord } from "./types";
import { NICHES, PIPELINE_STAGES } from "./constants";

// Building the leads CSV. Pure, so it can be tested without a database.
//
// The export asks the database for these columns and no others. Selecting
// every column pulled each lead's research, score breakdown and competitors
// along too: about half of every response, none of it in the file, and enough
// to push a two-thousand-lead export past the time a request is allowed.

export const EXPORT_COLUMNS = [
  "name", "niche_label", "country", "state", "city", "street", "zip",
  "address_full", "email", "email_verified", "phone", "phone_formatted",
  "phone_valid", "website", "website_active", "rating", "review_count",
  "has_video_content", "social_profiles", "runs_google_ads", "runs_meta_ads",
  "years_in_business", "estimated_employees", "score", "tier", "data_quality",
  "quality_issues",
] as const satisfies readonly (keyof Lead)[];

export type ExportLead = Pick<Lead, (typeof EXPORT_COLUMNS)[number]>;

// Fixed, so a file with no rows still has its header line.
export const EXPORT_HEADERS: (keyof CleanedExportRecord)[] = [
  "business_name", "niche", "country", "state", "city", "street", "zip",
  "full_address", "email", "email_verified", "phone", "phone_valid", "website",
  "website_active", "google_rating", "google_reviews", "has_video",
  "social_instagram", "social_facebook", "social_tiktok", "instagram_followers",
  "runs_ads", "years_in_business", "estimated_employees", "lead_score",
  "lead_tier", "data_quality", "quality_issues",
];

export function toExportRecord(lead: ExportLead): CleanedExportRecord {
  const instagram = lead.social_profiles?.find((s) => s.platform === "instagram");
  const facebook  = lead.social_profiles?.find((s) => s.platform === "facebook");
  const tiktok    = lead.social_profiles?.find((s) => s.platform === "tiktok");

  return {
    business_name:      lead.name,
    niche:              lead.niche_label,
    country:            lead.country,
    state:              lead.state,
    city:               lead.city,
    street:             lead.street ?? "",
    zip:                lead.zip ?? "",
    full_address:       lead.address_full ?? "",
    email:              lead.email ?? "",
    email_verified:     lead.email_verified,
    phone:              lead.phone_formatted ?? lead.phone ?? "",
    phone_valid:        lead.phone_valid,
    website:            lead.website ?? "",
    website_active:     lead.website_active,
    google_rating:      lead.rating ?? 0,
    google_reviews:     lead.review_count,
    has_video:          lead.has_video_content,
    social_instagram:   instagram?.url ?? "",
    social_facebook:    facebook?.url ?? "",
    social_tiktok:      tiktok?.url ?? "",
    instagram_followers: instagram?.followers ?? 0,
    runs_ads:           lead.runs_google_ads || lead.runs_meta_ads,
    years_in_business:  lead.years_in_business ?? 0,
    estimated_employees: lead.estimated_employees ?? 0,
    lead_score:         lead.score,
    lead_tier:          lead.tier,
    data_quality:       lead.data_quality,
    quality_issues:     (lead.quality_issues ?? []).join("; "),
  };
}

function escapeCSV(val: unknown): string {
  let str = String(val ?? "");
  // A cell starting with one of these is run as a formula by Excel and Sheets.
  // Business names come from the open web, so they are made inert.
  if (/^[=+\-@\t\r]/.test(str) && typeof val === "string") str = "'" + str;
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCSV(leads: ExportLead[]): string {
  const lines = [EXPORT_HEADERS.join(",")];
  for (const lead of leads) {
    const record = toExportRecord(lead);
    lines.push(EXPORT_HEADERS.map((h) => escapeCSV(record[h])).join(","));
  }
  // The byte order mark is what makes Excel read the file as UTF-8. Without it
  // accented names and non-Latin scripts open as mojibake.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

// ── File name ────────────────────────────────────────────────────────────────
// Named after what is in it, so six exports in a downloads folder can be told
// apart without opening them: "bakeries-cafes-dallas-hot-50-leads-2026-11-18.csv"
// rather than six copies of "sgops-leads".
//
// The parts follow the filters that produced the file, in the order a person
// would say them: what, where, which ones, how many. The count is the number of
// rows actually in the file.

// Lowercase words joined by hyphens, safe on every operating system. Accents
// are folded to their base letter so the name survives a zip or an upload.
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function exportFilename(
  params: URLSearchParams,
  rowCount: number,
  now: Date = new Date()
): string {
  const get = (key: string) => params.get(key)?.trim() ?? "";

  const nicheId = get("niche");
  const niche = NICHES.find((n) => n.id === nicheId)?.label ?? nicheId;
  const stageId = get("stage");
  const stage = PIPELINE_STAGES.find((s) => s.id === stageId)?.label ?? stageId;
  // The most specific place named is enough: "dallas", not "dallas-texas-usa".
  const place = get("city") || get("state") || get("country");

  const parts = [niche, place, get("q"), get("tier"), stage, get("quality")]
    .map(slug)
    .filter(Boolean);

  const what = parts.length ? parts.join("-") : "all";
  const count = `${rowCount}-${rowCount === 1 ? "lead" : "leads"}`;
  const date = now.toISOString().slice(0, 10);

  return `${what}-${count}-${date}.csv`;
}
