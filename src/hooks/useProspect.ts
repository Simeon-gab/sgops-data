"use client";

import { useState, useCallback } from "react";
import type { ProspectRequest, ProspectApiResponse } from "@/lib/utils/types";

export function useProspect() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProspectApiResponse | null>(null);

  const run = useCallback(async (req: ProspectRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setResult(data as ProspectApiResponse);
      return data as ProspectApiResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading, error, result };
}
