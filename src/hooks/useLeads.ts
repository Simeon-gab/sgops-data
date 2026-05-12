"use client";

import { useState, useCallback, useEffect } from "react";
import type { Lead } from "@/lib/utils/types";

export function useLeads(autoFetch = false) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (autoFetch) fetchLeads();
  }, [autoFetch, fetchLeads]);

  return { leads, loading, error, refetch: fetchLeads };
}
