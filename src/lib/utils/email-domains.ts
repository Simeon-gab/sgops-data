// Domains that must never have a business address guessed from them.
//
// Google Places frequently returns a social profile, link aggregator, or site
// builder page as a business "website". Deriving info@<domain> from that
// produces addresses like info@instagram.com, which belong to someone else
// entirely. Mailing them generates complaints against the sender's domain, so
// this list is the difference between a usable list and a blacklisting.

const SOCIAL_AND_MESSAGING = [
  "instagram.com", "facebook.com", "fb.com", "m.facebook.com", "fb.me",
  "twitter.com", "x.com", "tiktok.com", "youtube.com", "youtu.be",
  "linkedin.com", "pinterest.com", "snapchat.com", "threads.net",
  "wa.me", "whatsapp.com", "api.whatsapp.com", "t.me", "m.me", "telegram.me",
];

const LINK_AGGREGATORS = [
  "linktr.ee", "beacons.ai", "taplink.cc", "solo.to", "campsite.bio",
  "about.me", "carrd.co", "msha.ke", "linkin.bio", "bio.link", "lnk.bio",
];

const SITE_BUILDERS_AND_HOSTS = [
  "sites.google.com", "business.site", "google.com", "maps.google.com",
  "wixsite.com", "wix.com", "wordpress.com", "blogspot.com", "weebly.com",
  "godaddysites.com", "webflow.io", "netlify.app", "vercel.app", "github.io",
  "shopify.com", "myshopify.com", "square.site", "squareup.com", "bigcartel.com",
];

const DIRECTORIES_AND_MARKETPLACES = [
  "yelp.com", "tripadvisor.com", "booking.com", "opentable.com", "zomato.com",
  "ubereats.com", "doordash.com", "toasttab.com", "chownow.com", "grubhub.com",
  "glovoapp.com", "jumia.com.ng", "konga.com", "etsy.com", "amazon.com",
  "ebay.com", "alibaba.com", "yellowpages.com", "trustpilot.com",
];

const SHORTENERS_AND_TOOLS = [
  "bit.ly", "goo.gl", "tinyurl.com", "rebrand.ly", "cutt.ly",
  "medium.com", "substack.com", "calendly.com", "zoom.us", "eventbrite.com",
];

// A free mailbox provider is never a business domain. info@gmail.com is not a
// real inbox, it is a guess that will hard bounce.
const FREE_MAILBOX_PROVIDERS = [
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "protonmail.com", "proton.me", "mail.com", "yandex.com", "gmx.com",
  "zoho.com", "tutanota.com", "fastmail.com",
];

export const NON_BUSINESS_DOMAINS = new Set<string>([
  ...SOCIAL_AND_MESSAGING,
  ...LINK_AGGREGATORS,
  ...SITE_BUILDERS_AND_HOSTS,
  ...DIRECTORIES_AND_MARKETPLACES,
  ...SHORTENERS_AND_TOOLS,
  ...FREE_MAILBOX_PROVIDERS,
]);

// Extracts the registrable-ish host from a URL or bare domain, lowercased and
// stripped of protocol, credentials, "www.", port, path, query, and fragment.
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;

  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  host = host.split("/")[0].split("?")[0].split("#")[0];
  host = host.split("@").pop() ?? host;
  host = host.split(":")[0];
  host = host.replace(/^www\./, "");

  if (!host || !host.includes(".")) return null;
  return host;
}

// True when an address must not be guessed from this domain. Checks the domain
// itself and its parent, so shop.instagram.com is caught alongside instagram.com.
export function isNonBusinessDomain(domain: string | null | undefined): boolean {
  const host = extractDomain(domain);
  if (!host) return true;
  if (NON_BUSINESS_DOMAINS.has(host)) return true;

  const parts = host.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (NON_BUSINESS_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

// True when a full email address sits on a domain we refuse to derive from.
export function isNonBusinessEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return true;
  return isNonBusinessDomain(email.split("@").pop());
}
