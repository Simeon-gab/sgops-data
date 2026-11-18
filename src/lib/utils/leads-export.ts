import type { Lead, CleanedExportRecord } from "./types";

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
  return "﻿" + lines.join("\r\n") + "\r\n";
}
