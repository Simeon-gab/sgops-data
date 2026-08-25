"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Star, Trash2, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import type { SendingIdentityPublic } from "@/lib/utils/types";

// Which mailbox this workspace's outreach leaves from.
//
// Today every identity is delivered by the platform's own Resend account, so
// the only thing being captured here is the address and name. The point is
// that campaigns already resolve through it, so connecting a workspace's own
// mailbox later is a transport, not a migration.

export function SendingIdentities() {
  const [identities, setIdentities] = useState<SendingIdentityPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sending-identities");
      const data = await res.json();
      if (res.ok) setIdentities(data.identities ?? []);
    } catch {
      // Leaving the list empty is the honest rendering of "could not load".
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!fromEmail.includes("@")) {
      toast("Enter a valid sending address", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sending-identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "resend",
          from_email: fromEmail.trim(),
          from_name: fromName.trim() || undefined,
          reply_to: replyTo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add identity");

      toast("Sending identity added", "success");
      setFromEmail(""); setFromName(""); setReplyTo("");
      setAdding(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add identity", "error");
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(id: string) {
    try {
      const res = await fetch(`/api/sending-identities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not set default", "error");
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/sending-identities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast("Sending identity removed", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove identity", "error");
    }
  }

  return (
    <div className="bg-bg-2 border border-border rounded-2xl p-6 mb-4">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gold-dim flex items-center justify-center">
          <Send className="h-4 w-4 text-gold" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-text-1">Sending</h3>
          <p className="text-xs text-text-3">
            The address your campaigns and outreach are sent from
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        )}
      </div>

      {loading ? (
        <div className="h-16 bg-bg-3 rounded-lg animate-pulse" />
      ) : identities.length === 0 && !adding ? (
        <div className="text-xs text-text-3 leading-relaxed">
          No sending identity yet. Campaigns fall back to the address on the campaign itself,
          delivered by the platform. Add one to set a single address for every campaign.
        </div>
      ) : (
        <div className="space-y-2">
          {identities.map((identity) => (
            <div
              key={identity.id}
              className="group flex items-center gap-3 p-3 rounded-lg bg-bg-3 border border-transparent hover:border-border transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-1 truncate">
                    {identity.from_name
                      ? `${identity.from_name} <${identity.from_email}>`
                      : identity.from_email}
                  </span>
                  {identity.is_default && <Badge variant="verified">default</Badge>}
                  {identity.has_credentials && (
                    <span title="Sends through this workspace's own credentials">
                      <ShieldCheck className="h-3.5 w-3.5 text-text-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-3 mt-0.5">
                  via {identity.kind}
                  {identity.reply_to && `, replies to ${identity.reply_to}`}
                </p>
              </div>

              {!identity.is_default && (
                <button
                  onClick={() => makeDefault(identity.id)}
                  title="Make default"
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-text-3 hover:text-gold transition-all"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => remove(identity.id)}
                title="Remove"
                className="opacity-0 group-hover:opacity-100 p-1.5 text-text-3 hover:text-red-400 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From address"
              type="email"
              placeholder="you@yourdomain.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
            <Input
              label="From name"
              placeholder="Your Name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </div>
          <Input
            label="Reply-to"
            type="email"
            placeholder="Optional, defaults to the from address"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />

          <p className="text-xs text-text-3 leading-relaxed">
            This domain must be verified in the platform&apos;s Resend account before anything
            you send from it will be delivered.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={create} loading={saving}>
              Add identity
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
