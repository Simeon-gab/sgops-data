import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAllowance,
  isWithinWindow,
  nextWindowOpen,
  parseClock,
  startOfLocalDay,
} from "@/lib/campaigns/schedule";

// Send pacing. Every value here is a fixed instant rather than "now", because a
// test that only passes between 08:00 and 18:00 is worse than no test.

const lagos = { send_window_start: "08:00", send_window_end: "18:00", timezone: "Africa/Lagos" };
const newYork = { send_window_start: "08:00", send_window_end: "18:00", timezone: "America/New_York" };

test("send window, in the campaign's own timezone", () => {
  // Lagos is UTC+1 all year. 10:00 UTC is 11:00 local.
  assert.equal(isWithinWindow(new Date("2026-08-21T10:00:00Z"), lagos), true);
  assert.equal(isWithinWindow(new Date("2026-08-21T06:00:00Z"), lagos), false, "07:00 local is before opening");
  assert.equal(isWithinWindow(new Date("2026-08-21T18:00:00Z"), lagos), false, "19:00 local is after closing");
});

test("window boundaries are inclusive at the start and exclusive at the end", () => {
  assert.equal(isWithinWindow(new Date("2026-08-21T07:00:00Z"), lagos), true, "exactly 08:00 local");
  assert.equal(isWithinWindow(new Date("2026-08-21T17:00:00Z"), lagos), false, "exactly 18:00 local");
});

test("a window that ends before it starts wraps past midnight", () => {
  const overnight = { send_window_start: "22:00", send_window_end: "06:00", timezone: "UTC" };
  assert.equal(isWithinWindow(new Date("2026-08-21T23:00:00Z"), overnight), true);
  assert.equal(isWithinWindow(new Date("2026-08-21T03:00:00Z"), overnight), true);
  assert.equal(isWithinWindow(new Date("2026-08-21T12:00:00Z"), overnight), false);
});

test("no window means send around the clock", () => {
  const none = { send_window_start: null, send_window_end: null, timezone: "UTC" };
  assert.equal(isWithinWindow(new Date("2026-08-21T03:00:00Z"), none), true);
});

test("an unknown timezone falls back rather than throwing", () => {
  // Intl throws on a bad zone, which would otherwise take down the whole drain.
  assert.equal(isWithinWindow(new Date("2026-08-21T10:00:00Z"), { ...lagos, timezone: "Not/AZone" }), true);
});

test("next opening is later today, or tomorrow", () => {
  assert.equal(
    nextWindowOpen(new Date("2026-08-21T06:00:00Z"), lagos).toISOString(),
    "2026-08-21T07:00:00.000Z"
  );
  assert.equal(
    nextWindowOpen(new Date("2026-08-21T18:00:00Z"), lagos).toISOString(),
    "2026-08-22T07:00:00.000Z"
  );
});

test("the local day starts where the user thinks it does", () => {
  // Midnight in Lagos is 23:00 UTC the day before, and the daily limit has to
  // count against the day the user sees.
  assert.equal(
    startOfLocalDay(new Date("2026-08-21T10:00:00Z"), "Africa/Lagos").toISOString(),
    "2026-08-20T23:00:00.000Z"
  );
});

test("daylight saving is handled on both sides of the shift", () => {
  // 2026-03-08 is the US spring-forward. Before it New York is UTC-5, after
  // it UTC-4, and the naive offset would be wrong on one side.
  assert.equal(
    startOfLocalDay(new Date("2026-03-08T06:30:00Z"), "America/New_York").toISOString(),
    "2026-03-08T05:00:00.000Z"
  );
  assert.equal(
    startOfLocalDay(new Date("2026-03-09T12:00:00Z"), "America/New_York").toISOString(),
    "2026-03-09T04:00:00.000Z"
  );
  assert.equal(
    nextWindowOpen(new Date("2026-03-09T06:00:00Z"), newYork).toISOString(),
    "2026-03-09T12:00:00.000Z"
  );
});

test("clock parsing accepts HH:MM and HH:MM:SS, rejects nonsense", () => {
  assert.equal(parseClock("08:00"), 480);
  assert.equal(parseClock("18:30:00"), 1110);
  assert.equal(parseClock("bad"), null);
  assert.equal(parseClock("99:00"), null);
  assert.equal(parseClock(null), null);
});

// ── Allowance ────────────────────────────────────────────────────────────────

const base = { settings: lagos, dailyLimit: 50, throttleSeconds: 90, pendingCount: 100 };
const inWindow = new Date("2026-08-21T10:00:00Z");

test("allows the day's remaining budget when nothing is in the way", () => {
  const result = computeAllowance({ ...base, now: inWindow, sentToday: 0, lastSentAt: null });
  assert.equal(result.allowed, 50);
  assert.equal(result.reason, undefined);
});

test("never allows more than there are recipients waiting", () => {
  const result = computeAllowance({ ...base, now: inWindow, sentToday: 0, lastSentAt: null, pendingCount: 7 });
  assert.equal(result.allowed, 7);
});

test("stops at the daily limit and resumes when the local day rolls over", () => {
  const result = computeAllowance({ ...base, now: inWindow, sentToday: 50, lastSentAt: null });
  assert.equal(result.allowed, 0);
  assert.equal(result.reason, "daily_limit");
  // Tomorrow's opening, not right now, and not midnight.
  assert.equal(result.resumeAt?.toISOString(), "2026-08-22T07:00:00.000Z");
});

test("holds the throttle between messages", () => {
  const tooSoon = computeAllowance({
    ...base, now: inWindow, sentToday: 1,
    lastSentAt: new Date(inWindow.getTime() - 30_000),
  });
  assert.equal(tooSoon.reason, "throttled");

  const elapsed = computeAllowance({
    ...base, now: inWindow, sentToday: 1,
    lastSentAt: new Date(inWindow.getTime() - 91_000),
  });
  assert.equal(elapsed.allowed, 49);
});

test("being outside the window beats every other reason", () => {
  const result = computeAllowance({
    ...base, now: new Date("2026-08-21T20:00:00Z"), sentToday: 0, lastSentAt: null,
  });
  assert.equal(result.reason, "outside_window");
});
