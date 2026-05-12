"use client";

import { useState, useEffect } from "react";
import { Settings, Building2, Image } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Workspace } from "@/lib/utils/types";

export default function SettingsPage() {
  const [workspace, setWorkspace]       = useState<Workspace | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  const [agencyName,  setAgencyName]    = useState("");
  const [agencyEmail, setAgencyEmail]   = useState("");
  const [agencyPhone, setAgencyPhone]   = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then(({ workspace: ws }: { workspace: Workspace }) => {
        setWorkspace(ws);
        setAgencyName(ws.agency_name   ?? "");
        setAgencyEmail(ws.agency_email  ?? "");
        setAgencyPhone(ws.agency_phone  ?? "");
        setAgencyWebsite(ws.agency_website ?? "");
        setPortfolioUrl(ws.agency_portfolio_url ?? "");
      })
      .catch(() => toast("Failed to load settings", "error"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_name:          agencyName,
          agency_email:         agencyEmail,
          agency_phone:         agencyPhone,
          agency_website:       agencyWebsite,
          agency_portfolio_url: portfolioUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setWorkspace(data.workspace);
      toast("Settings saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-1">Settings</h2>
        <p className="text-text-3 mt-1">Manage your agency profile and workspace</p>
      </div>

      {/* Agency profile card */}
      <div className="bg-bg-2 border border-border rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gold-dim flex items-center justify-center">
            <Building2 className="h-4 w-4 text-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-1">Agency Profile</h3>
            <p className="text-xs text-text-3">Used in generated outreach and proposals</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 bg-bg-3 rounded animate-pulse" />
                <div className="h-10 w-full bg-bg-3 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Input
              label="Agency name"
              placeholder="Creative Co."
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Agency email"
                type="email"
                placeholder="hello@agency.com"
                value={agencyEmail}
                onChange={(e) => setAgencyEmail(e.target.value)}
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={agencyPhone}
                onChange={(e) => setAgencyPhone(e.target.value)}
              />
            </div>
            <Input
              label="Website"
              type="url"
              placeholder="https://agency.com"
              value={agencyWebsite}
              onChange={(e) => setAgencyWebsite(e.target.value)}
            />
            <Input
              label="Portfolio URL"
              type="url"
              placeholder="https://agency.com/work"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              hint="Included in cold email CTAs"
            />

            <div className="flex items-center justify-between pt-2">
              {workspace && (
                <p className="text-xs text-text-3">
                  Workspace: <span className="text-text-2">{workspace.name}</span>
                </p>
              )}
              <Button type="submit" loading={saving} className="ml-auto">
                Save changes
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Placeholder sections */}
      {[
        { icon: Settings, title: "Integrations", desc: "Connect Google Places, SerpAPI, Hunter.io" },
        { icon: Image,    title: "Branding",     desc: "Upload your logo for proposals and emails" },
      ].map(({ icon: Icon, title, desc }) => (
        <div key={title} className="bg-bg-2 border border-border rounded-2xl p-6 mb-4 opacity-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-bg-3 flex items-center justify-center">
              <Icon className="h-4 w-4 text-text-3" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-2">{title}</h3>
              <p className="text-xs text-text-3">{desc} (coming soon)</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
