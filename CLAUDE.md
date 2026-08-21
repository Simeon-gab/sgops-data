# CLAUDE.md — SgOps Data

## Project Identity

SgOps Data is an outreach operating system for anyone who needs to reach businesses at scale: freelancers and agencies hunting clients, job seekers approaching employers, B2B sellers, and people chasing partnerships or sponsorships. It automates the pipeline from prospecting to reply: extract business data, enrich and score leads, generate personalized outreach, track pipeline.

This is the first product under the SgOps parent brand (Simeon Gabriels Operations), an AI-powered tool suite.

### Sender Profile (the central abstraction)

The product is not hardcoded to any one kind of sender. Every workspace has a **sender profile** (`workspaces.goal`, `sender_role`, `offer`, `audience`, `cta`, `tone`, `scoring_profile`) captured at `/onboarding` and resolved by `resolveSenderProfile()` in `src/lib/utils/sender-profile.ts`.

The profile drives three things. Change it and all three change:

1. **The AI system prompt** (`src/lib/ai/prompts.ts`) is built from the profile. There is no hardcoded sender identity.
2. **Campaign playbooks** are generated per (sender profile x audience) by `resolveCampaignPlaybook()` and cached in `niche_playbooks`, keyed by `profile_hash`. Edit your offer and stale playbooks regenerate automatically. The hand-written playbooks in `src/lib/ai/playbooks.ts` are seeds for the `win_clients` goal and a fallback when generation fails.
3. **Lead scoring** (`SCORING_PROFILES` in `src/lib/utils/constants.ts`) picks weights per goal. A videographer ranks on missing video, a job seeker ranks on hiring signals, a product seller ranks on buying power. Signals are detected once in `scorer.ts` and weighted per profile; a signal weighted 0 never appears in the breakdown.

Goals and their available generators live in `src/lib/utils/profiles.ts`. Never add sender-specific assumptions (video, agencies, pricing) outside a goal preset or a scoring profile.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS (dark theme, gold accent system)
- **Database:** Supabase (PostgreSQL + Row Level Security + pgvector)
- **Auth:** Supabase Auth (email/password + OAuth)
- **AI:** Claude API (Anthropic) for outreach generation, lead enrichment, content strategy
- **Data Extraction APIs:** Google Places API, SerpAPI, Hunter.io (email verification)
- **Email Sending:** Resend API
- **State Management:** React hooks + Zustand for global state
- **Deployment:** Vercel

## Project Structure

```
sgops-data/
├── CLAUDE.md                    # This file
├── docs/
│   ├── project-overview.md      # Product vision and scope
│   ├── architecture.md          # System architecture and data flow
│   ├── data-model.md            # Database schema and types
│   ├── ai-design.md             # AI/LLM integration patterns
│   ├── build-plan.md            # Phased build roadmap
│   └── scaffolding.md           # File structure and setup instructions
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Dashboard redirect
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       # Sidebar + topbar layout
│   │   │   ├── prospect/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   ├── pipeline/page.tsx
│   │   │   ├── data-quality/page.tsx
│   │   │   ├── outreach/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── prospect/route.ts
│   │       ├── enrich/route.ts
│   │       ├── score/route.ts
│   │       ├── generate/route.ts
│   │       ├── email/send/route.ts
│   │       └── webhooks/route.ts
│   ├── components/
│   │   ├── ui/                  # Base UI components (buttons, inputs, badges)
│   │   ├── layout/              # Sidebar, Topbar, Modal
│   │   ├── leads/               # LeadTable, LeadCard, LeadDetail
│   │   ├── prospect/            # ProspectForm, LocationSelector, NicheGrid
│   │   ├── pipeline/            # PipelineBoard, PipelineColumn, PipelineCard
│   │   ├── outreach/            # EmailPreview, CallScript, FollowUpSequence
│   │   └── content/             # ContentPlan, PricingTiers
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser client
│   │   │   ├── server.ts        # Server client
│   │   │   └── middleware.ts    # Auth middleware
│   │   ├── api/
│   │   │   ├── google-places.ts # Google Places API wrapper
│   │   │   ├── serpapi.ts       # SerpAPI wrapper
│   │   │   ├── hunter.ts       # Hunter.io email verification
│   │   │   └── resend.ts       # Resend email sending
│   │   ├── ai/
│   │   │   ├── claude.ts        # Claude API client
│   │   │   ├── prompts.ts       # Prompt templates
│   │   │   └── generators.ts   # Email, script, content plan generators
│   │   ├── engine/
│   │   │   ├── prospector.ts    # Extraction orchestrator
│   │   │   ├── enricher.ts      # Data enrichment pipeline
│   │   │   ├── scorer.ts        # Lead scoring algorithm
│   │   │   └── cleaner.ts       # Data cleaning and normalization
│   │   └── utils/
│   │       ├── format.ts        # Phone, email, currency formatters
│   │       ├── constants.ts     # Niches, stages, playbooks
│   │       └── types.ts         # Shared TypeScript types
│   ├── hooks/
│   │   ├── useLeads.ts
│   │   ├── useProspect.ts
│   │   ├── usePipeline.ts
│   │   └── useOutreach.ts
│   └── store/
│       └── index.ts             # Zustand store
├── supabase/
│   └── migrations/              # SQL migration files
├── public/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local.example
```

## Code Conventions

- No em dashes in any copy or generated text (use commas, periods, or colons instead)
- Use named exports for components, default exports for pages
- All API routes return typed JSON responses with consistent error shape: `{ error: string, code: string }`
- All database queries go through typed Supabase client helpers, never raw SQL in components
- Tailwind only, no CSS modules or styled-components
- Component files are PascalCase, utility files are camelCase
- Use `async/await` over `.then()` chains
- Prefer early returns over nested conditionals
- Every generated outreach template (emails, scripts, plans) must be copyable and exportable as CSV, PDF, or plain text

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_PLACES_API_KEY=
SERPAPI_KEY=
HUNTER_API_KEY=
RESEND_API_KEY=
```

## Key Decisions

- Data extraction happens server-side only (API routes), never client-side
- Lead scoring is deterministic (no AI involved), based on weighted formula
- AI is used for: outreach personalization, content strategy generation, and lead intelligence summaries
- All leads belong to a workspace (multi-tenant from day one)
- Email sequences are stored as templates, not hardcoded
- The system must work for any country, not just US
