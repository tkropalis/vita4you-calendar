import type { Cell, PlainDate } from "../xlsx";

/** ISO calendar date, e.g. "2026-09-28". All schedule dates are plain dates (no time zone). */
export type IsoDate = string;

export const TIME_ZONE = "Europe/Athens";

export function toIso({ y, m, d }: PlainDate): IsoDate {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function fromIso(iso: IsoDate): PlainDate {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

function toUtcMs({ y, m, d }: PlainDate): number {
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): PlainDate {
  const date = new Date(ms);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(fromUtcMs(toUtcMs(fromIso(iso)) + days * 86_400_000));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(fromIso(to)) - toUtcMs(fromIso(from))) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: PlainDate): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: IsoDate): IsoDate {
  return addDays(iso, -weekdayIndex(fromIso(iso)));
}

function isValidDate(date: PlainDate): boolean {
  if (date.m < 1 || date.m > 12 || date.d < 1 || date.d > 31) return false;
  const back = fromUtcMs(toUtcMs(date));
  return back.y === date.y && back.m === date.m && back.d === date.d;
}

/** Today's date in Athens. */
export function todayInAthens(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/**
 * Every plausible calendar date a header cell might mean.
 *
 * The rota's date row is typed by hand and arrives in many shapes: "29/09",
 * "17/8/2026", "18/82026" (missing slash), "16/9//2026", "0406/2026",
 * "8/2/1/2026", and real date cells that Google parsed month-first
 * ("1/9" → 9 January). We return all readings and let weekday voting decide.
 */
export function dateCandidates(cell: Cell | undefined, contextYears: number[]): PlainDate[] {
  if (!cell) return [];
  if (cell.kind === "date") {
    const { y, m, d } = cell.date;
    const out: PlainDate[] = [{ y, m, d }];
    if (d <= 12 && d !== m) out.push({ y, m: d, d: m });
    return out.filter(isValidDate);
  }
  if (cell.kind !== "text") return [];

  const groups = cell.text.match(/\d+/g);
  if (!groups || groups.length === 0) return [];

  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;

  const [first, second, third] = groups;
  if (!first) return [];
  if (first.length === 4 && first.startsWith("20") && second && third) {
    // ISO-like "2026-06-04"
    year = Number(first);
    month = Number(second);
    day = Number(third);
  } else if (first.length === 4) {
    // "0406/2026" → day 04, month 06
    day = Number(first.slice(0, 2));
    month = Number(first.slice(2));
  } else if (first.length <= 2) {
    day = Number(first);
    if (second !== undefined) {
      if (second.length <= 2) {
        month = Number(second);
      } else if (second.length >= 5 && second.length <= 6) {
        // "82026" / "052026" → month glued to the year
        month = Number(second.slice(0, second.length - 4));
        year = Number(second.slice(-4));
      }
    }
  }

  const yearGroup = groups.slice(1).find((g) => g.length === 4 && g.startsWith("20"));
  if (yearGroup) year = Number(yearGroup);
  else if (year === undefined) {
    const shortYear = groups.slice(2).find((g) => g.length === 2);
    if (shortYear) year = 2000 + Number(shortYear);
  }

  if (day === undefined || month === undefined) return [];
  const years = year !== undefined ? [year] : contextYears;
  const out: PlainDate[] = [];
  for (const y of years) {
    out.push({ y, m: month, d: day });
    if (day <= 12 && day !== month) out.push({ y, m: day, d: month });
  }
  return out.filter(isValidDate);
}

/** True when a cell could only be read with an explicit year (used to seed year inference). */
export function cellHasExplicitYear(cell: Cell | undefined): boolean {
  if (!cell) return false;
  if (cell.kind === "date") return true;
  if (cell.kind !== "text") return false;
  return /20\d\d/.test(cell.text);
}
