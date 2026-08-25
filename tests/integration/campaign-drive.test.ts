import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { driveCampaign } from "@/lib/campaigns/worker";
import { encryptSecrets } from "@/lib/sending/crypto";
import type { Campaign, Workspace } from "@/lib/utils/types";
import { startSmtpServer } from "../helpers/smtp-server";
import { integrationTarget, testClient, TEST_TAG } from "../helpers/supabase";

// A campaign drained end to end: identity, decrypted credentials, the SMTP
// conversation, the send log, and the pipeline bookkeeping that follows.
//
// The mail server is a socket on localhost that discards everything, so no
// message leaves the machine even though the send path is entirely real.

const target = integrationTarget();

if (!target.ok) {
  test("campaign drive (integration)", { skip: target.reason }, () => {});
} else {
  process.env.SENDING_SECRET_KEY ??= randomBytes(32).toString("hex");
  process.env.SMTP_ALLOW_PRIVATE_HOSTS = "true";

  const db = testClient(target.url, target.key);

  test("drives a campaign over SMTP and records what happened", async (t) => {
    const { data: ws } = await db.from("workspaces").select("*").limit(1).maybeSingle();
    assert.ok(ws, "the test project needs at least one workspace");
    const workspace = ws as Workspace;

    const server = await startSmtpServer();
    const created: { campaigns: string[]; identities: string[]; leads: string[] } =
      { campaigns: [], identities: [], leads: [] };

    t.after(async () => {
      await server.stop();
      if (created.campaigns.length) await db.from("campaigns").delete().in("id", created.campaigns);
      if (created.identities.length) await db.from("sending_identities").delete().in("id", created.identities);
      if (created.leads.length) {
        await db.from("outreach_sends").delete().in("lead_id", created.leads);
        await db.from("pipeline_activities").delete().in("lead_id", created.leads);
        await db.from("leads").delete().in("id", created.leads);
      }
    });

    // ── Throwaway leads, on a domain that cannot resolve ─────────────────────

    const { data: leads, error: leadError } = await db.from("leads").insert(
      [1, 2].map((n) => ({
        workspace_id: workspace.id,
        name: `Test Hospital ${n}`,
        email: `test${n}@sgops-test.invalid`,
        email_status: "verified",
        email_verified: true,
        city: "Lagos",
        stage: "new",
        duplicate_hash: `${TEST_TAG}_${n}`,
      }))
    ).select();
    assert.equal(leadError, null, leadError?.message);
    created.leads = (leads ?? []).map((l: { id: string }) => l.id);

    // ── A mailbox of the workspace's own ────────────────────────────────────

    const { data: identity, error: identityError } = await db.from("sending_identities").insert({
      workspace_id: workspace.id,
      kind: "smtp",
      from_email: "mary@sgops-test.invalid",
      from_name: "Mary Test",
      is_default: false,
      secrets: encryptSecrets({
        host: "127.0.0.1", port: String(server.port), user: "mary", pass: "secret",
      }),
    }).select().single();
    assert.equal(identityError, null, identityError?.message);
    created.identities = [identity!.id];

    const { data: campaignRow } = await db.from("campaigns").insert({
      workspace_id: workspace.id,
      name: `${TEST_TAG} drive`,
      status: "sending",
      subject_template: "Role at {{company}}",
      body_template: "Hello,\n\nI am a Medical Laboratory Scientist in {{city}}.\n\nMary",
      from_email: "mary@sgops-test.invalid",
      from_name: "Mary Test",
      sending_identity_id: identity!.id,
      daily_limit: 50,
      throttle_seconds: 0,
      // No window, so this does not only pass between 08:00 and 18:00.
      send_window_start: null,
      send_window_end: null,
      allow_guessed_emails: true,
      include_unsubscribe: true,
    }).select().single();
    const campaign = campaignRow as Campaign;
    created.campaigns = [campaign.id];

    const { error: recipientError } = await db.from("campaign_recipients").insert(
      created.leads.map((id, i) => ({
        campaign_id: campaign.id,
        workspace_id: workspace.id,
        lead_id: id,
        to_email: `test${i + 1}@sgops-test.invalid`,
        status: "pending",
      }))
    ).select();
    assert.equal(recipientError, null, recipientError?.message);

    // ── Drive ───────────────────────────────────────────────────────────────

    const result = await driveCampaign(db, {
      campaign, workspace,
      actorId: workspace.owner_id,
      origin: "https://example.invalid",
      deadline: Date.now() + 25_000,
    });

    assert.equal(result.error ?? null, null);
    assert.equal(result.sent, 2);
    assert.equal(result.skipped, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.retrying, 0);
    assert.equal(result.lastError, null);
    assert.equal(result.status, "completed");

    // ── What actually went over the wire ────────────────────────────────────

    assert.equal(server.received.length, 2);
    for (const message of server.received) {
      assert.match(message, /mary@sgops-test\.invalid/, "sent from the identity, not the fallback");
      assert.match(message, /Lagos/, "merge fields were filled");
      assert.match(message, /\/api\/unsubscribe/, "opt-out link present");
      assert.match(message, /List-Unsubscribe/, "opt-out header present");
    }
    assert.ok(
      server.received.some((m) => m.includes("Test Hospital 1")),
      "each recipient got their own lead's details"
    );

    // ── And what was written down ───────────────────────────────────────────

    const { data: sends } = await db.from("outreach_sends")
      .select("status, resend_id").in("lead_id", created.leads);
    assert.equal(sends?.length, 2);
    assert.ok(sends!.every((s) => s.status === "sent"));
    assert.ok(sends!.every((s) => Boolean(s.resend_id)), "the provider's id is stored");

    const { data: recipients } = await db.from("campaign_recipients")
      .select("status, send_id, sent_at").eq("campaign_id", campaign.id);
    assert.ok(recipients!.every((r) => r.status === "sent" && r.send_id && r.sent_at));

    const { data: after } = await db.from("leads").select("stage").in("id", created.leads);
    assert.ok(after!.every((l) => l.stage === "contacted"), "leads advanced in the pipeline");

    const { data: activities } = await db.from("pipeline_activities")
      .select("type").in("lead_id", created.leads);
    assert.equal(activities?.length, 2);
  });

  test("a mail server that rejects the login is reported, not silently retried", async (t) => {
    const { data: ws } = await db.from("workspaces").select("*").limit(1).maybeSingle();
    const workspace = ws as Workspace;

    const server = await startSmtpServer({ rejectAuth: true });
    const created: { campaigns: string[]; identities: string[]; leads: string[] } =
      { campaigns: [], identities: [], leads: [] };

    t.after(async () => {
      await server.stop();
      if (created.campaigns.length) await db.from("campaigns").delete().in("id", created.campaigns);
      if (created.identities.length) await db.from("sending_identities").delete().in("id", created.identities);
      if (created.leads.length) {
        await db.from("outreach_sends").delete().in("lead_id", created.leads);
        await db.from("pipeline_activities").delete().in("lead_id", created.leads);
        await db.from("leads").delete().in("id", created.leads);
      }
    });

    const { data: leads } = await db.from("leads").insert([{
      workspace_id: workspace.id,
      name: "Test Hospital F",
      email: "testf@sgops-test.invalid",
      email_status: "verified", email_verified: true,
      city: "Lagos", stage: "new",
      duplicate_hash: `${TEST_TAG}_f`,
    }]).select();
    created.leads = (leads ?? []).map((l: { id: string }) => l.id);

    const { data: identity } = await db.from("sending_identities").insert({
      workspace_id: workspace.id, kind: "smtp",
      from_email: "maryf@sgops-test.invalid", from_name: "Mary Test",
      is_default: false,
      secrets: encryptSecrets({
        host: "127.0.0.1", port: String(server.port), user: "mary", pass: "wrong",
      }),
    }).select().single();
    created.identities = [identity!.id];

    const { data: campaignRow } = await db.from("campaigns").insert({
      workspace_id: workspace.id,
      name: `${TEST_TAG} failure`,
      status: "sending",
      subject_template: "Role at {{company}}",
      body_template: "Hello from {{city}}.",
      from_email: "maryf@sgops-test.invalid",
      sending_identity_id: identity!.id,
      daily_limit: 50, throttle_seconds: 0,
      send_window_start: null, send_window_end: null,
      allow_guessed_emails: true, include_unsubscribe: true,
    }).select().single();
    const campaign = campaignRow as Campaign;
    created.campaigns = [campaign.id];

    await db.from("campaign_recipients").insert([{
      campaign_id: campaign.id, workspace_id: workspace.id, lead_id: created.leads[0],
      to_email: "testf@sgops-test.invalid", status: "pending",
    }]).select();

    const result = await driveCampaign(db, {
      campaign, workspace, actorId: workspace.owner_id,
      origin: "https://example.invalid", deadline: Date.now() + 25_000,
    });

    // The bug this guards: sent 0 / failed 0 / no reason reads as "nothing
    // happened", which on the campaign page is indistinguishable from a
    // campaign quietly waiting out its throttle.
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 0, "not given up while retries remain");
    assert.equal(result.retrying, 1);
    assert.ok(result.lastError, "the failure is reported");
    assert.match(result.lastError!, /credentials/i);
    assert.equal(result.status, "sending", "not marked complete");

    // The recipient stays queued rather than being dropped off the list.
    const { data: recipients } = await db.from("campaign_recipients")
      .select("status, attempts, last_error").eq("campaign_id", campaign.id);
    assert.equal(recipients?.[0].status, "pending");
    assert.equal(recipients?.[0].attempts, 1);
    assert.ok(recipients?.[0].last_error);

    // Nothing may reach the send log or the pipeline on a failed send.
    const { count: sends } = await db.from("outreach_sends")
      .select("id", { count: "exact", head: true }).in("lead_id", created.leads);
    assert.equal(sends, 0);

    const { data: after } = await db.from("leads").select("stage").in("id", created.leads);
    assert.equal(after?.[0].stage, "new", "the lead was not advanced");
  });
}
