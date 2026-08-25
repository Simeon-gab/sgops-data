import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Integration tests write real rows: campaigns, recipients, leads, sends,
// pipeline activity. They must never touch the project the app is configured
// against, so they run only when pointed at a separate one and refuse when
// that separate one turns out to be the same project.

export interface TestDatabase {
  db: SupabaseClient;
  workspaceId: string;
}

export function integrationTarget(): { ok: true; url: string; key: string } | { ok: false; reason: string } {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return {
      ok: false,
      reason:
        "set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY to a throwaway Supabase project",
    };
  }

  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configured && normalise(configured) === normalise(url)) {
    return {
      ok: false,
      reason:
        "TEST_SUPABASE_URL points at the project the app itself uses; these tests will not write there",
    };
  }

  return { ok: true, url, key };
}

function normalise(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export function testClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

// Every row these tests create carries this, so cleanup can find anything a
// crashed run left behind.
export const TEST_TAG = "__sgops_test__";
