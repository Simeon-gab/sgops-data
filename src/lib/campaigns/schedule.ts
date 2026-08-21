// Send pacing: when a campaign is allowed to send, and how many messages are
// left in today's budget.
//
// Everything is computed in the campaign's own timezone. A campaign set to send
// between 08:00 and 18:00 means the recipient's working day, not the server's,
// and "today" for the daily limit has to mean the same day the user sees.

export interface WindowSettings {
  send_window_start: string | null;
  send_window_end:   string | null;
  timezone:          string;
}

interface ZonedParts {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
}

// An unknown timezone throws inside Intl, which would take the whole send down.
// Falling back to UTC keeps the campaign sending on a sane schedule instead.
function safeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

export function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timezone),
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year:   get("year"),
    month:  get("month"),
    day:    get("day"),
    hour:   get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// How far the zone is from UTC at a given instant, DST included.
function zoneOffsetMs(date: Date, timezone: string): number {
  const p = zonedParts(date, timezone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - date.getTime();
}

// The UTC instant at which the given wall-clock time occurs in the zone.
// Applied twice because the offset used for the first guess is the offset at
// the wrong instant whenever the guess lands on the far side of a DST change.
export function zonedTimeToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number,
  timezone: string
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(naive - zoneOffsetMs(new Date(naive), timezone));
  instant = new Date(naive - zoneOffsetMs(instant, timezone));
  return instant;
}

// "HH:MM" or "HH:MM:SS" to minutes past midnight. null when unparseable, which
// callers read as "no boundary set".
export function parseClock(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isWithinWindow(now: Date, settings: WindowSettings): boolean {
  const start = parseClock(settings.send_window_start);
  const end   = parseClock(settings.send_window_end);

  // No window, or a degenerate one, means send around the clock.
  if (start === null || end === null || start === end) return true;

  const p = zonedParts(now, settings.timezone);
  const current = p.hour * 60 + p.minute;

  // A window that ends before it starts wraps past midnight.
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

// When sending may resume. Returns now if the window is already open.
export function nextWindowOpen(now: Date, settings: WindowSettings): Date {
  if (isWithinWindow(now, settings)) return now;

  const start = parseClock(settings.send_window_start);
  if (start === null) return now;

  const p = zonedParts(now, settings.timezone);
  const current = p.hour * 60 + p.minute;

  const startHour = Math.floor(start / 60);
  const startMin  = start % 60;

  // Before today's opening: it opens later today. Otherwise tomorrow.
  if (current < start) {
    return zonedTimeToUtc(p.year, p.month, p.day, startHour, startMin, settings.timezone);
  }

  const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day) + 86_400_000);
  const t = { year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate() };
  return zonedTimeToUtc(t.year, t.month, t.day, startHour, startMin, settings.timezone);
}

// The instant the campaign's current local day began, for counting sends
// against the daily limit.
export function startOfLocalDay(now: Date, timezone: string): Date {
  const p = zonedParts(now, timezone);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, timezone);
}

export type PauseReason = "outside_window" | "daily_limit" | "throttled";

export interface Allowance {
  // How many messages may be sent right now. Zero means wait.
  allowed: number;
  reason?: PauseReason;
  // When the next send becomes possible. Undefined when sending may proceed.
  resumeAt?: Date;
}

export interface AllowanceInput {
  now: Date;
  settings: WindowSettings;
  dailyLimit: number;
  sentToday: number;
  throttleSeconds: number;
  lastSentAt: Date | null;
  pendingCount: number;
}

export function computeAllowance(input: AllowanceInput): Allowance {
  const { now, settings, dailyLimit, sentToday, throttleSeconds, lastSentAt } = input;

  if (!isWithinWindow(now, settings)) {
    return { allowed: 0, reason: "outside_window", resumeAt: nextWindowOpen(now, settings) };
  }

  const remainingToday = Math.max(0, dailyLimit - sentToday);
  if (remainingToday === 0) {
    // The budget refills when the campaign's local day rolls over.
    const tomorrow = new Date(startOfLocalDay(now, settings.timezone).getTime() + 86_400_000);
    return {
      allowed: 0,
      reason: "daily_limit",
      resumeAt: nextWindowOpen(tomorrow, settings),
    };
  }

  if (lastSentAt && throttleSeconds > 0) {
    const nextAt = new Date(lastSentAt.getTime() + throttleSeconds * 1000);
    if (nextAt > now) {
      return { allowed: 0, reason: "throttled", resumeAt: nextAt };
    }
  }

  return { allowed: Math.min(remainingToday, input.pendingCount) };
}
