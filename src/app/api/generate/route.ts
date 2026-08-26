import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { resolveCampaignPlaybook } from "@/lib/ai/playbook-generator";
import {
  resolveSenderProfile,
  isProfileComplete,
  missingProfileFields,
} from "@/lib/utils/sender-profile";
import { supportsGenerator, getGoalPreset } from "@/lib/utils/profiles";
import {
  generateColdEmail,
  generateCallScript,
  generateFollowUpSequence,
  generateContentPlan,
  generateProposal,
  generateLeadIntel,
} from "@/lib/ai/generators";
import { MODELS } from "@/lib/ai/claude";
import type { GenerateType, Lead, OutreachTemplate, ApiError } from "@/lib/utils/types";

// ── Request body ──────────────────────────────────────────────────────────────

interface GenerateBody {
  lead_id: string;
  type: GenerateType;
  original_subject?: string;
  services?: string[];
  duration?: 30 | 60 | 90;
}

// ── POST /api/generate ─────────────────────────────────────────────────────────
// Body: { lead_id, type, original_subject? }
// Returns: { templates } for stored types, { summary, tokens_used } for lead_intel

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const { lead_id, type, original_subject, services, duration } = body;

  if (!lead_id || !type) {
    return NextResponse.json<ApiError>(
      { error: "lead_id and type are required", code: "bad_request" },
      { status: 400 }
    );
  }

  const VALID_TYPES: GenerateType[] = [
    "cold_email", "call_script", "follow_up",
    "content_plan", "proposal", "lead_intel",
  ];
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json<ApiError>(
      { error: `Invalid type: ${type}`, code: "bad_request" },
      { status: 400 }
    );
  }

  if (type === "follow_up" && !original_subject) {
    return NextResponse.json<ApiError>(
      { error: "original_subject is required for follow_up", code: "bad_request" },
      { status: 400 }
    );
  }

  // ── Workspace ────────────────────────────────────────────────────────────────

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  // ── Lead ─────────────────────────────────────────────────────────────────────

  const { data: leadRow, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", lead_id)
    .eq("workspace_id", workspace.id)
    .single();

  if (leadError || !leadRow) {
    return NextResponse.json<ApiError>(
      { error: "Lead not found", code: "not_found" },
      { status: 404 }
    );
  }

  const lead = leadRow as Lead;

  // ── Sender profile: who is writing, what they want, who they are writing to ──

  const profile = resolveSenderProfile(workspace);

  if (!isProfileComplete(profile)) {
    return NextResponse.json<ApiError>(
      {
        error: `Complete your profile first. Still missing: ${missingProfileFields(profile).join(", ")}.`,
        code: "profile_incomplete",
      },
      { status: 409 }
    );
  }

  if (!supportsGenerator(profile.goal, type)) {
    const preset = getGoalPreset(profile.goal);
    return NextResponse.json<ApiError>(
      {
        error: `"${type}" is not available for the "${preset.label}" goal.`,
        code: "unsupported_for_goal",
      },
      { status: 400 }
    );
  }

  // ── Playbook: generated for this sender and audience, then cached ───────────

  const playbook = await resolveCampaignPlaybook(
    supabase,
    workspace.id,
    profile,
    lead.niche_id,
    lead.niche_label
  );

  const ctx = { lead, profile, playbook };

  // ── Generate ─────────────────────────────────────────────────────────────────

  try {
    // lead_intel: not stored in DB, returned directly.
    // Refuse un-enriched leads: without enrichment the digital-presence signals
    // are unknown, and the model would otherwise report them as confirmed absent.
    if (type === "lead_intel") {
      if (!lead.enriched_at) {
        return NextResponse.json<ApiError>(
          {
            error: "Enrich this lead before generating AI intelligence.",
            code: "not_enriched",
          },
          { status: 409 }
        );
      }
      const { summary, tokensUsed } = await generateLeadIntel(ctx);
      return NextResponse.json({ summary, tokens_used: tokensUsed });
    }

    // All stored types
    const inserts: Omit<OutreachTemplate, "id" | "created_at">[] = [];

    if (type === "cold_email") {
      const { subject, body: emailBody, tokensUsed } = await generateColdEmail(ctx);
      inserts.push({
        workspace_id: workspace.id,
        lead_id,
        type: "cold_email",
        subject,
        body: emailBody,
        structured_data: null,
        model_used: MODELS.quality,
        tokens_used: tokensUsed,
      });
    } else if (type === "call_script") {
      const { body: scriptBody, tokensUsed } = await generateCallScript(ctx);
      inserts.push({
        workspace_id: workspace.id,
        lead_id,
        type: "call_script",
        subject: null,
        body: scriptBody,
        structured_data: null,
        model_used: MODELS.quality,
        tokens_used: tokensUsed,
      });
    } else if (type === "follow_up") {
      const { sequence, tokensUsed } = await generateFollowUpSequence(
        ctx,
        original_subject!
      );
      const perEmail = Math.round(tokensUsed / 3);
      for (const email of sequence) {
        const dbType =
          email.day === 3
            ? "follow_up_3"
            : email.day === 7
            ? "follow_up_7"
            : "follow_up_14";
        inserts.push({
          workspace_id: workspace.id,
          lead_id,
          type: dbType,
          subject: email.subject,
          body: email.body,
          structured_data: { day: email.day },
          model_used: MODELS.fast,
          tokens_used: perEmail,
        });
      }
    } else if (type === "content_plan") {
      const { plan, tokensUsed } = await generateContentPlan(ctx, { services, duration });
      inserts.push({
        workspace_id: workspace.id,
        lead_id,
        type: "content_plan",
        subject: null,
        body: JSON.stringify(plan),
        structured_data: plan,
        model_used: MODELS.quality,
        tokens_used: tokensUsed,
      });
    } else if (type === "proposal") {
      const { proposal, tokensUsed } = await generateProposal(ctx);
      inserts.push({
        workspace_id: workspace.id,
        lead_id,
        type: "proposal",
        subject: null,
        body: JSON.stringify(proposal),
        structured_data: proposal,
        model_used: MODELS.quality,
        tokens_used: tokensUsed,
      });
    }

    const { data: saved, error: saveError } = await supabase
      .from("outreach_templates")
      .insert(inserts)
      .select();

    if (saveError || !saved) {
      return NextResponse.json<ApiError>(
        { error: "Failed to save generated content", code: "save_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates: saved as OutreachTemplate[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json<ApiError>(
      { error: message, code: "generation_failed" },
      { status: 500 }
    );
  }
}
