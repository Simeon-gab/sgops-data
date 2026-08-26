import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { resolveSenderProfile, isProfileComplete } from "@/lib/utils/sender-profile";
import { getGoalPreset, GOAL_PRESETS } from "@/lib/utils/profiles";
import { SCORING_PROFILES } from "@/lib/utils/constants";
import type {
  ApiError,
  OutreachGoal,
  ScoringProfileId,
  SenderTone,
  Workspace,
} from "@/lib/utils/types";

const VALID_GOALS = new Set<string>(GOAL_PRESETS.map((p) => p.goal));
const VALID_TONES = new Set<string>(["direct", "warm", "formal", "casual"]);

const MAX_LENGTHS: Record<string, number> = {
  sender_name: 120,
  sender_role: 160,
  organization: 160,
  offer: 1000,
  audience: 600,
  credibility: 600,
  cta: 200,
};

function str(value: unknown, field: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_LENGTHS[field] ?? 500);
}

// ── GET /api/profile ──────────────────────────────────────────────────────────
// Returns the resolved sender profile plus enough metadata for the UI to render
// onboarding without hardcoding the preset list.

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  const workspace = await getOrCreateWorkspace(supabase, user);
  if (!workspace) {
    return NextResponse.json<ApiError>(
      { error: "Could not initialize workspace", code: "workspace_error" },
      { status: 500 }
    );
  }

  const profile = resolveSenderProfile(workspace);

  return NextResponse.json({
    profile,
    complete: isProfileComplete(profile),
    presets: GOAL_PRESETS,
    scoring_profiles: Object.values(SCORING_PROFILES),
  });
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
// Saves the sender profile. Marks the workspace onboarded once the four fields
// generation depends on are present.

export async function PUT(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json<ApiError>(
      { error: "Unauthorized", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Invalid request body", code: "bad_request" },
      { status: 400 }
    );
  }

  const goalRaw = typeof body.goal === "string" ? body.goal : "";
  if (!VALID_GOALS.has(goalRaw)) {
    return NextResponse.json<ApiError>(
      { error: "Pick what you want to use this for", code: "bad_request" },
      { status: 400 }
    );
  }
  const goal = goalRaw as OutreachGoal;
  const preset = getGoalPreset(goal);

  const senderName = str(body.sender_name, "sender_name");
  const senderRole = str(body.sender_role, "sender_role");
  const offer      = str(body.offer, "offer");
  const audience   = str(body.audience, "audience");

  const missing = [
    !senderName && "your name",
    !senderRole && "what you do",
    !offer      && "what you offer or want",
    !audience   && "who you are reaching out to",
  ].filter(Boolean);

  if (missing.length) {
    return NextResponse.json<ApiError>(
      { error: `Still missing: ${missing.join(", ")}.`, code: "incomplete_profile" },
      { status: 400 }
    );
  }

  const toneRaw = typeof body.tone === "string" ? body.tone : "";
  const tone: SenderTone = VALID_TONES.has(toneRaw)
    ? (toneRaw as SenderTone)
    : preset.default_tone;

  // The goal implies a scoring profile, but an explicit choice always wins.
  const scoringRaw = typeof body.scoring_profile === "string" ? body.scoring_profile : "";
  const scoringProfile: ScoringProfileId =
    scoringRaw in SCORING_PROFILES
      ? (scoringRaw as ScoringProfileId)
      : preset.scoring_profile;

  const updates = {
    goal,
    sender_name: senderName,
    sender_role: senderRole,
    organization: str(body.organization, "organization"),
    offer,
    audience,
    credibility: str(body.credibility, "credibility"),
    cta: str(body.cta, "cta") ?? preset.placeholders.cta,
    tone,
    scoring_profile: scoringProfile,
    onboarded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json<ApiError>(
      { error: "Failed to save profile", code: "update_failed" },
      { status: 500 }
    );
  }

  const profile = resolveSenderProfile(updated as Workspace);

  return NextResponse.json({ profile, complete: isProfileComplete(profile) });
}
