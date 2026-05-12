import { anthropic, MODELS, TOKEN_BUDGETS } from "./claude";
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  // cache_control is a prompt-caching beta field not yet typed in this SDK version
  const systemBlock = {
    type: "text" as const,
    text: systemPrompt,
    cache_control: { type: "ephemeral" },
  };

  const msg = await anthropic.messages.create(
    {
      model,
      max_tokens: maxTokens,
      // SDK v0.39 doesn't type prompt-caching system blocks
      system: [systemBlock] as Parameters<typeof anthropic.messages.create>[0]["system"],
      messages: [{ role: "user", content: userPrompt }],
    },
    { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } }
  );

  const content = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const tokensUsed = msg.usage.input_tokens + msg.usage.output_tokens;

  return { content, tokensUsed };
}

// ── Cold email ─────────────────────────────────────────────────────────────────

export async function generateColdEmail(
  ctx: GenerationContext
): Promise<{ subject: string; body: string; tokensUsed: number }> {
  const observations = generateObservations(ctx.lead);
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    coldEmailPrompt(ctx.lead, observations),
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
  const observations = generateObservations(ctx.lead);
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    callScriptPrompt(ctx.lead, observations),
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
    followUpPrompt(ctx.lead, originalSubject),
    MODELS.fast,
    TOKEN_BUDGETS.follow_up_sequence
  );
  const sequence = parseJson<FollowUpEmail[]>(content);
  return { sequence, tokensUsed };
}

// ── Content plan ───────────────────────────────────────────────────────────────

export async function generateContentPlan(
  ctx: GenerationContext
): Promise<{ plan: Record<string, unknown>; tokensUsed: number }> {
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    contentPlanPrompt(ctx.lead),
    MODELS.quality,
    TOKEN_BUDGETS.content_plan
  );
  const plan = parseJson<Record<string, unknown>>(content);
  return { plan, tokensUsed };
}

// ── Proposal ───────────────────────────────────────────────────────────────────

export async function generateProposal(
  ctx: GenerationContext
): Promise<{ proposal: Record<string, unknown>; tokensUsed: number }> {
  const observations = generateObservations(ctx.lead);
  const { content, tokensUsed } = await callClaude(
    buildSystemPrompt(ctx),
    proposalPrompt(ctx.lead, observations),
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
    leadIntelPrompt(ctx.lead),
    MODELS.fast,
    TOKEN_BUDGETS.lead_intelligence
  );
  return { summary: content.trim(), tokensUsed };
}

export type { GenerationContext };
