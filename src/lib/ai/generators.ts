import { MODELS, TOKEN_BUDGETS } from "./claude";
import { callClaude, parseJson, repairTruncatedJson } from "./invoke";
import {
  buildSystemPrompt,
  generateObservations,
  coldEmailPrompt,
  callScriptPrompt,
  followUpPrompt,
  contentPlanPrompt,
  proposalPrompt,
  leadIntelPrompt,
} from "./prompts";
import type { GenerationContext } from "./prompts";

// ── Cold email ─────────────────────────────────────────────────────────────────

export async function generateColdEmail(
  ctx: GenerationContext
): Promise<{ subject: string; body: string; tokensUsed: number }> {
  const observations = generateObservations(ctx.lead, ctx.profile);
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    coldEmailPrompt(ctx, observations),
    MODELS.quality,
    TOKEN_BUDGETS.cold_email
  );
  const parsed = parseJson<{ subject: string; body: string }>(content);
  return { ...parsed, tokensUsed };
}

// ── Call script ────────────────────────────────────────────────────────────────

export async function generateCallScript(
  ctx: GenerationContext
): Promise<{ body: string; tokensUsed: number }> {
  const observations = generateObservations(ctx.lead, ctx.profile);
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    callScriptPrompt(ctx, observations),
    MODELS.quality,
    TOKEN_BUDGETS.call_script
  );
  return { body: content.trim(), tokensUsed };
}

// ── Follow-up sequence ─────────────────────────────────────────────────────────

export interface FollowUpEmail {
  day: 3 | 7 | 14;
  subject: string;
  body: string;
}

export async function generateFollowUpSequence(
  ctx: GenerationContext,
  originalSubject: string
): Promise<{ sequence: FollowUpEmail[]; tokensUsed: number }> {
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    followUpPrompt(ctx, originalSubject),
    MODELS.fast,
    TOKEN_BUDGETS.follow_up_sequence
  );
  const sequence = parseJson<FollowUpEmail[]>(content);
  return { sequence, tokensUsed };
}

// ── Content plan ───────────────────────────────────────────────────────────────

export async function generateContentPlan(
  ctx: GenerationContext,
  options?: { services?: string[]; duration?: 30 | 60 | 90 }
): Promise<{ plan: Record<string, unknown>; tokensUsed: number }> {
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    contentPlanPrompt(ctx, options),
    MODELS.quality,
    TOKEN_BUDGETS.content_plan
  );

  let plan: Record<string, unknown>;
  try {
    plan = parseJson<Record<string, unknown>>(content);
  } catch {
    // Response was likely truncated at the token limit. Try closing open structures.
    try {
      plan = JSON.parse(repairTruncatedJson(content)) as Record<string, unknown>;
      plan._truncated = true;
    } catch {
      plan = { _truncated: true };
    }
  }

  return { plan, tokensUsed };
}

// ── Proposal ───────────────────────────────────────────────────────────────────

export async function generateProposal(
  ctx: GenerationContext
): Promise<{ proposal: Record<string, unknown>; tokensUsed: number }> {
  const observations = generateObservations(ctx.lead, ctx.profile);
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    proposalPrompt(ctx, observations),
    MODELS.quality,
    TOKEN_BUDGETS.proposal
  );
  const proposal = parseJson<Record<string, unknown>>(content);
  return { proposal, tokensUsed };
}

// ── Lead intelligence ──────────────────────────────────────────────────────────

export async function generateLeadIntel(
  ctx: GenerationContext
): Promise<{ summary: string; tokensUsed: number }> {
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    leadIntelPrompt(ctx),
    MODELS.fast,
    TOKEN_BUDGETS.lead_intelligence
  );
  return { summary: content.trim(), tokensUsed };
}

export type { GenerationContext };
