export const SELECTION_HOUR_UTC = 10;
export const SELECTION_MINUTE_UTC = 0;
export const WEEKLY_EMAIL_SUBJECT = "Your Scripture for Sunday | Sammy's Bible Sharing";
export const DAILY_EMAIL_SUBJECT = 'A little encouragement for today';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse an ISO date (YYYY-MM-DD) as UTC midnight. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday 00:00:00 UTC of the week containing `date`. */
export function startOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getTime() + diff * DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** ISO-8601 week number (used for a stable cycle id). */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

export function cycleIdFor(date: Date): string {
  const monday = startOfWeekUtc(date);
  const year = monday.getUTCFullYear();
  return `${year}-W${String(isoWeek(monday)).padStart(2, '0')}`;
}

/** The selection moment (Monday 10:00 UTC) that opens the cycle containing `date`. */
export function selectionDateFor(date: Date): Date {
  const monday = startOfWeekUtc(date);
  return new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
      SELECTION_HOUR_UTC,
      SELECTION_MINUTE_UTC,
      0,
      0,
    ),
  );
}

/** The next Monday 10:00 UTC strictly after `now`. */
export function nextSelectionDate(now: Date): Date {
  const thisCycle = selectionDateFor(now);
  if (thisCycle.getTime() > now.getTime()) return thisCycle;
  return addDays(thisCycle, 7);
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function countdownTo(target: Date, now: Date): Countdown {
  const totalMs = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(totalMs / DAY_MS);
  const hours = Math.floor((totalMs % DAY_MS) / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  return { days, hours, minutes, seconds, totalMs };
}

export function formatLongDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date);
}

export function formatShortDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(date);
}

export function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

/** e.g. "Monday, 26 October 2026 · 10:00 GMT" */
export function formatSelectionMoment(date: Date): string {
  return `${new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)} · 10:00 GMT`;
}

export function formatRelativeDay(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return formatLongDate(date, 'UTC');
}

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

/** South African time is UTC+2 with no daylight saving. */
export function southAfricanTimeLabel(hour: number, minute = 0): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  return `${displayHour}:${mm} ${suffix} SAST`;
}

export function isSunday(date: Date): boolean {
  return date.getUTCDay() === 0;
}

export function weekdayName(date: Date): string {
  return new Intl.DateTimeFormat('en-ZA', { weekday: 'long', timeZone: 'UTC' }).format(date);
}

export const WEEK_RHYTHM = [
  {
    day: 'Monday',
    title: 'Receive',
    detail: 'Two different Scriptures are selected and emailed individually at 10:00 AM GMT.',
  },
  {
    day: 'Tuesday — Saturday',
    title: 'Reflect',
    detail: 'Each partner reads their assigned Scripture, writes in their private notebook, and prepares questions.',
  },
  {
    day: 'Sunday',
    title: 'Unpack',
    detail: 'The couple comes together to discuss both passages and their personal reflections.',
  },
] as const;
