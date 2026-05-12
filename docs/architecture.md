# Architecture — SgOps Data

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js)                      │
│  Dashboard │ Prospect │ Leads │ Pipeline │ Outreach │ Settings│
└─────────────────────────┬────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼────────────────────────────────────┐
│                     API LAYER (Next.js API Routes)            │
│                                                               │
│  /api/prospect    → Prospector Service                        │
│  /api/enrich      → Enricher Service                          │
│  /api/score       → Scorer Service                            │
│  /api/clean       → Cleaner Service                           │
│  /api/generate    → AI Generator Service                      │
│  /api/email/send  → Email Service                             │
│  /api/leads       → CRUD Operations                           │
│  /api/pipeline    → Stage Management                          │
│  /api/export      → CSV/PDF Export                            │
└───┬──────┬──────┬──────┬──────┬──────┬───────────────────────┘
    │      │      │      │      │      │
    ▼      ▼      ▼      ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│Google││Serp  ││Hunter││Claude││Resend││Supa  │
│Places││API   ││.io   ││API   ││API   ││base  │
└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘
```

## Data Flow: Prospect to Closed

```
INPUT                    PROCESS                    OUTPUT
─────                    ───────                    ──────

User selects:            1. EXTRACT                 Raw records
  niche                     Google Places API        (50-200 per query)
  country                   SerpAPI fallback
  state                     Directory scraping
  city                                    │
  result count                            ▼

                         2. CLEAN                   Clean records
                            Phone normalization      with quality score
                            Email validation
                            Deduplication
                            Dead site flagging
                            Address parsing
                                          │
                                          ▼

                         3. ENRICH                  Enriched profiles
                            Website content scan     with intelligence
                            Social media analysis
                            Ad spend detection
                            Competitor lookup
                            Video content check
                                          │
                                          ▼

                         4. SCORE                   Scored + ranked
                            Weighted formula         leads with tier
                            Tier assignment           (hot/warm/cold)
                            Priority ranking
                                          │
                                          ▼

                         5. STORE                   Leads in database
                            Supabase insert          with full profile
                            Workspace scoping
                            RLS enforcement
                                          │
                                          ▼

User clicks lead         6. GENERATE (on demand)   Outreach materials
                            Claude API               ready to send
                            Cold email
                            Call script
                            Follow-up sequence
                            Content plan
                                          │
                                          ▼

User sends email         7. DELIVER                Tracked outreach
                            Resend API
                            Open/click tracking
                            Auto stage update
                                          │
                                          ▼

                         8. PIPELINE               CRM tracking
                            Stage management         through to close
                            Notes
                            Activity log
```

## Service Layer Design

Each core operation is a standalone service in `/src/lib/engine/`. Services are pure functions that accept typed inputs and return typed outputs. They do not access the database directly. API routes orchestrate services and handle persistence.

### Prospector Service
```typescript
// Input
interface ProspectRequest {
  nicheId: string;
  country: string;
  state: string;
  city: string;
  resultCount: number; // 50, 100, 150, 200
}

// Output
interface RawBusinessRecord {
  source: "google_places" | "serpapi" | "directory";
  name: string;
  address_raw: string;
  phone_raw: string;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  category: string;
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  photos_count: number;
  extracted_at: string;
}
```

**Strategy:** Primary source is Google Places API (Text Search endpoint). If result count is under the requested amount, SerpAPI fills the gap with Google Maps results. For niches with strong directory presence (restaurants on Yelp, contractors on HomeAdvisor), a third pass hits those directories.

**Pagination:** Google Places returns 20 results per page with a `next_page_token`. The service auto-paginates up to the requested count. SerpAPI returns up to 120 results per query.

### Cleaner Service
```typescript
// Input: RawBusinessRecord[]
// Output: CleanBusinessRecord[]

interface CleanBusinessRecord {
  name: string;                    // Standardized casing, trimmed
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    country_code: string;          // ISO 3166-1 alpha-2
    full: string;                  // Formatted display string
  };
  phone: {
    raw: string;
    formatted: string;             // (XXX) XXX-XXXX or +XX XXX XXX XXXX
    country_code: string;
    is_valid: boolean;
  };
  email: {
    address: string | null;
    source: "website" | "directory" | "pattern" | null;
    is_verified: boolean;
    confidence: number;            // 0-100 from Hunter.io
  };
  website: {
    url: string | null;
    is_active: boolean;
    has_ssl: boolean;
  };
  rating: number | null;
  review_count: number;
  category: string;
  place_id: string | null;
  coordinates: { lat: number; lng: number } | null;
  data_quality: "verified" | "partial" | "unverified";
  quality_issues: string[];        // ["missing_email", "no_website", "low_reviews"]
  duplicate_hash: string;          // SHA256(lowercase(name) + city + state)
}
```

**Cleaning rules (in order):**
1. Trim whitespace, fix casing (title case for names, uppercase state abbreviations)
2. Parse address into structured fields using Google Geocoding or regex patterns
3. Normalize phone: detect country from address, format accordingly, validate digit count
4. Deduplicate by `duplicate_hash`, keep the record with more data
5. Check website: HEAD request, flag 4xx/5xx or parked page patterns
6. Validate email: syntax check, MX record lookup, Hunter.io verification if available
7. Assign quality score: verified (website active + reviews > 20), partial (some fields valid), unverified (minimal data)
8. Tag quality issues array for UI display

### Enricher Service
```typescript
interface EnrichedLead extends CleanBusinessRecord {
  enrichment: {
    has_video_content: boolean;     // Checked via website scan
    has_blog: boolean;
    website_quality: "modern" | "outdated" | "minimal" | null;
    social_profiles: {
      platform: string;            // "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin"
      url: string;
      followers: number | null;
      posts_per_week: number | null;
    }[];
    runs_google_ads: boolean;
    runs_meta_ads: boolean;
    competitors: {
      name: string;
      has_video: boolean;
      rating: number;
      review_count: number;
    }[];
    years_in_business: number | null;
    estimated_employees: number | null;
    business_signals: string[];    // ["recently_renovated", "multiple_locations", "hiring"]
  };
}
```

### Scorer Service
```typescript
interface ScoredLead extends EnrichedLead {
  score: number;                   // 0-100
  tier: "hot" | "warm" | "cold";
  score_breakdown: {
    signal: string;
    points: number;
    reason: string;
  }[];
}
```

Pure function. No external calls. Takes enriched data, applies weighted formula, returns scored lead.

### AI Generator Service
```typescript
interface GenerateRequest {
  lead: ScoredLead;
  type: "cold_email" | "call_script" | "follow_up_sequence" | "content_plan" | "proposal";
  agency_name: string;
  agency_portfolio_url?: string;
  tone?: "professional" | "casual" | "direct";
}

interface GenerateResponse {
  type: string;
  content: string | object;        // String for emails/scripts, object for structured plans
  tokens_used: number;
}
```

Uses Claude API with niche-specific playbook context injected into the system prompt. Each niche has a pre-built playbook (pain points, content angles, hooks, objection responses) stored in `/src/lib/utils/constants.ts`.

## Database Architecture

All data in Supabase PostgreSQL. See `data-model.md` for full schema.

Key tables:
- `workspaces` — multi-tenant isolation
- `leads` — core lead records with all enrichment data (JSONB)
- `outreach_templates` — generated emails, scripts, plans
- `outreach_sends` — tracking sent emails
- `pipeline_activities` — stage changes, notes, contact log
- `niche_playbooks` — customizable per workspace

Row Level Security (RLS) on all tables scoped to workspace_id.

## API Rate Limiting

| Service | Free Tier | Paid Tier | Strategy |
|---|---|---|---|
| Google Places | $200 free credit/mo (~4000 requests) | Pay as you go | Cache results, batch requests |
| SerpAPI | 100 searches/mo | $50/mo for 5000 | Use as fallback only |
| Hunter.io | 25 verifications/mo | $49/mo for 1000 | Verify only hot leads |
| Claude API | Pay per token | Pay per token | Use Haiku for bulk, Sonnet for quality |
| Resend | 100 emails/day free | $20/mo for 50k | Queue and batch |

## Caching Strategy

- Google Places results cached in Supabase for 7 days (businesses don't change daily)
- Website scans cached for 14 days
- Social media data cached for 3 days (more volatile)
- AI-generated content cached per lead (regenerate on demand)
- Scorer runs in real-time (pure computation, no caching needed)

## Error Handling

Every API route follows this pattern:
```typescript
try {
  // Operation
  return NextResponse.json({ data: result });
} catch (error) {
  console.error(`[API_NAME] ${error.message}`, { context });
  return NextResponse.json(
    { error: "Human readable message", code: "ERROR_CODE" },
    { status: appropriate_status }
  );
}
```

Error codes: `RATE_LIMITED`, `INVALID_INPUT`, `EXTRACTION_FAILED`, `ENRICHMENT_FAILED`, `AI_GENERATION_FAILED`, `EMAIL_SEND_FAILED`, `UNAUTHORIZED`, `NOT_FOUND`.
