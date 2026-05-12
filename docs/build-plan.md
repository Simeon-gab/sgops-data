# Build Plan — SgOps Data

## Phase 0: Project Scaffolding (Day 1)
**Goal:** Repo initialized, dependencies installed, Supabase connected, basic routing working.

- [ ] Initialize Next.js 14+ with TypeScript, Tailwind, App Router
- [ ] Install dependencies: @supabase/supabase-js, @supabase/ssr, zustand, lucide-react, clsx
- [ ] Set up Tailwind config with custom dark theme (gold accent system)
- [ ] Create Supabase project, add env vars
- [ ] Run initial migration (workspaces, leads tables)
- [ ] Set up auth (login, signup pages)
- [ ] Create dashboard layout (sidebar, topbar)
- [ ] Verify routing: /prospect, /leads, /pipeline, /data-quality, /outreach, /settings
- [ ] Create workspace on first login (onboarding flow)

**Exit criteria:** User can sign up, log in, see the dashboard shell with sidebar navigation.

---

## Phase 1: Core Engine — Extraction + Cleaning (Days 2 to 5)
**Goal:** User can search for businesses by niche + country/state/city and get back clean, structured data.

### Prospector
- [ ] Build ProspectForm component (niche selector, country/state/city dropdowns, result count: 50/100/150/200)
- [ ] Implement country/state/city selector (static lists for top countries, dynamic for states/cities)
- [ ] Build `/api/prospect` route
- [ ] Integrate Google Places API (Text Search endpoint)
- [ ] Implement pagination (auto-fetch up to requested count)
- [ ] Add SerpAPI as fallback source
- [ ] Handle rate limiting and errors gracefully
- [ ] Cache search results in prospect_searches table

### Cleaner
- [ ] Build cleaner service (`/src/lib/engine/cleaner.ts`)
- [ ] Phone normalization (detect country, format with country code)
- [ ] Email extraction from website (basic pattern: info@, contact@, hello@ + Hunter.io)
- [ ] Email validation (syntax + MX record check)
- [ ] Address parsing into structured fields
- [ ] Deduplication by name + location hash
- [ ] Dead website detection (HEAD request, check for parked page patterns)
- [ ] Quality scoring (verified/partial/unverified)
- [ ] Quality issues tagging

### Data Quality View
- [ ] Build DataQuality page showing cleaning pipeline stats
- [ ] Table with per-record quality breakdown
- [ ] Issue flags visible per row
- [ ] Export cleaned data as CSV (using CleanedExportRecord schema)

**Exit criteria:** User searches "Restaurants in Lagos, Nigeria", gets 50+ results, sees them cleaned and structured with quality scores. Can export as CSV.

---

## Phase 2: Enrichment + Scoring (Days 6 to 8)
**Goal:** Every lead has intelligence data and a score.

### Enricher
- [ ] Build enricher service (`/src/lib/engine/enricher.ts`)
- [ ] Website content scan: check for <video> tags, YouTube embeds, Vimeo embeds
- [ ] Social media link extraction from website footer/header
- [ ] Instagram follower count (via public profile scraping or API)
- [ ] Google Ads detection (SerpAPI ad results for business name)
- [ ] Competitor lookup (same niche + same city, top 3 by reviews)
- [ ] Years in business estimate (from Google Business profile or website copyright year)
- [ ] Build `/api/enrich` route (can run on single lead or batch)

### Scorer
- [ ] Build scorer service (`/src/lib/engine/scorer.ts`)
- [ ] Implement weighted formula from architecture doc
- [ ] Generate score_breakdown array with reason per signal
- [ ] Assign tier (hot/warm/cold)
- [ ] Build score display components (score bar, tier badge, breakdown panel)

### Leads Table
- [ ] Full leads table with sorting (by score, name, reviews, tier)
- [ ] Filtering (by niche, location, tier, stage, data quality)
- [ ] Search by business name
- [ ] Click to open lead detail panel

**Exit criteria:** All leads show enrichment data, scores, and tiers. Table is sortable and filterable. Score breakdown explains why each lead ranked where it did.

---

## Phase 3: AI Outreach Generation (Days 9 to 12)
**Goal:** Click any lead, get personalized cold email, call script, follow-ups, and content plan.

### AI Integration
- [ ] Build Claude API client (`/src/lib/ai/claude.ts`)
- [ ] Build prompt templates (`/src/lib/ai/prompts.ts`)
- [ ] Build observation generator (rule-based, pre-AI)
- [ ] Seed all 15 niche playbooks in niche_playbooks table

### Generators
- [ ] Cold email generator (Sonnet for individual, Haiku for batch)
- [ ] Call script generator with objection handling
- [ ] Follow-up sequence generator (3 emails)
- [ ] Content plan generator (90-day, structured JSON)
- [ ] Proposal generator (one-page pitch)
- [ ] Build `/api/generate` route

### Lead Detail Panel
- [ ] Overview tab (all lead data, intelligence, score breakdown)
- [ ] Cold Email tab (generated email with copy button)
- [ ] Call Script tab (generated script with copy button)
- [ ] Follow-Ups tab (3-email sequence)
- [ ] Content Plan tab (month-by-month with pricing)
- [ ] Regenerate button per tab
- [ ] Store generated content in outreach_templates table

**Exit criteria:** Every tab generates niche-aware, personalized content. Content references specific observations about the business. Copy buttons work. Regeneration creates fresh content.

---

## Phase 4: Pipeline CRM (Days 13 to 15)
**Goal:** Full pipeline board with stage management, notes, and activity tracking.

- [ ] Build Pipeline page with Kanban board (7 columns)
- [ ] Drag-and-drop between stages (or click-to-move from lead detail)
- [ ] Pipeline card shows: name, niche, score, last contacted
- [ ] Stage change creates pipeline_activity record
- [ ] Notes per lead (text input, saved to lead record)
- [ ] Activity feed per lead (stage changes, emails sent, notes added)
- [ ] Filter pipeline by niche, tier
- [ ] Pipeline stats at top (conversion rates, stage counts)

**Exit criteria:** Leads move through stages. Activity is logged. Notes are saved. Pipeline gives a clear view of the sales funnel.

---

## Phase 5: Email Sending (Days 16 to 18)
**Goal:** Send generated emails directly from the app.

- [ ] Integrate Resend API (`/src/lib/api/resend.ts`)
- [ ] Build `/api/email/send` route
- [ ] Single email send from lead detail panel
- [ ] Batch email send (select leads from table, send to all)
- [ ] Email queue system (prevent rate limiting)
- [ ] Track send status (queued, sent, delivered, opened, bounced)
- [ ] Auto-update lead stage to "contacted" on first send
- [ ] Build Outreach page showing all sent emails with status
- [ ] Webhook endpoint for Resend delivery events

**Exit criteria:** User can send emails from the app. Status tracking works. Batch sending handles 50+ emails without hitting rate limits.

---

## Phase 6: Polish + Export (Days 19 to 21)
**Goal:** Production-quality UI, data export, settings, onboarding.

- [ ] Settings page: agency profile (name, email, phone, portfolio URL, logo)
- [ ] Onboarding flow: first-time user sets up workspace and agency profile
- [ ] Export leads as CSV (cleaned, structured format)
- [ ] Export leads as PDF (formatted report)
- [ ] Dashboard home page with summary stats
- [ ] Loading states, error states, empty states for all views
- [ ] Responsive sidebar (collapsible on mobile)
- [ ] Keyboard shortcuts (Escape to close modals, Enter to search)
- [ ] Toast notifications for actions
- [ ] Dark theme polish pass (spacing, typography, animations)

**Exit criteria:** App feels polished and complete. All states are handled. Export works. Onboarding guides new users.

---

## Phase 7: Deploy (Day 22)
- [ ] Deploy to Vercel
- [ ] Configure environment variables
- [ ] Set up Supabase production project
- [ ] Run all migrations on production
- [ ] Test full flow: signup > prospect > enrich > score > generate > send > pipeline
- [ ] Set up error monitoring (Sentry or similar)
- [ ] Domain setup (if applicable)

---

## Future Phases (Post-Launch)

### Phase 8: Multi-User + Teams
- Team invitations and role-based access
- Activity attribution (who did what)

### Phase 9: Automation
- Scheduled prospecting (run searches weekly, auto-add new leads)
- Auto follow-up sequences (drip campaigns)
- Webhook integrations (Zapier, n8n)

### Phase 10: Analytics
- Conversion tracking (prospect > contacted > closed, by niche)
- Best-performing niches and locations
- Email open/click rates by template
- Revenue attribution per lead

### Phase 11: White-Label
- Custom branding for proposals and emails
- Custom domain for email sending
- API access for integrations
