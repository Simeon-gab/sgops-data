"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { NewCampaignModal } from "@/components/campaigns/new-campaign-modal";
import { useCampaigns } from "@/hooks/useCampaigns";
import type { Campaign, CampaignStatus } from "@/lib/utils/types";

const STATUS_VARIANT: Record<CampaignStatus, "verified" | "partial" | "unverified" | "warm" | "default"> = {
  draft:     "default",
  scheduled: "partial",
  sending:   "warm",
  paused:    "unverified",
  completed: "verified",
  cancelled: "unverified",
};

export default function CampaignsPage() {
  const router = useRouter();
  const { campaigns, loading, error, create, remove } = useCampaigns();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleDelete(campaign: Campaign) {
    try {
      await remove(campaign.id);
      toast("Campaign deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete campaign", "error");
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-1">Campaigns</h2>
          <p className="text-text-3 mt-1">
            Send one email to a filtered list of leads, paced so it reaches inboxes
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-3">Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <div className="bg-bg-2 border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-3 flex items-center justify-center">
            <Megaphone className="h-8 w-8 text-text-3" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-1">No campaigns yet</h3>
            <p className="text-sm text-text-3 mt-1 max-w-md">
              A campaign takes one email template, fills the merge fields per lead, and sends it
              to a filtered list at a pace inbox providers accept.
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="group bg-bg-2 border border-border rounded-xl p-4 flex items-center gap-4 hover:border-border-hover transition-colors"
            >
              <Link href={`/campaigns/${campaign.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-text-1 truncate">{campaign.name}</span>
                  <Badge variant={STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
                </div>
                <p className="text-xs text-text-3 mt-1">
                  {campaign.sent_count} of {campaign.total_recipients} sent
                  {campaign.skipped_count > 0 && `, ${campaign.skipped_count} skipped`}
                  {campaign.failed_count > 0 && `, ${campaign.failed_count} failed`}
                </p>
              </Link>

              <ProgressRing
                sent={campaign.sent_count}
                total={campaign.total_recipients}
              />

              <button
                onClick={() => handleDelete(campaign)}
                title="Delete campaign"
                className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red-400 transition-all p-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <NewCampaignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={create}
        onCreated={(campaign) => {
          setModalOpen(false);
          router.push(`/campaigns/${campaign.id}`);
        }}
      />
    </div>
  );
}

function ProgressRing({ sent, total }: { sent: number; total: number }) {
  const percent = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <div className="hidden sm:flex items-center gap-2 shrink-0">
      <div className="w-24 h-1.5 rounded-full bg-bg-3 overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-text-3 w-9 text-right">{percent}%</span>
    </div>
  );
}
