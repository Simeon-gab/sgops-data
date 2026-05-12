import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlaybook } from "@/lib/ai/playbooks";
import type { PlaybookData } from "@/lib/ai/playbooks";
import {
  generateColdEmail,
  generateCallScript,
  generateFollowUpSequence,
  generateContentPlan,
  generateProposal,
  generateLeadIntel,
} from "@/lib/ai/generators";
import { MODELS } from "@/lib/ai/claude";
import type { Lead, OutreachTemplate, ApiError } from "@/lib/utils/types";

// ── Request body ──────────────────────────────────────────────────────────────

type GenerateType =
  | "cold_email"
  | "call_script"
  | "follow_up"
  | "content_plan"
  | "proposal"
  | "lead_intel";

interface GenerateBody {
  lead_id: string;
  type: GenerateType;
  original_subject?: string;
}

// ── POST /api/generate ─────────────────────────────────────────────────────────
// Body: { lead_id, type, original_subject? }
// Returns: { templates } for stored types, { summary, tokens_used } for lead_intel

export async function POST(req: NextRequest) {
  const supabase = createClient();

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

  const { lead_id, type, original_subject } = body;

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

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, agency_name, agency_portfolio_url")
    .eq("owner_id", user.id)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json<ApiError>(
      { error: "Workspace not found", code: "workspace_not_found" },
      { status: 404 }
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

  // ── Playbook: workspace-specific override first, then in-memory default ──────

  const { data: dbPlaybook } = await supabase
    .from("niche_playbooks")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("niche_id", lead.niche_id)
    .maybeSingle();

  const defaultPlaybook: PlaybookData = getPlaybook(lead.niche_id) ?? {
    niche_id:   lead.niche_id,
    niche_label: lead.niche_label,
    pain_points: `${lead.niche_label} businesses looking to grow their digital presence`,
    content_angles: ["Video content showcasing their services and expertise"],
    hook: "Your competitors have professional video content. You do not. We fix that.",
    objection_responses: {},
    pricing_tiers: {
      starter: { description: "Single shoot day, 8 deliverables", price_range: "$1,500-$2,500" },
      growth:  { description: "Monthly retainer, 20 deliverables", price_range: "$2,500-$4,000/mo" },
      premium: { description: "Full content partnership", price_range: "$5,000-$8,000/mo" },
    },
  };

  const playbook: PlaybookData = dbPlaybook
    ? {
        niche_id:   dbPlaybook.niche_id,
        niche_label: dbPlaybook.niche_label,
        pain_points: dbPlaybook.pain_points,
        content_angles: dbPlaybook.content_angles,
        hook: dbPlaybook.hook,
        objection_responses: dbPlaybook.objection_responses as Record<string, string>,
        pricing_tiers: dbPlaybook.pricing_tiers as PlaybookData["pricing_tiers"],
      }
    : defaultPlaybook;

  const ctx = {
    lead,
    playbook,
    agencyName: workspace.agency_name ?? "Our Agency",
    portfolioUrl: workspace.agency_portfolio_url,
  };

  // ── Generate ─────────────────────────────────────────────────────────────────

  try {
    // lead_intel: not stored in DB, returned directly
    if (type === "lead_intel") {
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
      const { plan, tokensUsed } = await generateContentPlan(ctx);
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
