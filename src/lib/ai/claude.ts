import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  quality: "claude-sonnet-4-6",
  fast:    "claude-haiku-4-5-20251001",
} as const;

export const TOKEN_BUDGETS = {
  cold_email:        600,
  call_script:       1000,
  follow_up_sequence: 800,
  content_plan:      2500,
  lead_intelligence:  300,
  proposal:          1200,
  batch_email:        500,
} as const;
