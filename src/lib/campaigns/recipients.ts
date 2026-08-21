import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign, Lead } from "@/lib/utils/types";
import { loadSuppressions, screenAddress, type SkipReason } from "./eligibility";

// Turning a set of leads into a recipient list.
//
// Screening happens here on addresses alone. Templates are still being edited
// while recipients are chosen, so the message itself is rendered later, when
// the campaign starts. What the user needs at this point is an honest count:
// four hundred leads selected, three hundred and twelve actually mailable.

export interface AddResult {
  added: number;
  // Leads left out, counted by why. Reasons with no occurrences are omitted.
  skipped: Partial<Record<SkipReason, number>>;
  skipped_total: number;
  // A few examples per reason, so the UI can name names instead of only counts.
  examples: Partial<Record<SkipReason, string[]>>;
}

const EXAMPLES_PER_REASON = 5;
const INSERT_CHUNK = 500;

export async function addRecipients(
  supabase: SupabaseClient,
  campaign: Campaign,
  leads: Lead[]
): Promise<AddResult> {
  const suppressed = await loadSuppressions(supabase, campaign.workspace_id);
  const options = { allowGuessed: campaign.allow_guessed_emails, suppressed };

  const skipped: Partial<Record<SkipReason, number>> = {};
  const examples: Partial<Record<SkipReason, string[]>> = {};
  const rows: Record<string, unknown>[] = [];

  // Two leads can carry the same address, and the campaign mails an address
  // once. Deduping here rather than leaning on the unique index keeps the
  // skipped count honest about what happened.
  const seen = new Set<string>();

  const note = (reason: SkipReason, label: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
    const bucket = examples[reason] ?? (examples[reason] = []);
    if (bucket.length < EXAMPLES_PER_REASON) bucket.push(label);
  };

  for (const lead of leads) {
    const screen = screenAddress(lead, options);
    if (!screen.ok) {
      note(screen.reason, lead.name);
      continue;
    }
    if (seen.has(screen.email)) {
      note("duplicate_email", lead.name);
      continue;
    }
    seen.add(screen.email);

    rows.push({
      campaign_id:  campaign.id,
      workspace_id: campaign.workspace_id,
      lead_id:      lead.id,
      to_email:     screen.email,
      status:       "pending",
    });
  }

  let added = 0;

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);

    // ignoreDuplicates so re-adding an overlapping selection tops up the list
    // instead of failing outright on addresses already in the campaign.
    const { data, error } = await supabase
      .from("campaign_recipients")
      .upsert(chunk, { onConflict: "campaign_id,to_email", ignoreDuplicates: true })
      .select("id");

    if (error) throw new Error(error.message);

    const inserted = data?.length ?? 0;
    added += inserted;

    const alreadyPresent = chunk.length - inserted;
    if (alreadyPresent > 0) {
      skipped.duplicate_email = (skipped.duplicate_email ?? 0) + alreadyPresent;
    }
  }

  await syncRecipientCounts(supabase, campaign.id);

  const skipped_total = Object.values(skipped).reduce((sum, n) => sum + (n ?? 0), 0);
  return { added, skipped, skipped_total, examples };
}

export interface RecipientCounts {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function countRecipients(
  supabase: SupabaseClient,
  campaignId: string
): Promise<RecipientCounts> {
  const counts: RecipientCounts = {
    total: 0, pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0,
  };

  // One head request per status rather than pulling every row back to count in
  // JS, which is what made the dashboard stop being correct past a thousand rows.
  const statuses = ["pending", "sending", "sent", "failed", "skipped"] as const;

  await Promise.all(
    statuses.map(async (status) => {
      const { count } = await supabase
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", status);
      counts[status] = count ?? 0;
    })
  );

  counts.total = counts.pending + counts.sending + counts.sent + counts.failed + counts.skipped;
  return counts;
}

// Recomputes the campaign's denormalized counters from the recipient rows.
// Derived rather than incremented, so concurrent worker invocations cannot
// drift the totals away from what the recipient list actually says.
export async function syncRecipientCounts(
  supabase: SupabaseClient,
  campaignId: string
): Promise<RecipientCounts> {
  const counts = await countRecipients(supabase, campaignId);

  await supabase
    .from("campaigns")
    .update({
      total_recipients: counts.total,
      sent_count:       counts.sent,
      failed_count:     counts.failed,
      skipped_count:    counts.skipped,
    })
    .eq("id", campaignId);

  return counts;
}
