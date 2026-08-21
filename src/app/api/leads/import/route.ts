import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { NICHES } from "@/lib/utils/constants";
import { isNonBusinessEmail } from "@/lib/utils/email-domains";
import type { Lead, LeadImportRow, LeadImportResponse, ApiError } from "@/lib/utils/types";

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_ROWS = 5_000;

// PostgREST caps a response at 1000 rows, and a very long `in` list bloats the
// URL, so existing-email lookups are batched.
const EMAIL_LOOKUP_CHUNK = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface RequestBody {
  rows: LeadImportRow[];
  niche_id?: string;
}

// Same hash formula as the cleaner engine so imported leads dedupe against
// prospected leads in future searches (name + city + state).
function duplicateHash(name: string, city: string, state: string): string {
  const key = [
    name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    city.toLowerCase().replace(/[^a-z0-9]/g, ""),
    state.toLowerCase().replace(/[^a-z0-9]/g, ""),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

function normalizeWebsite(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// ── POST /api/leads/import ────────────────────────────────────────────────────
// Body: { rows: [{ name, email, phone?, website?, country?, state?, city?, notes? }], niche_id? }
// Validates emails, dedupes within the file and against existing workspace
// leads by email, then inserts the rest as leads with source "csv_import".

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json<ApiError>(
      { error: "No rows provided", code: "bad_request" },
      { status: 400 }
    );
  }

  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json<ApiError>(
      { error: `Too many rows (max ${MAX_ROWS} per import)`, code: "too_many_rows" },
      { status: 400 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  // ── 1. Validate rows and dedupe within the file ────────────────────────────

  let invalidSkipped = 0;
  let blockedSkipped = 0;
  const seenEmails = new Set<string>();
  const validRows: (LeadImportRow & { email: string })[] = [];

  for (const row of body.rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      invalidSkipped++;
      continue;
    }
    // Social pages, link aggregators, and free mailbox providers are not
    // business inboxes. Importing them just seeds a future bounce.
    if (isNonBusinessEmail(email)) {
      blockedSkipped++;
      continue;
    }
    if (seenEmails.has(email)) {
      invalidSkipped++;
      continue;
    }
    seenEmails.add(email);
    validRows.push({ ...row, email });
  }

  if (validRows.length === 0) {
    return NextResponse.json<ApiError>(
      { error: "No rows with a usable business email address found", code: "no_valid_rows" },
      { status: 400 }
    );
  }

  // ── 2. Dedupe against existing workspace leads by email ───────────────────
  // Query only the addresses in this file. Fetching every existing email
  // silently truncates at PostgREST's 1000-row cap, so past a thousand leads
  // the dedupe check would start missing real duplicates.

  const existingEmails = new Set<string>();
  const emailList = validRows.map((r) => r.email);

  for (let i = 0; i < emailList.length; i += EMAIL_LOOKUP_CHUNK) {
    const chunk = emailList.slice(i, i + EMAIL_LOOKUP_CHUNK);
    const { data: existingRaw, error: existingError } = await supabase
      .from("leads")
      .select("email")
      .eq("workspace_id", workspace.id)
      .in("email", chunk);

    if (existingError) {
      return NextResponse.json<ApiError>(
        { error: existingError.message, code: "db_error" },
        { status: 500 }
      );
    }

    for (const l of (existingRaw ?? []) as { email: string | null }[]) {
      const normalized = l.email?.trim().toLowerCase();
      if (normalized) existingEmails.add(normalized);
    }
  }

  const newRows = validRows.filter((r) => !existingEmails.has(r.email));
  const duplicatesSkipped = validRows.length - newRows.length;

  const customFieldKeys = Array.from(
    new Set(newRows.flatMap((r) => Object.keys(r.custom_fields ?? {})))
  ).sort();

  if (newRows.length === 0) {
    return NextResponse.json<LeadImportResponse>({
      imported: 0,
      duplicates_skipped: duplicatesSkipped,
      invalid_skipped: invalidSkipped,
      blocked_skipped: blockedSkipped,
      custom_fields: [],
      leads: [],
    });
  }

  // ── 3. Insert as leads ─────────────────────────────────────────────────────

  const niche = NICHES.find((n) => n.id === body.niche_id);
  const nicheId = niche?.id ?? "csv_import";
  const nicheLabel = niche?.label ?? "Imported";

  const now = new Date().toISOString();

  const inserts = newRows.map((row) => {
    // Fall back to the email prefix so the lead always has a display name
    const name = row.name?.trim() || row.email.split("@")[0];
    const country = row.country?.trim() ?? "";
    const state = row.state?.trim() ?? "";
    const city = row.city?.trim() ?? "";
    const phone = row.phone?.trim() || null;

    return {
      workspace_id: workspace.id,
      name,
      niche_id: nicheId,
      niche_label: nicheLabel,
      place_id: null,
      country,
      country_code: null,
      state,
      city,
      street: null,
      zip: null,
      address_full: [city, state, country].filter(Boolean).join(", ") || null,
      latitude: null,
      longitude: null,
      email: row.email,
      email_verified: false,
      email_confidence: null,
      email_source: "csv_import",
      // The user supplied it, we did not derive it, but nothing has confirmed
      // it exists either. Verification upgrades this to "verified".
      email_status: "unknown",
      custom_fields: row.custom_fields ?? {},
      phone,
      phone_formatted: null,
      phone_valid: false,
      website: normalizeWebsite(row.website),
      website_active: false,
      website_has_ssl: false,
      rating: null,
      review_count: 0,
      data_quality: "unverified",
      quality_issues: [],
      duplicate_hash: duplicateHash(name, city, state),
      stage: "new",
      source: "csv_import",
      score: 0,
      // Not enriched yet: digital-presence signals are unknown, not confirmed absent
      tier: "unscored",
      extracted_at: now,
      has_video_content: false,
      has_blog: false,
      website_quality: null,
      social_profiles: [],
      runs_google_ads: false,
      runs_meta_ads: false,
      competitors: [],
      business_signals: [],
      score_breakdown: [],
      notes: row.notes?.trim() ?? "",
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from("leads")
    .insert(inserts)
    .select();

  if (insertError) {
    return NextResponse.json<ApiError>(
      { error: insertError.message, code: "insert_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json<LeadImportResponse>({
    imported: inserted?.length ?? 0,
    duplicates_skipped: duplicatesSkipped,
    invalid_skipped: invalidSkipped,
    blocked_skipped: blockedSkipped,
    custom_fields: customFieldKeys,
    leads: (inserted as Lead[]) ?? [],
  });
}
