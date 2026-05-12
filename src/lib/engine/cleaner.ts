import { createHash } from "crypto";
import {
  parsePhoneNumber,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";
import type { CleanBusinessRecord, DataQuality, RawBusinessRecord } from "@/lib/utils/types";

// ── Phone normalization ───────────────────────────────────────────────────────

interface PhoneResult {
  raw: string;
  formatted: string;
  country_code: string;
  is_valid: boolean;
}

function normalizePhone(raw: string, countryCode: string): PhoneResult {
  const empty: PhoneResult = { raw: raw ?? "", formatted: raw ?? "", country_code: "", is_valid: false };
  if (!raw?.trim()) return empty;

  try {
    const cc = countryCode.toUpperCase() as CountryCode;

    if (isValidPhoneNumber(raw, cc)) {
      const parsed = parsePhoneNumber(raw, cc);
      return {
        raw,
        formatted: parsed.formatInternational(),
        country_code: "+" + parsed.countryCallingCode,
        is_valid: true,
      };
    }

    // Already has international prefix
    if (raw.startsWith("+") && isValidPhoneNumber(raw)) {
      const parsed = parsePhoneNumber(raw);
      return {
        raw,
        formatted: parsed.formatInternational(),
        country_code: "+" + parsed.countryCallingCode,
        is_valid: true,
      };
    }
  } catch {
    // fall through
  }
  return empty;
}

// ── Address parsing ───────────────────────────────────────────────────────────

interface AddressResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  country_code: string;
  full: string;
}

function extractZip(address: string): string {
  const m = address.match(/\b\d{4,6}\b/);
  return m ? m[0] : "";
}

function parseAddress(
  raw: string,
  knownCity: string,
  knownState: string,
  knownCountry: string,
  knownCountryCode: string
): AddressResult {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  // First part is usually the street; city/state/country are known from the search
  const street = parts.length > 0 ? parts[0] : "";
  const zip = extractZip(raw);

  return {
    street,
    city: knownCity,
    state: knownState,
    zip,
    country: knownCountry,
    country_code: knownCountryCode,
    full: raw,
  };
}

// ── Duplicate hash ────────────────────────────────────────────────────────────

function generateDuplicateHash(name: string, city: string, state: string): string {
  const key = [
    name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    city.toLowerCase().replace(/[^a-z0-9]/g, ""),
    state.toLowerCase().replace(/[^a-z0-9]/g, ""),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

// ── Quality scoring ───────────────────────────────────────────────────────────

function scoreQuality(
  phone: PhoneResult,
  email: CleanBusinessRecord["email"],
  website: CleanBusinessRecord["website"],
  reviewCount: number,
  rating: number | null
): { quality: DataQuality; issues: string[] } {
  const issues: string[] = [];

  if (!email.address) issues.push("missing_email");
  if (!website.url) issues.push("no_website");
  if (!phone.raw) issues.push("missing_phone");
  else if (!phone.is_valid) issues.push("invalid_phone");
  if (rating === null) issues.push("no_rating");
  if (reviewCount < 10) issues.push("low_reviews");

  let quality: DataQuality;
  if (phone.is_valid && website.url && email.address && reviewCount >= 20) {
    quality = "verified";
  } else if (phone.is_valid || website.url || email.address) {
    quality = "partial";
  } else {
    quality = "unverified";
  }

  return { quality, issues };
}

// ── Email heuristic from website ──────────────────────────────────────────────
// In Phase 1 we don't scrape websites. Mock data has pre-generated emails;
// for real records we look for a mailto in the website domain only.

function guessEmailFromWebsite(
  websiteUrl: string | null,
  existingEmail: string | null
): CleanBusinessRecord["email"] {
  if (existingEmail) {
    return {
      address: existingEmail,
      source: "pattern" as const,
      is_verified: false,
      confidence: 40,
    };
  }
  if (websiteUrl) {
    // Generate a guessed info@ address — marked unverified, low confidence
    const domain = websiteUrl.replace(/https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0];
    return {
      address: `info@${domain}`,
      source: "pattern" as const,
      is_verified: false,
      confidence: 15,
    };
  }
  return { address: null, source: null, is_verified: false, confidence: 0 };
}

// ── Website inference ─────────────────────────────────────────────────────────
// We don't make HEAD requests in Phase 1. We infer is_active and has_ssl
// from the URL structure.

function inferWebsite(url: string | null): CleanBusinessRecord["website"] {
  if (!url) return { url: null, is_active: false, has_ssl: false };
  const hasSSL = url.startsWith("https://");
  return { url, is_active: true, has_ssl: hasSSL };
}

// ── Title-case normalization ──────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Main cleaner ──────────────────────────────────────────────────────────────

interface CleanerContext {
  city: string;
  state: string;
  country: string;
  country_code: string;
}

export function cleanBusinessRecords(
  raw: RawBusinessRecord[],
  ctx: CleanerContext
): CleanBusinessRecord[] {
  const seen = new Map<string, CleanBusinessRecord>();

  for (const record of raw) {
    const name = toTitleCase(record.name.trim());
    if (!name) continue;

    const address = parseAddress(
      record.address_raw,
      ctx.city,
      ctx.state,
      ctx.country,
      ctx.country_code
    );

    const phone = normalizePhone(record.phone_raw ?? "", ctx.country_code);

    const website = inferWebsite(record.website);

    // For mock records the email is encoded in the raw website; for real records we guess
    const emailRaw = record.source === "mock"
      ? (record as unknown as { email_raw?: string }).email_raw ?? null
      : null;
    const email = guessEmailFromWebsite(record.website, emailRaw);

    const hash = generateDuplicateHash(name, ctx.city, ctx.state);

    const { quality, issues } = scoreQuality(
      phone,
      email,
      website,
      record.review_count ?? 0,
      record.rating
    );

    const cleaned: CleanBusinessRecord = {
      source: record.source,
      name,
      address,
      phone,
      email,
      website,
      rating: record.rating,
      review_count: record.review_count ?? 0,
      category: record.category,
      place_id: record.place_id,
      coordinates:
        record.latitude != null && record.longitude != null
          ? { lat: record.latitude, lng: record.longitude }
          : null,
      data_quality: quality,
      quality_issues: issues,
      duplicate_hash: hash,
    };

    // Deduplication: keep record with more data (higher review count wins)
    const existing = seen.get(hash);
    if (!existing || (cleaned.review_count ?? 0) > (existing.review_count ?? 0)) {
      seen.set(hash, cleaned);
    }
  }

  return Array.from(seen.values());
}
