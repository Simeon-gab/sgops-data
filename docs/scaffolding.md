# Scaffolding — SgOps Data

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase CLI (`npm install -g supabase`)
- Git
- VS Code with Claude Code extension

## Step 1: Initialize Project

```bash
npx create-next-app@latest sgops-data \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm

cd sgops-data
```

## Step 2: Install Dependencies

```bash
# Core
npm install @supabase/supabase-js @supabase/ssr zustand

# UI
npm install lucide-react clsx tailwind-merge

# AI
npm install @anthropic-ai/sdk

# APIs
npm install resend

# Utils
npm install libphonenumber-js date-fns

# Dev
npm install -D @types/node prettier
```

## Step 3: Environment Setup

Create `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key

# Google
GOOGLE_PLACES_API_KEY=your_google_key

# SerpAPI
SERPAPI_KEY=your_serpapi_key

# Hunter.io
HUNTER_API_KEY=your_hunter_key

# Resend
RESEND_API_KEY=your_resend_key
```

## Step 4: Tailwind Config

Replace `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#08080c",
          1: "#0e0e14",
          2: "#15151e",
          3: "#1c1c28",
          4: "#242434",
        },
        border: {
          DEFAULT: "#2a2a3a",
          hover: "#3a3a4e",
        },
        text: {
          1: "#f0f0f2",
          2: "#a0a0b4",
          3: "#686880",
        },
        gold: {
          DEFAULT: "#d4a017",
          dim: "rgba(212,160,23,0.12)",
          bright: "#f0c030",
        },
        tier: {
          hot: "#ef4444",
          warm: "#d4a017",
          cold: "#64748b",
        },
        stage: {
          new: "#d4a017",
          contacted: "#e08a2e",
          responded: "#22c55e",
          meeting: "#3b82f6",
          proposal: "#8b5cf6",
          closed: "#10b981",
          lost: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
```

## Step 5: Supabase Setup

```bash
supabase init
supabase start  # Local development
```

Create first migration:
```bash
supabase migration new initial_schema
```

Paste the SQL from `data-model.md` into the migration file.

```bash
supabase db push  # Apply migration
```

## Step 6: Create Directory Structure

```bash
# App routes
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(auth\)/signup
mkdir -p src/app/\(dashboard\)/prospect
mkdir -p src/app/\(dashboard\)/leads
mkdir -p src/app/\(dashboard\)/pipeline
mkdir -p src/app/\(dashboard\)/data-quality
mkdir -p src/app/\(dashboard\)/outreach
mkdir -p src/app/\(dashboard\)/settings
mkdir -p src/app/api/prospect
mkdir -p src/app/api/enrich
mkdir -p src/app/api/score
mkdir -p src/app/api/generate
mkdir -p src/app/api/email/send
mkdir -p src/app/api/leads
mkdir -p src/app/api/export
mkdir -p src/app/api/webhooks

# Components
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/leads
mkdir -p src/components/prospect
mkdir -p src/components/pipeline
mkdir -p src/components/outreach
mkdir -p src/components/content

# Library
mkdir -p src/lib/supabase
mkdir -p src/lib/api
mkdir -p src/lib/ai
mkdir -p src/lib/engine
mkdir -p src/lib/utils

# Hooks and store
mkdir -p src/hooks
mkdir -p src/store

# Supabase
mkdir -p supabase/migrations
```

## Step 7: Create Foundational Files (Build Order)

Build files in this exact order. Each file may depend on the ones before it.

### Layer 1: Utils and Types (no dependencies)
1. `src/lib/utils/types.ts` — All TypeScript types (copy from data-model.md)
2. `src/lib/utils/constants.ts` — Niches, stages, playbooks, scoring weights
3. `src/lib/utils/format.ts` — Phone, email, currency formatters

### Layer 2: Supabase Client (depends on env vars)
4. `src/lib/supabase/client.ts` — Browser Supabase client
5. `src/lib/supabase/server.ts` — Server Supabase client
6. `src/lib/supabase/middleware.ts` — Auth middleware

### Layer 3: External API Wrappers (depends on env vars)
7. `src/lib/api/google-places.ts` — Google Places API wrapper
8. `src/lib/api/serpapi.ts` — SerpAPI wrapper
9. `src/lib/api/hunter.ts` — Hunter.io email verification
10. `src/lib/api/resend.ts` — Resend email sending

### Layer 4: Core Engine (depends on Layer 1 + 3)
11. `src/lib/engine/cleaner.ts` — Data cleaning pipeline
12. `src/lib/engine/enricher.ts` — Data enrichment
13. `src/lib/engine/scorer.ts` — Lead scoring algorithm
14. `src/lib/engine/prospector.ts` — Extraction orchestrator (uses cleaner, enricher, scorer)

### Layer 5: AI Layer (depends on Layer 1)
15. `src/lib/ai/claude.ts` — Claude API client
16. `src/lib/ai/prompts.ts` — Prompt templates
17. `src/lib/ai/generators.ts` — Email, script, plan generators

### Layer 6: UI Components (depends on Layer 1)
18. `src/components/ui/button.tsx`
19. `src/components/ui/input.tsx`
20. `src/components/ui/select.tsx`
21. `src/components/ui/badge.tsx`
22. `src/components/ui/modal.tsx`
23. `src/components/ui/table.tsx`
24. `src/components/ui/tabs.tsx`
25. `src/components/ui/toast.tsx`

### Layer 7: Layout Components (depends on Layer 6)
26. `src/components/layout/sidebar.tsx`
27. `src/components/layout/topbar.tsx`
28. `src/components/layout/dashboard-layout.tsx`

### Layer 8: Feature Components (depends on Layer 6 + 7)
29. `src/components/prospect/prospect-form.tsx`
30. `src/components/prospect/location-selector.tsx`
31. `src/components/prospect/niche-grid.tsx`
32. `src/components/leads/lead-table.tsx`
33. `src/components/leads/lead-detail.tsx`
34. `src/components/leads/lead-card.tsx`
35. `src/components/pipeline/pipeline-board.tsx`
36. `src/components/pipeline/pipeline-column.tsx`
37. `src/components/pipeline/pipeline-card.tsx`
38. `src/components/outreach/email-preview.tsx`
39. `src/components/outreach/call-script.tsx`
40. `src/components/outreach/follow-up-sequence.tsx`
41. `src/components/content/content-plan.tsx`
42. `src/components/content/pricing-tiers.tsx`

### Layer 9: Hooks and Store (depends on Layer 2 + 4 + 5)
43. `src/store/index.ts` — Zustand store
44. `src/hooks/useLeads.ts`
45. `src/hooks/useProspect.ts`
46. `src/hooks/usePipeline.ts`
47. `src/hooks/useOutreach.ts`

### Layer 10: API Routes (depends on Layer 4 + 5)
48. `src/app/api/prospect/route.ts`
49. `src/app/api/enrich/route.ts`
50. `src/app/api/score/route.ts`
51. `src/app/api/generate/route.ts`
52. `src/app/api/email/send/route.ts`
53. `src/app/api/leads/route.ts`
54. `src/app/api/export/route.ts`

### Layer 11: Pages (depends on everything above)
55. `src/app/layout.tsx` — Root layout with fonts
56. `src/app/(auth)/login/page.tsx`
57. `src/app/(auth)/signup/page.tsx`
58. `src/app/(dashboard)/layout.tsx` — Dashboard layout with sidebar
59. `src/app/(dashboard)/prospect/page.tsx`
60. `src/app/(dashboard)/leads/page.tsx`
61. `src/app/(dashboard)/pipeline/page.tsx`
62. `src/app/(dashboard)/data-quality/page.tsx`
63. `src/app/(dashboard)/outreach/page.tsx`
64. `src/app/(dashboard)/settings/page.tsx`
65. `src/app/page.tsx` — Redirect to /prospect

## Step 8: Verify

```bash
npm run dev
```

Check:
- Login/signup works
- Dashboard renders with sidebar
- All routes load without errors
- Supabase connection verified (can create workspace)

## Claude Code Workflow

When working in Claude Code:

1. Always read CLAUDE.md first for conventions
2. Reference docs/ for architecture decisions
3. Build in layer order (don't skip ahead to pages before engine is solid)
4. Test each API route independently before wiring to UI
5. Use `supabase db push` after any migration changes
6. Commit after each completed phase
