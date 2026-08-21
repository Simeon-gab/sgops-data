import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignPlaybook, NichePlaybook, SenderProfile } from "@/lib/utils/types";
import { senderProfileHash } from "@/lib/utils/sender-profile";
import { fallbackPlaybook, getSeedPlaybook } from "./playbooks";
import { MODELS, TOKEN_BUDGETS } from "./claude";
import { callClaude, parseJson } from "./invoke";

// A playbook is the bridge between one sender and one audience: what that
// audience cares about, the angle that lands, and the objections to expect.
// These used to be hand-written per niche and assumed the sender was a video
// agency. They are now generated per (sender profile x audience) and cached.

// ── Generation ────────────────────────────────────────────────────────────────

const PLAYBOOK_SYSTEM = `You build outreach playbooks. Given who someone is, what they want, and who they are contacting, you produce the strategic brief that makes their outreach land.

Rules:
- Never use em dashes. Use commas, periods, or colons instead.
- Be concrete and specific to the audience named. No filler, no buzzwords.
- Do not invent credentials, results, or numbers the sender did not give you.
- If the sender is asking for something (a job, a partnership, sponsorship) rather than selling a service, do not produce pricing. Set offer_tiers to null.
- Objections must be things this specific audience would actually say.
- Return only valid JSON. No commentary before or after.`;

function playbookPrompt(profile: SenderProfile, nicheLabel: string): string {
  const tiersInstruction =
    profile.goal === "find_job" || profile.goal === "research"
      ? `"offer_tiers": null`
      : `"offer_tiers": [{ "name": "Tier name", "description": "What is included", "price_range": "Range or null if pricing does not apply" }]`;

  return `Build an outreach playbook.

SENDER
Name: ${profile.sender_name}
Role: ${profile.sender_role}
Organization: ${profile.organization ?? "Independent, no organization"}
Goal: ${profile.goal}
What they offer or are asking for: ${profile.offer}
Their credibility: ${profile.credibility ?? "Not provided, do not invent any"}
Desired next step: ${profile.cta}
Preferred tone: ${profile.tone}

AUDIENCE
Their stated target: ${profile.audience}
The specific audience for this playbook: ${nicheLabel}

Return ONLY valid JSON in this exact shape:

{
  "audience_context": "2-3 sentences on how ${nicheLabel} actually operate and what governs their decisions on this kind of request.",
  "pain_points": "1-2 sentences on the specific problem or need of ${nicheLabel} that this sender addresses.",
  "value_angles": ["4-6 specific angles the sender can lead with, each one sentence"],
  "hook": "One sentence the sender could open with. Direct, specific, no hype.",
  "objection_responses": {
    "A real objection ${nicheLabel} would raise": "A short, honest response",
    "A second real objection": "A short, honest response",
    "A third real objection": "A short, honest response"
  },
  ${tiersInstruction}
}`;
}

export async function generateCampaignPlaybook(
  profile: SenderProfile,
  nicheId: string,
  nicheLabel: string
): Promise<CampaignPlaybook> {
  const { content } = await callClaude(
    PLAYBOOK_SYSTEM,
    playbookPrompt(profile, nicheLabel),
    MODELS.quality,
    TOKEN_BUDGETS.playbook
  );

  const parsed = parseJson<Omit<CampaignPlaybook, "niche_id" | "niche_label">>(content);

  return {
    niche_id: nicheId,
    niche_label: nicheLabel,
    audience_context: parsed.audience_context ?? profile.audience,
    pain_points: parsed.pain_points ?? "",
    value_angles: Array.isArray(parsed.value_angles) ? parsed.value_angles : [],
    hook: parsed.hook ?? "",
    objection_responses: parsed.objection_responses ?? {},
    offer_tiers: Array.isArray(parsed.offer_tiers) ? parsed.offer_tiers : null,
  };
}

// ── Resolution ────────────────────────────────────────────────────────────────

function fromRow(row: NichePlaybook): CampaignPlaybook {
  return {
    niche_id: row.niche_id,
    niche_label: row.niche_label,
    audience_context: row.audience_context ?? row.pain_points ?? "",
    pain_points: row.pain_points ?? "",
    value_angles: row.value_angles ?? row.content_angles ?? [],
    hook: row.hook ?? "",
    objection_responses: row.objection_responses ?? {},
    offer_tiers: row.offer_tiers,
  };
}

// Returns the playbook for this workspace and audience, generating and caching
// it on first use. Never throws: a failed generation falls back to a seed or to
// the sender's own words, because outreach should not be blocked by the AI call.
export async function resolveCampaignPlaybook(
  supabase: SupabaseClient,
  workspaceId: string,
  profile: SenderProfile,
  nicheId: string,
  nicheLabel: string
): Promise<CampaignPlaybook> {
  const hash = senderProfileHash(profile);

  const { data: cached } = await supabase
    .from("niche_playbooks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("niche_id", nicheId)
    .maybeSingle();

  const row = cached as NichePlaybook | null;

  // A hand-edited playbook is authoritative and never regenerated over.
  if (row?.is_custom) return fromRow(row);

  // Cache hit only when the profile that produced it still matches.
  if (row && row.profile_hash === hash) return fromRow(row);

  let playbook: CampaignPlaybook;
  try {
    playbook = await generateCampaignPlaybook(profile, nicheId, nicheLabel);
  } catch {
    return (
      getSeedPlaybook(profile.goal, nicheId) ??
      fallbackPlaybook(profile, nicheId, nicheLabel)
    );
  }

  // Cache for next time. A failed write is not fatal, the caller still has a
  // valid playbook in hand, it just costs another generation next request.
  await supabase.from("niche_playbooks").upsert(
    {
      workspace_id: workspaceId,
      niche_id: nicheId,
      niche_label: nicheLabel,
      goal: profile.goal,
      audience_context: playbook.audience_context,
      pain_points: playbook.pain_points,
      value_angles: playbook.value_angles,
      hook: playbook.hook,
      objection_responses: playbook.objection_responses,
      offer_tiers: playbook.offer_tiers,
      profile_hash: hash,
      generated_at: new Date().toISOString(),
      is_custom: false,
    },
    { onConflict: "workspace_id,niche_id" }
  );

  return playbook;
}
