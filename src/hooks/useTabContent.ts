"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { OutreachTemplate } from "@/lib/utils/types";

interface TabContentState {
  templates: OutreachTemplate[];
  loading: boolean;
  error: string | null;
}

// Generic hook for cold_email, call_script, content_plan, proposal tabs.
// Checks cache first; generates on miss. Use regenerate() to force a fresh call.
export function useTabContent(leadId: string, type: string) {
  const [state, setState] = useState<TabContentState>({
    templates: [],
    loading: true,
    error: null,
  });

  // Prevent re-running on every render
  const loadedRef = useRef(false);

  const load = useCallback(
    async (forceGenerate = false) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        if (!forceGenerate) {
          const cacheRes = await fetch(
            `/api/templates?lead_id=${leadId}&type=${type}`
          );
          if (cacheRes.ok) {
            const cacheData = await cacheRes.json();
            if ((cacheData.templates ?? []).length > 0) {
              setState({ templates: cacheData.templates, loading: false, error: null });
              loadedRef.current = true;
              return;
            }
          }
        }

        // Generate fresh
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, type }),
        });
        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.error ?? "Generation failed");

        setState({
          templates: genData.templates ?? [],
          loading: false,
          error: null,
        });
        loadedRef.current = true;
      } catch (err) {
        setState({
          templates: [],
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [leadId, type]
  );

  useEffect(() => {
    load();
  }, [load]);

  return {
    templates: state.templates,
    loading: state.loading,
    error: state.error,
    regenerate: () => load(true),
  };
}
