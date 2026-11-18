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
import type { GenerationContext, Observation } from "./prompts";
import { lintColdEmail, stripEmDashes } from "./email-lint";

// ── Cold email ─────────────────────────────────────────────────────────────────

interface ColdEmailDraft {
  subject: string;
  body: string;
  observation_used?: number | null;
}

export interface ColdEmailResult {
  subject: string;
  body: string;
  // The verified observation the email opens on, with where to check it. Null
  // when the email makes no specific claim about the business.
  basedOn: Observation | null;
  // Rule breaks that survived the rewrite, shown to the sender rather than
  // hidden. Empty in the normal case.
  issues: string[];
  tokensUsed: number;
}

export async function generateColdEmail(ctx: GenerationContext): Promise<ColdEmailResult> {
  const observations = generateObservations(ctx.lead, ctx.profile);
  const system = buildSystemPrompt(ctx);
  const prompt = coldEmailPrompt(ctx, observations);

  const clean = (raw: string): ColdEmailDraft => {
    const draft = parseJson<ColdEmailDraft>(raw);
    return {
      ...draft,
      subject: stripEmDashes(draft.subject ?? "").trim(),
      body: stripEmDashes(draft.body ?? "").trim(),
    };
  };

  const first = await callClaude(system, prompt, MODELS.quality, TOKEN_BUDGETS.cold_email);
  let draft = clean(first.content);
  let issues = lintColdEmail(draft.subject, draft.body);
  let tokensUsed = first.tokensUsed;

  // One rewrite, with the specific reasons. If the rewrite is no better the
  // first draft stands and the remaining issues are reported.
  if (issues.length > 0) {
    try {
      const retry = await callClaude(
        system,
        `${prompt}\n\nYour previous draft was rejected:\n${JSON.stringify({ subject: draft.subject, body: draft.body })}\n\nProblems to fix:\n${issues.map((i) => `- ${i}`).join("\n")}\n\nWrite it again, fixing every problem. Same JSON format.`,
        MODELS.quality,
        TOKEN_BUDGETS.cold_email
      );
      tokensUsed += retry.tokensUsed;
      const second = clean(retry.content);
      const secondIssues = lintColdEmail(second.subject, second.body);
      if (secondIssues.length < issues.length) {
        draft = second;
        issues = secondIssues;
      }
    } catch {
      // The first draft is still a usable email. Keep it.
    }
  }

  const index = typeof draft.observation_used === "number" ? draft.observation_used - 1 : -1;

  return {
    subject: draft.subject,
    body: draft.body,
    basedOn: observations[index] ?? null,
    issues,
    tokensUsed,
  };
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
