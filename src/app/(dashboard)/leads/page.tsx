"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, Download, X } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { BatchSendBar } from "@/components/outreach/batch-send-bar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { toast } from "@/components/ui/toast";
import { NICHES, PIPELINE_STAGES } from "@/lib/utils/constants";
import type { Lead, LeadFilters } from "@/lib/utils/types";

const INPUT_CLS =
  "bg-bg-2 border border-border rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-3 " +
  "focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors";

const SELECT_CLS =
  "appearance-none bg-bg-2 border border-border rounded-lg pl-3 pr-7 py-2 text-sm text-text-1 " +
  "focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-colors cursor-pointer";

export default function LeadsPage() {
  // Raw text input values (debounced before being applied as filters)
  const [rawSearch,  setRawSearch]  = useState("");
  const [rawCountry, setRawCountry] = useState("");
  const [rawState,   setRawState]   = useState("");
  const [rawCity,    setRawCity]    = useState("");

  // Instant (non-debounced) select filters
  const [niche,   setNiche]   = useState("");
  const [tier,    setTier]    = useState("");
  const [stage,   setStage]   = useState("");
  const [quality, setQuality] = useState("");

  // Debounced filters sent to the hook / API
  const [filters, setFilters] = useState<LeadFilters>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        q:       rawSearch  || undefined,
        country: rawCountry || undefined,
        state:   rawState   || undefined,
        city:    rawCity    || undefined,
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [rawSearch, rawCountry, rawState, rawCity]);

  // Apply select filters immediately
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      niche:   niche   || undefined,
      tier:    tier    || undefined,
      stage:   stage   || undefined,
      quality: quality || undefined,
    }));
  }, [niche, tier, stage, quality]);

  const { leads, loading, error, refetch } = useLeads(true, filters);

  const hasActiveFilters = !!(rawSearch || rawCountry || rawState || rawCity || niche || tier || stage || quality);

  function clearFilters() {
    setRawSearch("");
    setRawCountry("");
    setRawState("");
    setRawCity("");
    setNiche("");
    setTier("");
    setStage("");
    setQuality("");
  }

  // Build export URL from current filters
  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q)       params.set("q",       filters.q);
    if (filters.niche)   params.set("niche",   filters.niche);
    if (filters.country) params.set("country", filters.country);
    if (filters.state)   params.set("state",   filters.state);
    if (filters.city)    params.set("city",    filters.city);
    if (filters.tier)    params.set("tier",    filters.tier);
    if (filters.stage)   params.set("stage",   filters.stage);
    if (filters.quality) params.set("quality", filters.quality);
    return params.toString();
  }, [filters]);

  async function handleExport() {
    try {
      const url = `/api/leads/export${exportParams ? `?${exportParams}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `sgops-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast("Export failed", "error");
    }
  }

  // Table selection state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedLeads = leads.filter((l) => selectedIds.has(l.id));

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
    setSelectedIds(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }, [leads, selectedIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-1">Leads</h2>
          <p className="text-text-3 mt-1 text-sm">
            {loading
              ? "Loading..."
              : `${leads.length} lead${leads.length !== 1 ? "s" : ""}${hasActiveFilters ? " (filtered)" : " in your workspace"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {leads.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border text-text-3 hover:text-text-1 hover:border-border-hover transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span> CSV
            </button>
          )}
          <Link
            href="/prospect"
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-gold text-bg-0 font-medium hover:bg-gold-bright transition-colors"
          >
            <Search className="h-4 w-4" />
            New search
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-bg-2 border border-border rounded-xl p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {/* Text search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3 pointer-events-none" />
            <input
              type="search"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Search businesses..."
              className={`${INPUT_CLS} pl-8 w-full`}
            />
          </div>

          {/* Niche */}
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All niches</option>
            {NICHES.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>

          {/* Tier */}
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Any tier</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>

          {/* Quality */}
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Any quality</option>
            <option value="verified">Verified</option>
            <option value="partial">Partial</option>
            <option value="unverified">Unverified</option>
          </select>

          {/* Stage */}
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          {/* Location text inputs */}
          <input
            type="text"
            value={rawCountry}
            onChange={(e) => setRawCountry(e.target.value)}
            placeholder="Country"
            className={`${INPUT_CLS} w-28`}
          />
          <input
            type="text"
            value={rawState}
            onChange={(e) => setRawState(e.target.value)}
            placeholder="State"
            className={`${INPUT_CLS} w-24`}
          />
          <input
            type="text"
            value={rawCity}
            onChange={(e) => setRawCity(e.target.value)}
            placeholder="City"
            className={`${INPUT_CLS} w-24`}
          />

          {/* Clear button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-3 hover:text-text-1 hover:bg-bg-3 border border-border transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={refetch} className="text-xs text-red-400 underline mt-1">
            Retry
          </button>
        </div>
      )}

      {/* Empty states */}
      {!loading && leads.length === 0 && !error && !hasActiveFilters && (
        <div className="bg-bg-2 border border-border rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-bg-3 flex items-center justify-center">
            <Search className="h-8 w-8 text-text-3" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-1">No leads yet</h3>
            <p className="text-sm text-text-3 mt-1 max-w-md">
              Run a prospect search to start building your leads database.
            </p>
          </div>
          <Link
            href="/prospect"
            className="px-5 py-2.5 rounded-lg bg-gold text-bg-0 font-medium text-sm hover:bg-gold-bright transition-colors"
          >
            Start prospecting
          </Link>
        </div>
      )}

      {!loading && leads.length === 0 && !error && hasActiveFilters && (
        <div className="bg-bg-2 border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-3">
          <p className="text-sm font-medium text-text-1">No leads match your filters</p>
          <button
            onClick={clearFilters}
            className="text-sm text-gold hover:text-gold-bright transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {(loading || leads.length > 0) && (
        <LeadTable
          leads={leads}
          loading={loading}
          onSelect={setSelectedLead}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onToggleAll={handleToggleAll}
        />
      )}

      <ErrorBoundary label="Lead detail panel">
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onLeadUpdated={(updated) => setSelectedLead(updated)}
        />
      </ErrorBoundary>

      {selectedIds.size > 0 && (
        <BatchSendBar
          selectedLeads={selectedLeads}
          onClear={clearSelection}
          onSent={refetch}
        />
      )}
    </div>
  );
}
