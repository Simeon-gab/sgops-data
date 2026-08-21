"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { Campaign } from "@/lib/utils/types";

interface NewCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => Promise<Campaign>;
  onCreated: (campaign: Campaign) => void;
  // Explicit leads, when the campaign is being started from a selection on the
  // leads table. Filters are hidden in that case: the choice was already made.
  leadIds?: string[];
}

// Two ways in. From the campaigns page the list is described by the same
// filters the leads table uses, so "everyone I was just looking at" is one
// step. From a selection on the leads table the ids come in directly.

const TIER_OPTIONS = [
  { value: "",     label: "Any tier" },
  { value: "hot",  label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];

const STAGE_OPTIONS = [
  { value: "",          label: "Any stage" },
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "replied",   label: "Replied" },
  { value: "qualified", label: "Qualified" },
];

export function NewCampaignModal({
  open, onClose, onCreate, onCreated, leadIds,
}: NewCampaignModalProps) {
  const fromSelection = Boolean(leadIds?.length);

  const [name, setName] = useState("");
  const [tier, setTier] = useState("");
  const [stage, setStage] = useState("");
  const [allowGuessed, setAllowGuessed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast("Give the campaign a name", "error");
      return;
    }

    setSaving(true);
    try {
      const campaign = await onCreate({
        name: name.trim(),
        allow_guessed_emails: allowGuessed,
        ...(fromSelection
          ? { lead_ids: leadIds }
          : {
              filters: {
                ...(tier ? { tier } : {}),
                ...(stage ? { stage } : {}),
              },
            }),
      });

      toast("Campaign created", "success");
      onCreated(campaign);
      reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create campaign", "error");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setName("");
    setTier("");
    setStage("");
    setAllowGuessed(false);
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="New campaign"
    >
      <div className="space-y-4">
        <Input
          label="Campaign name"
          value={name}
          placeholder="Q3 outreach, Lagos restaurants"
          onChange={(e) => setName(e.target.value)}
        />

        {fromSelection ? (
          <p className="text-xs text-text-3">
            The <span className="text-text-2">{leadIds?.length} selected leads</span> join this
            campaign, minus any without a mailable address. Nothing sends until you write the
            email and start it.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tier"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                options={TIER_OPTIONS}
              />

              <Select
                label="Stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                options={STAGE_OPTIONS}
              />
            </div>

            <p className="text-xs text-text-3">
              Every lead matching these filters that has a mailable address joins the campaign.
              Nothing sends until you write the email and start it.
            </p>
          </>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={allowGuessed}
            onChange={(e) => setAllowGuessed(e.target.checked)}
            className="mt-0.5 accent-gold"
          />
          <span className="text-xs text-text-3 leading-relaxed">
            Include guessed addresses
            <span className="block text-text-3/70 mt-0.5">
              An address like info@ that was derived from a website and never confirmed to exist.
              These bounce often, and enough bounces get a sending domain blacklisted.
            </span>
          </span>
        </label>

        {allowGuessed && (
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Verify these addresses first if you can. Bounces are counted against your domain,
              not the campaign.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create campaign
          </Button>
        </div>
      </div>
    </Modal>
  );
}
