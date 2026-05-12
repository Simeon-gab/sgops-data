"use client";

import { useState, useEffect, useCallback } from "react";
import type { OutreachSend } from "@/lib/utils/types";

export interface OutreachSendWithLead extends OutreachSend {
  leads?: {
    name: string;
    niche_label: string;
    city: string;
  } | null;
}

export function useOutreach() {
  const [sends, setSends] = useState<OutreachSendWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email/sends");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load outreach");
      setSends(data.sends ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const stats = {
    total:     sends.length,
    sent:      sends.filter((s) => ["sent", "delivered", "opened", "clicked"].includes(s.status)).length,
    delivered: sends.filter((s) => ["delivered", "opened", "clicked"].includes(s.status)).length,
    opened:    sends.filter((s) => ["opened", "clicked"].includes(s.status)).length,
    bounced:   sends.filter((s) => ["bounced", "failed"].includes(s.status)).length,
    queued:    sends.filter((s) => s.status === "queued").length,
  };

  return { sends, loading, error, refetch, stats };
}
