"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Lead, LeadFilters } from "@/lib/utils/types";

export function useLeads(autoFetch = false, filters: LeadFilters = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a stable query string so fetchLeads only re-creates when filter values change
  const filterString = useMemo(() => {
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
  // Individual fields as deps so the memo is stable when the filter object reference changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.niche, filters.country, filters.state, filters.city, filters.tier, filters.stage, filters.quality]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/leads${filterString ? `?${filterString}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load leads");
      setLeads(data.leads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filterString]);

  useEffect(() => {
    if (autoFetch) fetchLeads();
  }, [autoFetch, fetchLeads]);

  return { leads, loading, error, refetch: fetchLeads };
}
