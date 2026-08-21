import type { Lead } from "@/lib/utils/types";
import { render } from "@/lib/utils/merge-fields";

// Who is safe to mail, and why someone was left out.
//
// The same rules run twice: once when recipients are added, so the user sees
// the damage before committing, and once inside the send worker, because a
// suppression can land after a campaign starts. The second pass is the one
// that protects the sending domain; the first only protects the user's time.

export type SkipReason =
  | "no_email"
  | "invalid_email"
  | "guessed_email"
  | "suppressed"
  | "unresolved_fields"
  | "empty_body"
  | "duplicate_email";

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  no_email:          "No email address",
  invalid_email:     "Address confirmed not to exist",
  guessed_email:     "Address was guessed, never confirmed",
  suppressed:        "Unsubscribed, bounced or complained",
  unresolved_fields: "Template has merge fields this lead cannot fill",
  empty_body:        "Rendered message was empty",
  duplicate_email:   "Address already in this campaign",
};

export interface EligibilityOptions {
  allowGuessed: boolean;
  // Lowercased addresses that must never be mailed.
  suppressed: Set<string>;
}

export interface RenderedMessage {
  subject: string;
  body: string;
}

export type Screened =
  | { ok: true;  lead: Lead; email: string; message: RenderedMessage }
  | { ok: false; lead: Lead; email: string | null; reason: SkipReason; detail?: string };

// Address checks only. Used when building a recipient list before templates
// are final, so the count of mailable leads is known during the draft.
export function screenAddress(
  lead: Lead,
  options: EligibilityOptions
): { ok: true; email: string } | { ok: false; reason: SkipReason } {
  const email = lead.email?.trim().toLowerCase() ?? "";
  if (!email) return { ok: false, reason: "no_email" };

  if (lead.email_status === "invalid") return { ok: false, reason: "invalid_email" };
  if (lead.email_status === "guessed" && !options.allowGuessed) {
    return { ok: false, reason: "guessed_email" };
  }
  if (options.suppressed.has(email)) return { ok: false, reason: "suppressed" };

  return { ok: true, email };
}

// Address checks plus a full render of the templates. A template that leaves a
// placeholder unfilled is refused rather than sent with a hole in it: merge
// fields fail per lead, so this catches the twenty leads missing a city rather
// than blocking the other four hundred.
export function screen(
  lead: Lead,
  subjectTemplate: string,
  bodyTemplate: string,
  options: EligibilityOptions
): Screened {
  const address = screenAddress(lead, options);
  if (!address.ok) {
    return { ok: false, lead, email: lead.email ?? null, reason: address.reason };
  }

  const subject = render(subjectTemplate, lead);
  const body    = render(bodyTemplate, lead);

  const unresolved = Array.from(new Set([...subject.unresolved, ...body.unresolved]));
  if (unresolved.length > 0) {
    return {
      ok: false,
      lead,
      email: address.email,
      reason: "unresolved_fields",
      detail: unresolved.join(", "),
    };
  }

  if (!subject.text.trim() || !body.text.trim()) {
    return { ok: false, lead, email: address.email, reason: "empty_body" };
  }

  return {
    ok: true,
    lead,
    email: address.email,
    message: { subject: subject.text.trim(), body: body.text },
  };
}

// Both the workspace's own suppressions and the global ones, which apply
// everywhere because a hard bounce damages reputation shared across senders.
export async function loadSuppressions(
  supabase: { from: (t: string) => any },
  workspaceId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("suppressions")
    .select("email")
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);

  const set = new Set<string>();
  for (const row of (data ?? []) as { email: string }[]) {
    set.add(row.email.trim().toLowerCase());
  }
  return set;
}
