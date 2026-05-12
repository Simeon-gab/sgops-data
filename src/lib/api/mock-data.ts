import type { RawBusinessRecord } from "@/lib/utils/types";

// Simple PRNG seeded on index for deterministic output
function rand(seed: number): number {
  let s = (seed + 1) * 2654435761;
  s ^= s >>> 16;
  s *= 0x45d9f3b;
  s ^= s >>> 16;
  return (s >>> 0) / 4294967296;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(rand(seed) * arr.length)];
}

// ── Name templates per niche ──────────────────────────────────────────────────

const NICHE_NAMES: Record<string, string[]> = {
  restaurant: [
    "Kitchen", "Grill House", "Bistro", "Eatery", "Restaurant", "Dining",
    "Cuisine", "Food & Bar", "Garden Kitchen", "Table", "Spice Kitchen",
    "Golden Plate", "Local Bistro", "Prime Grill", "Heritage Kitchen",
    "Urban Eats", "Street Food Co", "Continental Grill", "Flavor House",
    "The Grand Table", "Classic Kitchen", "Savory House", "Blue Plate",
  ],
  hotel: [
    "Hotel", "Inn", "Suites", "Lodge", "Residences", "Resort", "Boutique Hotel",
    "Grand Hotel", "Palace Hotel", "Heritage Inn", "Executive Suites",
    "Premier Lodge", "Royal Suites", "Classic Hotel", "Garden Inn",
  ],
  salon: [
    "Hair Studio", "Beauty Bar", "Salon", "Hair & Beauty", "Style Studio",
    "Glam Studio", "Hair Works", "Beauty Lounge", "The Salon", "Cuts & Colors",
    "Elite Salon", "Modern Beauty", "Hair Boutique", "Luxe Salon",
  ],
  gym: [
    "Fitness Center", "Gym", "CrossFit", "Athletics Club", "Sports Center",
    "Fitness Studio", "Health Club", "Power Gym", "Elite Fitness", "Body Works",
    "Training Ground", "Peak Performance", "FitZone", "Iron Gym",
  ],
  dental: [
    "Dental Care", "Dental Clinic", "Dental Practice", "Smile Clinic",
    "Dental Studio", "Family Dentistry", "Dental Centre", "Bright Smile",
    "Smile First Dental", "Complete Dental Care", "Premier Dental",
  ],
  real_estate: [
    "Realty", "Properties", "Real Estate", "Homes", "Property Group",
    "Estate Agency", "Property Solutions", "Homes & Estates", "Prime Realty",
    "Elite Properties", "Urban Realty", "Premier Homes",
  ],
  law_firm: [
    "Law Offices", "Legal Services", "Attorneys at Law", "Law Group",
    "Legal Associates", "Chambers", "Law Practice", "Legal Solutions",
    "Barristers & Solicitors",
  ],
  auto_dealer: [
    "Auto Sales", "Motors", "Car Dealership", "Auto Centre", "Motor Group",
    "Cars & More", "Premier Auto", "Elite Motors", "City Auto",
  ],
  wedding_venue: [
    "Events Centre", "Wedding Venue", "Banquet Hall", "Event Hall",
    "Gardens", "Wedding Gardens", "Occasions Venue", "The Grand Ballroom",
    "Celebration Centre", "Heritage Hall",
  ],
  event_planner: [
    "Events", "Event Planning", "Events & Co", "Occasions", "Celebrations",
    "Event Solutions", "Premier Events", "Elite Events", "Creative Events",
  ],
  contractor: [
    "Construction", "Contractors", "Builders", "Construction Co",
    "Building Services", "Renovations", "Property Maintenance", "Build & Fix",
  ],
  retail: [
    "Store", "Shop", "Boutique", "Retail", "Emporium", "Market",
    "Fashion Store", "Style Boutique", "The Shop", "Goods & More",
  ],
  medical: [
    "Medical Clinic", "Health Centre", "Medical Centre", "Clinic",
    "Health Services", "Medical Practice", "Family Clinic", "HealthCare",
  ],
  nightclub: [
    "Lounge", "Bar & Grill", "Nightclub", "Bar", "Club", "The Bar",
    "Sky Lounge", "Rooftop Bar", "Cocktail Bar", "Entertainment Centre",
  ],
  photography: [
    "Photography", "Photo Studio", "Studios", "Photography Studio",
    "Creative Studios", "Image Studio", "Visual Studio", "Photo Works",
  ],
};

const OWNER_FIRST_NAMES = [
  "James", "Maria", "David", "Sarah", "Michael", "Jennifer", "Robert", "Patricia",
  "William", "Linda", "Richard", "Barbara", "Joseph", "Susan", "Thomas", "Jessica",
  "Charles", "Karen", "Christopher", "Nancy", "Emmanuel", "Fatima", "Chioma",
  "Kwame", "Adaora", "Amara", "Kofi", "Nkechi", "Tunde", "Blessing",
];

const STREET_NAMES = [
  "Main Street", "High Street", "Market Road", "Victoria Street", "Palm Avenue",
  "Church Road", "King Street", "Queen Street", "Park Lane", "Commercial Road",
  "Independence Avenue", "Central Avenue", "Beach Road", "Garden Close",
  "Hill Road", "Ring Road", "Airport Road", "Marina Drive", "Estate Drive",
  "Boulevard", "Industrial Road", "Freedom Avenue", "Heritage Road",
];

const NICHE_CATEGORIES: Record<string, string> = {
  restaurant: "Restaurant",
  hotel: "Hotel",
  salon: "Hair & Beauty Salon",
  gym: "Gym / Fitness",
  dental: "Dental Clinic",
  real_estate: "Real Estate Agency",
  law_firm: "Law Firm",
  auto_dealer: "Car Dealership",
  wedding_venue: "Wedding Venue",
  event_planner: "Event Planning",
  contractor: "General Contractor",
  retail: "Retail Store",
  medical: "Medical Clinic",
  nightclub: "Bar & Nightclub",
  photography: "Photography Studio",
};

function buildBusinessName(nicheId: string, city: string, idx: number): string {
  const names = NICHE_NAMES[nicheId] ?? NICHE_NAMES.restaurant;
  const base = pick(names, idx * 3);
  const r = rand(idx * 7 + 11);

  if (r < 0.18) {
    // "{city} {suffix}"
    return `${city} ${base}`;
  }
  if (r < 0.32) {
    // "The {suffix}"
    return `The ${base}`;
  }
  if (r < 0.48) {
    // "{Owner}'s {suffix}"
    const owner = pick(OWNER_FIRST_NAMES, idx * 5 + 2);
    return `${owner}'s ${base}`;
  }
  if (r < 0.62) {
    // "Premier / Elite / Grand {suffix}"
    const adj = pick(["Premier", "Elite", "Grand", "Classic", "Modern", "Royal"], idx);
    return `${adj} ${base}`;
  }
  return base;
}

function generatePhone(countryCode: string, dialCode: string, seed: number): string {
  const a = Math.floor(rand(seed) * 899 + 100);
  const b = Math.floor(rand(seed + 1) * 8999 + 1000);
  const c = Math.floor(rand(seed + 2) * 8999 + 1000);

  switch (countryCode) {
    case "NG": {
      const prefixes = ["0803", "0806", "0816", "0703", "0905", "0809", "0702"];
      const p = pick(prefixes, seed);
      return `${dialCode} ${p.slice(1)} ${b}`;
    }
    case "GH": return `${dialCode} 2${a} ${b}`;
    case "ZA": return `${dialCode} ${a % 90 + 10} ${b}`;
    case "KE": return `${dialCode} 7${a % 10}${b}`;
    case "GB": return `${dialCode} 7${a} ${c}`;
    case "US":
    case "CA": return `${dialCode} (${a}) ${Math.floor(rand(seed + 3) * 899 + 100)}-${b % 10000}`;
    case "AU": return `${dialCode} 4${Math.floor(rand(seed + 4) * 9)} ${b}`;
    default:  return `${dialCode} ${a} ${b} ${c % 1000}`;
  }
}

function generateEmail(name: string, website: string | null, idx: number): string | null {
  if (!website) return null;
  if (rand(idx * 13 + 4) > 0.55) return null; // ~45% have email

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  const prefixes = ["info", "hello", "contact", "admin", "enquiries", "bookings"];
  const prefix = pick(prefixes, idx);
  const domain = website.replace(/https?:\/\/(www\.)?/, "").split("/")[0];
  return `${prefix}@${domain}`;
}

function generateWebsite(name: string, idx: number): string | null {
  if (rand(idx * 11 + 3) > 0.65) return null; // ~65% have website
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "");
  const tlds = [".com", ".co", ".net", ".org", ".biz"];
  const tld = pick(tlds, idx * 2);
  return `https://www.${slug}${tld}`;
}

function jitter(base: number, seed: number, range: number): number {
  return base + (rand(seed) - 0.5) * range;
}

export function generateMockBusinesses(
  nicheId: string,
  city: string,
  state: string,
  country: string,
  countryCode: string,
  dialCode: string,
  centerLat: number,
  centerLng: number,
  count: number
): RawBusinessRecord[] {
  const results: RawBusinessRecord[] = [];
  const category = NICHE_CATEGORIES[nicheId] ?? "Business";

  for (let i = 0; i < count; i++) {
    const name = buildBusinessName(nicheId, city, i);
    const streetNum = Math.floor(rand(i * 17) * 200) + 5;
    const street = pick(STREET_NAMES, i * 4);
    const addressRaw = `${streetNum} ${street}, ${city}, ${state}, ${country}`;

    const website = generateWebsite(name, i);
    const email = generateEmail(name, website, i);
    const phone = rand(i * 9 + 1) < 0.85 ? generatePhone(countryCode, dialCode, i * 23) : "";

    // Ratings: mostly 3.5-4.8, occasionally 5.0 or below 3.5
    const ratingRaw = rand(i * 6 + 1);
    const rating = ratingRaw < 0.05 ? null : Math.round((3.2 + ratingRaw * 1.8) * 10) / 10;

    // Review counts: log-normal distribution (5-600)
    const reviewBase = Math.floor(Math.exp(rand(i * 8 + 2) * 6.5));
    const reviewCount = Math.max(0, Math.min(600, reviewBase));

    results.push({
      source: "mock",
      name,
      address_raw: addressRaw,
      phone_raw: phone,
      website,
      rating,
      review_count: reviewCount,
      category,
      place_id: `mock_${countryCode.toLowerCase()}_${i}_${Date.now()}`,
      latitude: jitter(centerLat, i * 31, 0.05),
      longitude: jitter(centerLng, i * 37, 0.05),
      photos_count: Math.floor(rand(i * 19) * 12),
      extracted_at: new Date().toISOString(),
    });
  }

  return results;
}
