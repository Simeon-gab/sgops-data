"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Campaign, CampaignRecipient, Lead } from "@/lib/utils/types";
import type { RecipientCounts } from "@/lib/campaigns/recipients";

// How often the detail view asks the send worker to do more. Short enough that
// progress looks live, long enough that a campaign throttled to one message a
// minute is not generating a request a second to be told to wait.
const POLL_MS = 5_000;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

// Creating a campaign does not need the campaign list, and the leads page only
// wants this much. Exported on its own so opening that page does not fetch a
// list it will never show.
export async function createCampaign(payload: Record<string, unknown>): Promise<Campaign> {
  const data = await request<{ campaign: Campaign }>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.campaign;
}

// ── List ──────────────────────────────────────────────────────────────────────

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<{ campaigns: Campaign[] }>("/api/campaigns");
      setCampaigns(data.campaigns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const create = useCallback(
    async (payload: Record<string, unknown>) => {
      const campaign = await createCampaign(payload);
      await refetch();
      return campaign;
    },
    [refetch]
  );

  const remove = useCallback(
    async (id: string) => {
      await request(`/api/campaigns/${id}`, { method: "DELETE" });
      await refetch();
    },
    [refetch]
  );

  return { campaigns, loading, error, refetch, create, remove };
}

// ── Detail ────────────────────────────────────────────────────────────────────

export interface Pacing {
  allowed: number;
  reason: "outside_window" | "daily_limit" | "throttled" | null;
  resume_at: string | null;
}

interface DetailResponse {
  campaign: Campaign;
  counts: RecipientCounts;
  sent_today: number;
  pacing: Pacing;
}

export interface PreflightReport {
  sampled: number;
  would_send: number;
  would_skip: number;
  skip_reasons: Record<string, number>;
}

export type RecipientRow = CampaignRecipient & {
  lead?: Pick<Lead, "id" | "name" | "city" | "state" | "niche_label" | "tier" | "score"> | null;
};

export function useCampaign(id: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [counts, setCounts] = useState<RecipientCounts | null>(null);
  const [pacing, setPacing] = useState<Pacing | null>(null);
  const [sentToday, setSentToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // The most recent send error from a poll. A campaign whose every send is
  // failing retryably otherwise looks identical to one that is simply waiting.
  const [sendError, setSendError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const data = await request<DetailResponse>(`/api/campaigns/${id}`);
      setCampaign(data.campaign);
      setCounts(data.counts);
      setPacing(data.pacing);
      setSentToday(data.sent_today);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load campaign");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void refetch(); }, [refetch]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setWorking(true);
      try {
        const data = await request<{ campaign: Campaign; preflight: PreflightReport | null }>(
          `/api/campaigns/${id}`,
          { method: "PATCH", body: JSON.stringify(body) }
        );
        setCampaign(data.campaign);
        await refetch();
        return data;
      } finally {
        setWorking(false);
      }
    },
    [id, refetch]
  );

  // ── The send loop ───────────────────────────────────────────────────────────
  // The worker drains what the pacing rules allow and returns immediately, so
  // the page keeps calling it while the campaign is sending. Nothing is kept in
  // browser state: closing the tab pauses progress, it does not lose it, and a
  // cron hitting the same endpoint resumes exactly where this left off.

  const sending = campaign?.status === "sending";
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!sending) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const result = await request<{
          done: boolean;
          sent: number; skipped: number; failed: number; retrying: number;
          last_error: string | null;
          counts: RecipientCounts | null;
          status: string;
          reason: Pacing["reason"];
          resume_at: string | null;
        }>(`/api/campaigns/${id}/send`, { method: "POST" });

        if (cancelled) return;

        if (result.counts) setCounts(result.counts);

        // Cleared on any successful send, so a one-off failure does not stay
        // on screen once the campaign recovers.
        if (result.sent > 0) setSendError(null);
        else if (result.retrying > 0 || result.failed > 0) setSendError(result.last_error);
        setPacing({ allowed: 0, reason: result.reason, resume_at: result.resume_at });

        if (result.done || result.status !== "sending") {
          await refetch();
          return;
        }
      } catch {
        // A failed tick is not fatal: the next one retries, and the campaign's
        // real state lives in the database either way.
      } finally {
        inFlightRef.current = false;
      }

      if (!cancelled) timerRef.current = setTimeout(tick, POLL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sending, id, refetch]);

  return { campaign, counts, pacing, sentToday, loading, error, working, sendError, refetch, patch };
}

// ── Recipients ────────────────────────────────────────────────────────────────

export function useRecipients(campaignId: string, status?: string) {
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (status) params.set("status", status);

      const data = await request<{ recipients: RecipientRow[]; total: number }>(
        `/api/campaigns/${campaignId}/recipients?${params}`
      );
      setRecipients(data.recipients);
      setTotal(data.total);
    } catch {
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId, status]);

  useEffect(() => { void refetch(); }, [refetch]);

  return { recipients, total, loading, refetch };
}
