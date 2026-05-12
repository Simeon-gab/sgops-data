import type { CleanBusinessRecord, SocialProfile, Competitor } from "@/lib/utils/types";

export interface EnrichmentResult {
  has_video_content: boolean;
  has_blog: boolean;
  website_quality: "modern" | "outdated" | "minimal" | null;
  social_profiles: SocialProfile[];
  runs_google_ads: boolean;
  runs_meta_ads: boolean;
  competitors: Competitor[];
  years_in_business: number | null;
  estimated_employees: number | null;
  business_signals: string[];
}

export interface EnricherOptions {
  serpApiKey?: string;
  competitors?: Competitor[];
}

// ── Patterns ──────────────────────────────────────────────────────────────────

const VIDEO_PATTERNS = [
  /<video[\s>]/i,
  /youtube\.com\/embed\//i,
  /player\.vimeo\.com/i,
  /youtu\.be\//i,
  /vimeo\.com\/video\//i,
  /wistia\.com\/medias\//i,
  /brightcove\.net/i,
];

const SOCIAL_PATTERNS: {
  platform: SocialProfile["platform"];
  re: RegExp;
  base: string;
}[] = [
  { platform: "instagram", re: /instagram\.com\/([A-Za-z0-9_.]+)/i, base: "https://instagram.com/" },
  { platform: "facebook",  re: /facebook\.com\/([A-Za-z0-9_./-]+)/i, base: "https://facebook.com/" },
  { platform: "tiktok",    re: /tiktok\.com\/@([A-Za-z0-9_.]+)/i, base: "https://tiktok.com/@" },
  { platform: "youtube",   re: /youtube\.com\/(?:channel|user|c|@)([A-Za-z0-9_.-]+)/i, base: "https://youtube.com/" },
  { platform: "linkedin",  re: /linkedin\.com\/company\/([A-Za-z0-9_-]+)/i, base: "https://linkedin.com/company/" },
];

// Tokens that appear in the social URL path but are not real profile slugs
const SOCIAL_SLUG_BLOCKLIST = new Set([
  "share", "intent", "sharer", "login", "signup", "help",
  "about", "privacy", "legal", "ads", "pages",
]);

const MODERN_SIGNALS = [/__next/i, /data-reactroot/i, /_nuxt/i, /gatsby/i, /tailwind/i, /data-vue/i];
const OUTDATED_SIGNALS = [
  /jquery[-/]1\.[0-9]/i, /jquery[-/]2\.[0-9]/i,
  /<table[^>]+width=["']?\d+%/i,
  /bgcolor=["']?#[0-9a-f]+/i,
];

const BLOG_PATTERNS = [
  /href=["'][^"']*\/(?:blog|news|articles|updates|journal|insights)\//i,
  /href=["'][^"']*\/blog["']/i,
];

const BUSINESS_SIGNAL_PATTERNS: [string, RegExp][] = [
  ["hiring",            /\b(?:careers?|jobs?|we.?re hiring|join our team|now hiring)\b/i],
  ["multiple_locations",/\b(?:multiple locations?|our (?:locations?|branches)|find a location)\b/i],
  ["recently_opened",   /\b(?:grand opening|newly opened|just opened|coming soon)\b/i],
  ["recently_renovated",/\b(?:newly renovated|fresh (?:new )?look|under (?:new )?management)\b/i],
  ["award_winning",     /\b(?:award.winning|voted best|best of \d{4}|#1 in)\b/i],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout(url: string, ms = 7_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function normalizeUrl(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return "https://" + raw;
}

function detectVideo(html: string): boolean {
  return VIDEO_PATTERNS.some((p) => p.test(html));
}

function detectBlog(html: string): boolean {
  return BLOG_PATTERNS.some((p) => p.test(html));
}

function detectQuality(html: string): "modern" | "outdated" | "minimal" {
  if (html.length < 3_000) return "minimal";
  if (MODERN_SIGNALS.some((p) => p.test(html))) return "modern";
  if (OUTDATED_SIGNALS.some((p) => p.test(html))) return "outdated";
  return "minimal";
}

function extractSocials(html: string): SocialProfile[] {
  const profiles: SocialProfile[] = [];
  for (const { platform, re, base } of SOCIAL_PATTERNS) {
    const m = html.match(re);
    if (!m) continue;
    const slug = m[1].replace(/[/\s]+$/, "");
    if (!slug || slug.length < 2 || SOCIAL_SLUG_BLOCKLIST.has(slug.toLowerCase())) continue;
    profiles.push({ platform, url: base + slug, followers: null, posts_per_week: null });
  }
  return profiles;
}

function extractYears(html: string): number | null {
  const year = new Date().getFullYear();
  const estMatch = html.match(
    /(?:est(?:ablished)?\.?\s*(?:in\s*)?|since\s+|founded\s*(?:in\s*)?)(\d{4})/i
  );
  if (estMatch) {
    const y = parseInt(estMatch[1], 10);
    if (y >= 1900 && y <= year) return year - y;
  }
  const copyMatch = html.match(/©\s*(\d{4})/);
  if (copyMatch) {
    const y = parseInt(copyMatch[1], 10);
    if (y >= 1990 && y <= year) return year - y;
  }
  return null;
}

function extractSignals(html: string): string[] {
  return BUSINESS_SIGNAL_PATTERNS.filter(([, re]) => re.test(html)).map(([label]) => label);
}

// ── Website scan ──────────────────────────────────────────────────────────────

interface WebsiteScan {
  has_video_content: boolean;
  has_blog: boolean;
  website_quality: "modern" | "outdated" | "minimal";
  social_profiles: SocialProfile[];
  years_in_business: number | null;
  business_signals: string[];
}

async function scanWebsite(rawUrl: string): Promise<WebsiteScan> {
  const empty: WebsiteScan = {
    has_video_content: false,
    has_blog: false,
    website_quality: "minimal",
    social_profiles: [],
    years_in_business: null,
    business_signals: [],
  };

  let html = "";
  try {
    const res = await withTimeout(normalizeUrl(rawUrl));
    if (res.ok) html = await res.text();
  } catch {
    return empty;
  }
  if (!html) return empty;

  return {
    has_video_content: detectVideo(html),
    has_blog: detectBlog(html),
    website_quality: detectQuality(html),
    social_profiles: extractSocials(html),
    years_in_business: extractYears(html),
    business_signals: extractSignals(html),
  };
}

// ── Google Ads check via SerpAPI ──────────────────────────────────────────────

async function checkGoogleAds(name: string, city: string, key: string): Promise<boolean> {
  try {
    const q = encodeURIComponent(`${name} ${city}`);
    const url = `https://serpapi.com/search.json?q=${q}&engine=google&num=5&api_key=${key}`;
    const res = await withTimeout(url, 5_000);
    if (!res.ok) return false;
    const data = (await res.json()) as { ads?: unknown[] };
    return Array.isArray(data.ads) && data.ads.length > 0;
  } catch {
    return false;
  }
}

// ── Main enricher ─────────────────────────────────────────────────────────────

export async function enrichLead(
  record: CleanBusinessRecord,
  options: EnricherOptions = {}
): Promise<EnrichmentResult> {
  const url = record.website.url;

  const [scan, googleAds] = await Promise.all([
    url ? scanWebsite(url) : Promise.resolve(null),
    url && options.serpApiKey
      ? checkGoogleAds(record.name, record.address.city, options.serpApiKey)
      : Promise.resolve(false),
  ]);

  return {
    has_video_content:  scan?.has_video_content  ?? false,
    has_blog:           scan?.has_blog           ?? false,
    website_quality:    url ? (scan?.website_quality ?? "minimal") : null,
    social_profiles:    scan?.social_profiles    ?? [],
    runs_google_ads:    googleAds,
    runs_meta_ads:      false, // Requires Facebook Marketing API — deferred
    competitors:        options.competitors       ?? [],
    years_in_business:  scan?.years_in_business  ?? null,
    estimated_employees: null, // Requires LinkedIn/data-provider API — deferred
    business_signals:   scan?.business_signals   ?? [],
  };
}
