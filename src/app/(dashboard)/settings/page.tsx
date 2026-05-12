"use client";

import { useState } from "react";
import { Settings, Building2, Globe, Phone, Mail, Image } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [agencyEmail, setAgencyEmail] = useState("");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // Will be wired to Supabase in Phase 6
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
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

          <div className="flex justify-end mt-2">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </div>

      {/* Placeholder sections */}
      {[
        { icon: Settings, title: "Integrations", desc: "Connect Google Places, SerpAPI, Hunter.io" },
        { icon: Image, title: "Branding", desc: "Upload your logo for proposals and emails" },
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
