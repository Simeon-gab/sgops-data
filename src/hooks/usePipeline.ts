"use client";

import { useState, useCallback, useEffect } from "react";
import type { Lead, PipelineStage } from "@/lib/utils/types";

export interface PipelineGroups {
  new: Lead[];
  contacted: Lead[];
  responded: Lead[];
  meeting: Lead[];
  proposal: Lead[];
  closed: Lead[];
  lost: Lead[];
}

export function usePipeline() {
  const [leads, setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load leads");
      setLeads(data.leads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Optimistically update a single lead in local state
  const updateLead = useCallback((updated: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === updated.id ? updated : l))
    );
  }, []);

  // Group leads by pipeline stage
  const groups: PipelineGroups = {
    new:       leads.filter((l) => l.stage === "new"),
    contacted: leads.filter((l) => l.stage === "contacted"),
    responded: leads.filter((l) => l.stage === "responded"),
    meeting:   leads.filter((l) => l.stage === "meeting"),
    proposal:  leads.filter((l) => l.stage === "proposal"),
    closed:    leads.filter((l) => l.stage === "closed"),
    lost:      leads.filter((l) => l.stage === "lost"),
  };

  // Stats
  const total  = leads.length;
  const closed = groups.closed.length;
  const lost   = groups.lost.length;
  const active = total - closed - lost;
  const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

  return {
    leads,
    groups,
    loading,
    error,
    refetch: fetchLeads,
    updateLead,
    stats: { total, active, closed, lost, conversionRate },
  };
}

// Standalone helper used in the lead detail panel
export async function patchLead(
  id: string,
  body: { stage?: PipelineStage; notes?: string }
): Promise<Lead> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Update failed");
  return data.lead as Lead;
}
