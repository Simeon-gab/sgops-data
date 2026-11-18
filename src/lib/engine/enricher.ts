import type {
  CleanBusinessRecord,
  SocialProfile,
  Competitor,
  LeadResearch,
  ResearchFact,
} from "@/lib/utils/types";

// Enrichment is the research step: it reads a business's own website and a few
// search results, and records what it found.
//
// Everything it reports ends up quoted to the business in a cold email, so the
// rule here is that a finding needs proof. Each one is stored as a fact with the
// page it was seen on and the exact text or link that shows it. Three things
// follow from that rule and are easy to undo by accident:
//
//   1. A website that could not be read is "unknown", never "has nothing".
//      A timeout used to come back as "no video, no blog, minimal site", which
//      then went into emails as an observation about the business.
//   2. A search result only counts when it is demonstrably theirs. An ad on a
//      search for their name is usually a competitor's, and the first Instagram
//      result is often another business with a similar name.
//   3. Patterns are matched against the text a visitor can read, not the raw
//      HTML, where "jobs" and "careers" turn up inside scripts and trackers.

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
  // Null only for leads enriched before evidence was recorded.
  research: LeadResearch | null;
}

export interface EnricherOptions {
  serpApiKey?: string;
  competitors?: Competitor[];
}

// ── Patterns ──────────────────────────────────────────────────────────────────

const VIDEO_PATTERNS: [label: string, re: RegExp][] = [
  ["HTML video player", /<video[\s>]/i],
  ["YouTube embed", /youtube(?:-nocookie)?\.com\/embed\//i],
  ["Vimeo embed", /player\.vimeo\.com/i],
  ["YouTube link", /youtu\.be\//i],
  ["Vimeo embed", /vimeo\.com\/video\//i],
  ["Wistia embed", /wistia\.com\/medias\//i],
  ["Brightcove player", /brightcove\.net/i],
];

const SOCIAL_PATTERNS: {
  platform: SocialProfile["platform"];
  re: RegExp;
  base: string;
}[] = [
  { platform: "instagram", re: /instagram\.com\/([A-Za-z0-9_.]+)/i, base: "https://instagram.com/" },
  { platform: "facebook",  re: /facebook\.com\/([A-Za-z0-9_.-]+)/i, base: "https://facebook.com/" },
  { platform: "tiktok",    re: /tiktok\.com\/@([A-Za-z0-9_.]+)/i, base: "https://tiktok.com/@" },
  { platform: "youtube",   re: /youtube\.com\/((?:channel\/|user\/|c\/|@)[A-Za-z0-9_.-]+)/i, base: "https://youtube.com/" },
  { platform: "linkedin",  re: /linkedin\.com\/company\/([A-Za-z0-9_-]+)/i, base: "https://linkedin.com/company/" },
];

// Path segments that follow a social domain without being anyone's profile:
// share dialogs, tracking pixels, post and hashtag pages.
const SOCIAL_SLUG_BLOCKLIST = new Set([
  "share", "intent", "sharer", "sharer.php", "login", "signup", "help",
  "about", "privacy", "legal", "ads", "pages", "tr", "plugins", "dialog",
  "p", "reel", "reels", "explore", "watch", "hashtag", "embed", "policies",
  "groups", "events", "stories", "accounts",
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

// Matched against visible text only. Each is a phrase a business writes about
// itself, so finding it on their own homepage is a statement they made.
const TEXT_SIGNALS: [key: string, statement: string, re: RegExp][] = [
  [
    "multiple_locations",
    "Their website refers to more than one location",
    /\b(?:our (?:locations|branches|outlets|stores)|find a (?:location|branch|store)|\d+ (?:locations|branches|outlets))\b/i,
  ],
  [
    "recently_opened",
    "Their website announces a recent opening",
    /\b(?:grand opening|newly opened|just opened|now open)\b/i,
  ],
  [
    "recently_renovated",
    "Their website mentions a renovation or new management",
    /\b(?:newly renovated|fresh (?:new )?look|under (?:new )?management)\b/i,
  ],
  [
    "award_winning",
    "Their website mentions an award or recognition",
    /\b(?:award[- ]winning|voted best|best of \d{4}|winner of)\b/i,
  ],
];

// A link to a careers page is the strongest hiring evidence a homepage offers.
const HIRING_HREF = /\/(?:careers?|jobs|vacanc(?:y|ies)|join-us|join-our-team|work-with-us|recruitment)(?:[/?.]|$)/i;
const HIRING_LINK_TEXT = /^(?:careers?|jobs|vacancies|we(?:'| a)re hiring|join our team|work with us|current openings)$/i;
const HIRING_TEXT = /\b(?:we(?:'| a)re hiring|now hiring|join our team|current vacancies|open positions)\b/i;

// "Established 1998", "Since 1998", "Founded in 1998". A copyright year is
// deliberately not accepted: it is the year the footer was last touched, which
// is usually this year, and it used to be reported as the age of the business.
const FOUNDED = /\b(?:est(?:ablished)?\.?|since|founded)\s*(?:in\s*)?(\d{4})\b/i;

// Below this much readable text the page is a shell that draws itself with
// scripts we do not run, so an empty scan says nothing about the business.
const MIN_READABLE_CHARS = 200;
const MAX_HTML_CHARS = 1_500_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function withTimeout(url: string, ms = 7_000, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function normalizeUrl(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return "https://" + raw;
}

// Hostname without the www, or null when the input is not a URL at all.
function hostOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(normalizeUrl(raw.trim())).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameSite(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith("." + b) || b.endsWith("." + a);
}

// What a visitor would read: no scripts, styles, markup or comments.
export function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(?:#39|#x27|apos|rsquo|lsquo);/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// The matched phrase with a little of what surrounds it, as proof.
function snippet(text: string, index: number, length: number, pad = 50): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  return (
    (start > 0 ? "..." : "") +
    text.slice(start, end).trim() +
    (end < text.length ? "..." : "")
  );
}

interface PageLink {
  href: string;
  text: string;
}

function extractLinks(html: string): PageLink[] {
  const links: PageLink[] = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && links.length < 2_000) {
    links.push({ href: m[1].trim(), text: visibleText(m[2]) });
  }
  return links;
}

function resolveHref(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function socialSlug(url: string, re: RegExp): string | null {
  const m = url.match(re);
  if (!m) return null;
  const slug = m[1].replace(/[/\s]+$/, "");
  const first = slug.split("/")[0].toLowerCase();
  if (!slug || slug.length < 2 || SOCIAL_SLUG_BLOCKLIST.has(first)) return null;
  return slug;
}

function detectQuality(html: string): "modern" | "outdated" | "minimal" {
  if (html.length < 3_000) return "minimal";
  if (MODERN_SIGNALS.some((p) => p.test(html))) return "modern";
  if (OUTDATED_SIGNALS.some((p) => p.test(html))) return "outdated";
  return "minimal";
}

// ── Name matching ─────────────────────────────────────────────────────────────
// A search for "Mama's Kitchen Lagos instagram" returns somebody's Instagram.
// It is only theirs if the profile is recognisably named after the business.

const NAME_STOPWORDS = new Set([
  "the", "and", "ltd", "limited", "inc", "llc", "plc", "company", "nigeria",
  "enterprises", "ventures", "services", "group", "international", "global",
]);

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function nameMatches(businessName: string, candidate: string): boolean {
  const haystack = compact(candidate);
  if (!haystack) return false;

  const tokens = businessName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !NAME_STOPWORDS.has(t));

  // A name with nothing distinctive in it ("The Co") cannot be verified by
  // name: "theco" sits inside "thecoffeecompany". Not matching loses a profile
  // now and then; matching attaches a stranger's.
  if (tokens.length === 0) return false;

  // The first three distinctive words carry the identity. All must be present.
  return tokens.slice(0, 3).every((t) => haystack.includes(t));
}

// ── Website scan ──────────────────────────────────────────────────────────────

interface WebsiteScan {
  read: boolean;
  has_video_content: boolean;
  has_blog: boolean;
  website_quality: "modern" | "outdated" | "minimal" | null;
  social_profiles: SocialProfile[];
  years_in_business: number | null;
  business_signals: string[];
  facts: ResearchFact[];
}

const UNREAD: WebsiteScan = {
  read: false,
  has_video_content: false,
  has_blog: false,
  website_quality: null,
  social_profiles: [],
  years_in_business: null,
  business_signals: [],
  facts: [],
};

async function scanWebsite(rawUrl: string): Promise<WebsiteScan> {
  const requested = normalizeUrl(rawUrl);

  let html = "";
  let pageUrl = requested;
  try {
    const res = await withTimeout(requested, 7_000, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; SgOpsData/1.0; business research)",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return UNREAD;
    html = (await res.text()).slice(0, MAX_HTML_CHARS);
    if (res.url) pageUrl = res.url;
  } catch {
    return UNREAD;
  }
  if (!html) return UNREAD;

  const text = visibleText(html);
  const links = extractLinks(html);
  const facts: ResearchFact[] = [];
  const signals: string[] = [];
  const fact = (key: string, statement: string, evidence: string, source = pageUrl) =>
    facts.push({ key, statement, source_url: source, evidence });

  // Video. Found in the markup, so it holds even on a page with little text.
  const video = VIDEO_PATTERNS.find(([, re]) => re.test(html));
  if (video) fact("video", "Their website has video on the homepage", video[0]);

  // Social profiles they link to themselves. That link is the proof of
  // ownership, which a search result on its own never is.
  const socials: SocialProfile[] = [];
  for (const { platform, re, base } of SOCIAL_PATTERNS) {
    for (const link of links) {
      const slug = socialSlug(link.href, re);
      if (!slug) continue;
      const url = base + slug;
      socials.push({ platform, url, followers: null, posts_per_week: null });
      fact(`social:${platform}`, `Their website links to their ${platform} profile`, url);
      break;
    }
  }

  // Hiring: a careers link first, then an explicit sentence.
  const careers = links.find(
    (l) => HIRING_HREF.test(l.href) || HIRING_LINK_TEXT.test(l.text)
  );
  const hiringText = careers ? null : HIRING_TEXT.exec(text);
  if (careers) {
    signals.push("hiring");
    fact(
      "hiring",
      "Their website links to a careers or jobs page",
      `Link "${careers.text || "careers"}" to ${resolveHref(careers.href, pageUrl)}`
    );
  } else if (hiringText) {
    signals.push("hiring");
    fact(
      "hiring",
      "Their website says they are hiring",
      snippet(text, hiringText.index, hiringText[0].length)
    );
  }

  for (const [key, statement, re] of TEXT_SIGNALS) {
    const m = re.exec(text);
    if (!m) continue;
    signals.push(key);
    fact(key, statement, snippet(text, m.index, m[0].length));
  }

  // Founding year, only when they state it.
  let years: number | null = null;
  const founded = FOUNDED.exec(text);
  if (founded) {
    const thisYear = new Date().getFullYear();
    const y = parseInt(founded[1], 10);
    if (y >= 1800 && y <= thisYear) {
      years = thisYear - y;
      fact(
        "founded",
        `Their website says they have been operating since ${y}`,
        snippet(text, founded.index, founded[0].length)
      );
    }
  }

  const hasBlog = BLOG_PATTERNS.some((p) => p.test(html));
  if (hasBlog) fact("blog", "Their website has a blog or news section", "Blog link on the homepage");

  const read = text.length >= MIN_READABLE_CHARS;

  return {
    read,
    has_video_content: Boolean(video),
    has_blog: hasBlog,
    // A judgement about a page we could not read would be a guess.
    website_quality: read ? detectQuality(html) : null,
    social_profiles: socials,
    years_in_business: years,
    business_signals: signals,
    facts,
  };
}

// ── SerpAPI helpers ───────────────────────────────────────────────────────────

interface SerpAd {
  title?: string;
  link?: string;
  displayed_link?: string;
}

interface SerpOrganic {
  title?: string;
  link?: string;
}

interface SerpResponse {
  organic_results?: SerpOrganic[];
  ads?: SerpAd[];
}

async function serpSearch(query: string, num: number, key: string): Promise<SerpResponse> {
  const q = encodeURIComponent(query);
  const url = `https://serpapi.com/search.json?q=${q}&engine=google&num=${num}&api_key=${key}`;
  const res = await withTimeout(url, 5_000);
  if (!res.ok) return {};
  return res.json() as Promise<SerpResponse>;
}

// An ad only counts when it points at the business's own website. Ads shown on
// a search for a business's name are very often bought by its competitors, and
// counting those used to put "already spending on advertising" into emails to
// businesses that had never bought an ad.
async function checkGoogleAds(
  name: string,
  city: string,
  website: string | null,
  key: string
): Promise<ResearchFact | null> {
  const site = hostOf(website);
  if (!site) return null;

  try {
    const query = `${name} ${city}`;
    const data = await serpSearch(query, 5, key);
    const own = (data.ads ?? []).find(
      (ad) => sameSite(hostOf(ad.link), site) || sameSite(hostOf(ad.displayed_link), site)
    );
    if (!own) return null;

    return {
      key: "google_ads",
      statement: "They are running a Google search ad for their own website",
      source_url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      evidence: `Ad "${own.title ?? site}" pointing to ${site}`,
    };
  } catch {
    return null;
  }
}

// Platforms whose presence implies the business already produces video content
// (YouTube and TikTok are video-native; Instagram is video-heavy via Reels).
const VIDEO_SOCIAL_PLATFORMS: SocialProfile["platform"][] = ["youtube", "tiktok", "instagram"];

// Every platform we attempt to discover via Google search during enrichment.
const SEARCHABLE_PLATFORMS: SocialProfile["platform"][] = [
  "instagram", "facebook", "tiktok", "youtube", "linkedin",
];

function hasVideoSignal(socials: SocialProfile[]): boolean {
  return socials.some((s) => VIDEO_SOCIAL_PLATFORMS.includes(s.platform));
}

// Search Google for a business's profile on one platform. A result is accepted
// only when the profile handle or the result title carries the business name.
async function searchSocialProfile(
  name: string,
  city: string,
  platform: SocialProfile["platform"],
  key: string
): Promise<{ profile: SocialProfile; fact: ResearchFact } | null> {
  try {
    const data = await serpSearch(`${name} ${city} ${platform}`, 4, key);
    const pattern = SOCIAL_PATTERNS.find((p) => p.platform === platform);
    if (!pattern) return null;

    for (const result of data.organic_results?.slice(0, 4) ?? []) {
      if (!result.link) continue;
      const slug = socialSlug(result.link, pattern.re);
      if (!slug) continue;
      if (!nameMatches(name, `${slug} ${result.title ?? ""}`)) continue;

      return {
        profile: { platform, url: result.link, followers: null, posts_per_week: null },
        fact: {
          key: `social:${platform}`,
          statement: `A ${platform} profile carrying their name was found by search`,
          source_url: result.link,
          evidence: result.title?.trim() || slug,
        },
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Main enricher ─────────────────────────────────────────────────────────────

export async function enrichLead(
  record: CleanBusinessRecord,
  options: EnricherOptions = {}
): Promise<EnrichmentResult> {
  const url = record.website.url;

  const [scan, adFact] = await Promise.all([
    url ? scanWebsite(url) : Promise.resolve(null),
    options.serpApiKey
      ? checkGoogleAds(record.name, record.address.city, url, options.serpApiKey)
      : Promise.resolve(null),
  ]);

  // Secondary social detection: search Google for every platform not already
  // linked on the website. This catches businesses whose social presence lives
  // off-site (e.g. an active Instagram but a minimal website).
  // Skipped gracefully when no SerpAPI key is configured.
  let searched: { profile: SocialProfile; fact: ResearchFact }[] = [];
  if (options.serpApiKey) {
    const foundPlatforms = new Set((scan?.social_profiles ?? []).map((p) => p.platform));
    const missing = SEARCHABLE_PLATFORMS.filter((p) => !foundPlatforms.has(p));
    if (missing.length > 0) {
      const found = await Promise.all(
        missing.map((p) =>
          searchSocialProfile(record.name, record.address.city, p, options.serpApiKey!)
        )
      );
      searched = found.filter((r): r is NonNullable<typeof r> => r !== null);
    }
  }

  const socialProfiles = [
    ...(scan?.social_profiles ?? []),
    ...searched.map((s) => s.profile),
  ];

  const research: LeadResearch = {
    website_read: scan?.read ?? false,
    checked_at: new Date().toISOString(),
    facts: [
      ...(scan?.facts ?? []),
      ...searched.map((s) => s.fact),
      ...(adFact ? [adFact] : []),
    ],
  };

  return {
    // Video is present if detected on the website OR the business is on a
    // video-native platform (YouTube/TikTok/Instagram). Prevents falsely
    // reporting "no video content" for businesses whose video lives on social.
    has_video_content:   (scan?.has_video_content ?? false) || hasVideoSignal(socialProfiles),
    has_blog:            scan?.has_blog           ?? false,
    website_quality:     scan?.website_quality    ?? null,
    social_profiles:     socialProfiles,
    runs_google_ads:     adFact !== null,
    runs_meta_ads:       false,
    competitors:         options.competitors       ?? [],
    years_in_business:   scan?.years_in_business  ?? null,
    estimated_employees: null,
    business_signals:    scan?.business_signals   ?? [],
    research,
  };
}

// True when a website exists but could not be read, which makes every "they do
// not have X" finding unknown rather than confirmed. Shared by scoring and by
// the outreach prompts so the two can never disagree about it.
export function siteUnverified(
  websiteUrl: string | null,
  research: LeadResearch | null
): boolean {
  return Boolean(websiteUrl) && research !== null && !research.website_read;
}
