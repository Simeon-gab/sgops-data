"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Star, Trash2, Plus, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import type { SendingIdentityPublic, TransportKind } from "@/lib/utils/types";

// Which mailbox this workspace's outreach leaves from.
//
// Two shapes. The platform delivers it, which needs nothing but an address on
// a domain the platform has verified. Or the workspace's own mail server does,
// which needs credentials but makes the message genuinely come from the user
// and keeps their sending reputation their own.

const KIND_OPTIONS = [
  { value: "resend", label: "Send through the platform" },
  { value: "smtp",   label: "Send through my own mail server" },
];

// Saves the user a trip to a help page for the two cases almost everyone has.
const PRESETS: Record<string, { host: string; port: string; note: string }> = {
  "gmail.com":   { host: "smtp.gmail.com",         port: "587", note: "Gmail needs an app password, not your account password. Two-step verification must be on to create one." },
  "googlemail.com": { host: "smtp.gmail.com",      port: "587", note: "Gmail needs an app password, not your account password." },
  "outlook.com": { host: "smtp-mail.outlook.com",  port: "587", note: "Outlook needs an app password when two-step verification is on." },
  "hotmail.com": { host: "smtp-mail.outlook.com",  port: "587", note: "Outlook needs an app password when two-step verification is on." },
  "yahoo.com":   { host: "smtp.mail.yahoo.com",    port: "587", note: "Yahoo needs an app password generated from account security." },
};

export function SendingIdentities() {
  const [identities, setIdentities] = useState<SendingIdentityPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(true);

  const [kind, setKind] = useState<TransportKind>("resend");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sending-identities");
      const data = await res.json();
      if (res.ok) {
        setIdentities(data.identities ?? []);
        setEncryptionReady(data.encryption_ready !== false);
      }
    } catch {
      // Leaving the list empty is the honest rendering of "could not load".
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Filling in the server details for a known provider the moment the address
  // makes it obvious which one it is.
  function onEmailChange(value: string) {
    setFromEmail(value);

    const domain = value.split("@")[1]?.trim().toLowerCase();
    const preset = domain ? PRESETS[domain] : undefined;

    if (preset && kind === "smtp") {
      if (!host) setHost(preset.host);
      if (port === "587") setPort(preset.port);
      if (!smtpUser) setSmtpUser(value.trim());
    }
  }

  const presetNote = PRESETS[fromEmail.split("@")[1]?.trim().toLowerCase() ?? ""]?.note;

  function reset() {
    setKind("resend");
    setFromEmail(""); setFromName(""); setReplyTo("");
    setHost(""); setPort("587"); setSmtpUser(""); setSmtpPass("");
    setAdding(false);
  }

  async function create() {
    if (!fromEmail.includes("@")) {
      toast("Enter a valid sending address", "error");
      return;
    }

    if (kind === "smtp" && (!host.trim() || !smtpUser.trim() || !smtpPass)) {
      toast("A mail server needs a host, username and password", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/sending-identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          from_email: fromEmail.trim(),
          from_name: fromName.trim() || undefined,
          reply_to: replyTo.trim() || undefined,
          secrets:
            kind === "smtp"
              ? { host: host.trim(), port: port.trim(), user: smtpUser.trim(), pass: smtpPass }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add identity");

      toast("Sending identity added", "success");
      const created = data.identity?.id as string | undefined;
      reset();
      await load();

      // Proving the credentials now, while the person who typed them is still
      // looking at the screen.
      if (created && kind === "smtp") await verify(created, { quiet: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add identity", "error");
    } finally {
      setSaving(false);
    }
  }

  async function verify(id: string, options: { quiet?: boolean } = {}) {
    setVerifying(id);
    try {
      const res = await fetch(`/api/sending-identities/${id}/verify`, { method: "POST" });
      const data = await res.json();

      if (data.verified) toast("Mail server connected", "success");
      else if (data.checked === false && !options.quiet) toast(data.message ?? "Nothing to check", "info");
      else if (!data.verified) toast(data.error ?? "Could not connect", "error");

      await load();
    } catch {
      toast("Could not reach the mail server", "error");
    } finally {
      setVerifying(null);
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
          delivered by the platform. Add one to send from a single address, or from your own
          mailbox.
        </div>
      ) : (
        <div className="space-y-2">
          {identities.map((identity) => (
            <div
              key={identity.id}
              className="group flex items-center gap-3 p-3 rounded-lg bg-bg-3 border border-transparent hover:border-border transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-text-1 truncate">
                    {identity.from_name
                      ? `${identity.from_name} <${identity.from_email}>`
                      : identity.from_email}
                  </span>
                  {identity.is_default && <Badge variant="verified">default</Badge>}
                  {identity.status === "verified" && (
                    <span title={`Connected ${identity.verified_at?.slice(0, 10) ?? ""}`}>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    </span>
                  )}
                  {identity.status === "failed" && (
                    <span title={identity.last_error ?? "Connection failed"}>
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    </span>
                  )}
                  {identity.has_credentials && (
                    <span title="Sends through this workspace's own credentials">
                      <ShieldCheck className="h-3.5 w-3.5 text-text-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-3 mt-0.5 truncate">
                  {identity.kind === "smtp" ? "your mail server" : "the platform"}
                  {identity.reply_to && `, replies to ${identity.reply_to}`}
                  {identity.status === "failed" && identity.last_error && `, ${identity.last_error}`}
                </p>
              </div>

              {identity.kind === "smtp" && (
                <button
                  onClick={() => verify(identity.id)}
                  disabled={verifying === identity.id}
                  className="text-xs px-2 py-1 rounded-md border border-border text-text-3 hover:text-text-1 hover:border-border-hover transition-colors disabled:opacity-40"
                >
                  {verifying === identity.id ? "Testing" : "Test"}
                </button>
              )}
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
          <Select
            label="How should this send?"
            value={kind}
            onChange={(e) => setKind(e.target.value as TransportKind)}
            options={KIND_OPTIONS}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From address"
              type="email"
              placeholder="you@yourdomain.com"
              value={fromEmail}
              onChange={(e) => onEmailChange(e.target.value)}
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

          {kind === "smtp" ? (
            !encryptionReady ? (
              <Notice tone="warn">
                Credentials cannot be stored yet: SENDING_SECRET_KEY is not configured on the
                server. Until it is, only platform sending is available.
              </Notice>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Input
                      label="SMTP host"
                      placeholder="smtp.gmail.com"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Port"
                    inputMode="numeric"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    hint="587, or 465 for TLS"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Username"
                    placeholder="you@yourdomain.com"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                  />
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                  />
                </div>

                {presetNote && <Notice tone="info">{presetNote}</Notice>}

                <Notice tone="info">
                  Sending from your own mailbox means bounces come back to that inbox rather
                  than to us, so bounced addresses are not added to your suppression list
                  automatically. Watch your inbox and add them by hand.
                </Notice>
              </>
            )
          ) : (
            <Notice tone="info">
              This domain must be verified in the platform&apos;s Resend account before anything
              sent from it will be delivered.
            </Notice>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={create}
              loading={saving}
              disabled={kind === "smtp" && !encryptionReady}
            >
              Add identity
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  const style =
    tone === "warn"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
      : "text-text-3 bg-bg-3 border-border";

  return (
    <p className={`text-xs leading-relaxed border rounded-lg px-3 py-2 ${style}`}>{children}</p>
  );
}
