# Project Overview — SgOps Data

## Vision

SgOps Data is a client acquisition operating system for creative professionals and agencies. It replaces the fragmented, manual process of finding clients (Googling businesses, copying emails into spreadsheets, writing cold emails from scratch, losing track of who you contacted) with a single pipeline that runs from prospect to closed deal.

The core insight: creative professionals are excellent at making content but terrible at consistently finding clients. Prospecting feels like a different skill set. SgOps Data closes that gap by turning client acquisition into a system, not a hustle.

## Target User

Primary: Solo videographers, photographers, small production companies, and boutique marketing agencies (1 to 15 people) who:
- Sell creative services (video production, photography, content creation, brand campaigns)
- Need a steady pipeline of local and regional clients
- Currently find clients through word-of-mouth, cold DMs, or sporadic outreach
- Don't have a dedicated sales team or CRM

Secondary: Any service business that sells to local businesses (web design agencies, social media managers, copywriters, PR firms).

## Core Modules

### 1. Prospector
The extraction engine. User inputs a niche, country, state, and city. The system queries Google Places API, SerpAPI, and business directories to pull raw business data. Returns 50 to 200+ results per search.

Data extracted per business:
- Business name
- Address (full, structured)
- Phone number
- Email (from website contact page via Hunter.io)
- Website URL
- Google rating and review count
- Business category/niche tags
- Photos (presence check)
- Social media links (if available)
- Hours of operation
- Whether they have video content (website scan)

### 2. Cleaner
Raw data goes through a cleaning pipeline before it reaches the user:
- Phone numbers normalized to international format with country code
- Emails validated (syntax + domain MX check + Hunter.io verification)
- Duplicate records merged (by business name + address hash)
- Permanently closed businesses filtered out
- Parked/dead websites flagged
- Missing fields marked for manual enrichment
- Business names standardized (trim whitespace, fix casing)
- Addresses parsed into structured fields (street, city, state, zip, country)

Output: structured, clean records with a data quality score per lead.

### 3. Enricher
Takes clean records and adds intelligence:
- Website analysis: has video content? Blog? Active social links? Modern vs outdated design?
- Social media scan: follower count, posting frequency, content type
- Ad detection: are they running Google Ads or Meta Ads? (via SerpAPI ad results)
- Competitor scan: 2 to 3 similar businesses in the same area, with/without video
- Business maturity signals: years in operation, number of locations, employee count estimate

### 4. Scorer
Deterministic scoring algorithm. No AI. Weighted formula:

| Signal | Weight | Logic |
|---|---|---|
| No video content | +22 | Biggest opportunity signal |
| Has website | +12 | Basic digital presence |
| Runs paid ads | +14 | Confirms marketing budget |
| Social followers > 1000 | +14 | Existing audience |
| Posts < 3x/week | +8 | Inconsistent, needs help |
| Reviews > 50 | +12 | Established business |
| Rating >= 4.0 | +8 | Good reputation |
| Years in business >= 3 | +10 | Stable operation |

Tiers:
- **Hot** (68+): High probability of conversion. Prioritize.
- **Warm** (42 to 67): Worth outreach. May need nurturing.
- **Cold** (< 42): Low priority. Batch outreach only.

### 5. Outreach Generator (AI-Powered)
For any lead, generates:
- **Cold email**: Personalized by niche, business data, and content gap analysis. Not generic. References specific observations about the business.
- **Cold call script**: Opening, hook, problem statement, offer, close, and 3 objection handlers.
- **Follow-up sequence**: 3 emails (Day 3, Day 7, Day 14), each contextually different.
- **Proposal draft**: One-page pitch with business name, relevant portfolio samples, content calendar preview, pricing tiers.

Each niche has a pre-built playbook (pain points, content angles, hooks, positioning) that the AI uses as context.

### 6. Content Strategist (AI-Powered)
For leads that convert (or as part of the pitch), generates:
- 90-day content plan (month-by-month)
- Platform strategy (which platforms, why, posting cadence)
- Shot list per shoot day
- Deliverables list
- Suggested pricing tiers (Starter, Growth, Premium)

### 7. Pipeline CRM
Simple Kanban board: New > Contacted > Responded > Meeting > Proposal > Closed > Lost.
- Drag leads between stages
- Add notes per lead
- Track last contact date
- Filter by niche, location, tier, stage
- Export pipeline as CSV

### 8. Batch Operations
- Select multiple leads, generate emails for all, send in batch via Resend
- Export lead lists as CSV (with clean, structured data)
- Bulk stage updates

## Competitive Positioning

Existing tools (LeadScrape, Outscraper, Scrap.io, Apollo) are generic B2B lead scrapers. They extract data. That's it. The user still has to:
1. Figure out which leads are worth pursuing
2. Write emails manually
3. Track everything in a separate CRM
4. Create proposals from scratch
5. Develop content strategies independently

SgOps Data is the only tool that does extraction AND intelligence AND outreach AND CRM AND content strategy in one pipeline, specifically designed for creative agencies. The niche playbooks, the content gap analysis, the video-specific scoring, the production-focused content plans: none of this exists anywhere else.

## Revenue Model (Future)

- Free tier: 50 leads/month, 10 AI-generated emails
- Pro ($49/mo): 500 leads/month, unlimited AI generation, email sending, CRM
- Agency ($149/mo): 2000 leads/month, multi-user, white-label proposals, API access
