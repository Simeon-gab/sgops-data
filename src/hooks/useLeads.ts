"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Lead, LeadFilters } from "@/lib/utils/types";
import { fetchLeadsPage, LEADS_PAGE_SIZE } from "@/lib/utils/fetch-leads";

export function useLeads(autoFetch = false, filters: LeadFilters = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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

  // First page. Replaces whatever is loaded, used on mount and filter changes.
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchLeadsPage(filterString, 0, LEADS_PAGE_SIZE);
      setLeads(page.leads);
      setTotal(page.total);
      setHasMore(page.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filterString]);

  // Appends the next page. The total comes from an exact count, so the UI can
  // always say how many leads exist versus how many are on screen.
  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await fetchLeadsPage(filterString, leads.length, LEADS_PAGE_SIZE);
      // Guard against a lead arriving twice if rows shifted between requests.
      setLeads((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        return [...prev, ...page.leads.filter((l) => !seen.has(l.id))];
      });
      setTotal(page.total);
      setHasMore(page.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingMore(false);
    }
  }, [filterString, leads.length, loading, loadingMore]);

  useEffect(() => {
    if (autoFetch) fetchLeads();
  }, [autoFetch, fetchLeads]);

  return {
    leads,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    refetch: fetchLeads,
  };
}
