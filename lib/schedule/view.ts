import { addDays, fromIso, mondayOf, type IsoDate } from "./dates";
import type { Assignment, Person, Schedule, Week } from "./types";

/** People seen within this many weeks (counting back from the current week) are "current staff". */
export const CURRENT_STAFF_WEEKS = 6;
/** How many past weeks the site keeps in reach. */
export const WEEKS_BACK = 8;

export const DAY_NAMES = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"];
export const DAY_SHORT = ["Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"];
const MONTHS_GENITIVE = [
  "Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου",
  "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου",
];
const MONTHS_SHORT = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];

export type ShiftPeriod = "morning" | "afternoon" | "duty";

export type DayEntry = Assignment & {
  /** Scheduled minutes, null when the time is missing or implausible. */
  minutes: number | null;
  period?: ShiftPeriod;
  /** Other people on the same shift that day. */
  coworkers: string[];
};

export type DayStatus = "work" | "off" | "leave" | "note" | "none";

export type PersonDay = {
  index: number;
  date: IsoDate;
  entries: DayEntry[];
  status: DayStatus;
};

export type WeekSummary = {
  offDays: number[];
  leaveDays: number[];
  sunday: DayEntry[];
  totalMinutes: number;
  shiftCount: number;
  /** True when some shift has no usable time, so the total is a lower bound. */
  totalIncomplete: boolean;
};

export function currentMonday(today: IsoDate): IsoDate {
  return mondayOf(today);
}

export function findWeek(schedule: Schedule, monday: IsoDate): Week | undefined {
  return schedule.weeks.find((w) => w.monday === monday);
}

/** Current staff for the name picker, alphabetical. */
export function currentStaff(people: Person[], today: IsoDate): Person[] {
  const cutoff = addDays(currentMonday(today), -7 * (CURRENT_STAFF_WEEKS - 1));
  return people.filter((p) => p.lastSeen >= cutoff);
}

/** Keeps only the weeks the site exposes: a few weeks back, plus everything ahead. */
export function windowWeeks(schedule: Schedule, today: IsoDate): Schedule {
  const from = addDays(currentMonday(today), -7 * WEEKS_BACK);
  const weeks = schedule.weeks.filter((w) => w.monday >= from);
  const present = new Set(weeks.flatMap((w) => w.assignments.map((a) => a.personId)));
  return { weeks, people: schedule.people.filter((p) => present.has(p.id)) };
}

export function minutesOf(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const s = toMin(start);
  let e = end === "23:59" ? 24 * 60 : toMin(end);
  if (e <= s) e += 24 * 60;
  const span = e - s;
  return span > 0 && span <= 16 * 60 ? span : null;
}

export function periodOf(entry: Pick<Assignment, "start" | "tags">): ShiftPeriod {
  if (entry.tags.some((t) => t === "Εφημερία" || t === "Ολονυχτία")) return "duty";
  const hour = Number(entry.start?.slice(0, 2) ?? 0);
  if (hour >= 16 || hour < 6) return "duty";
  return hour < 12 ? "morning" : "afternoon";
}

export const PERIOD_LABEL: Record<ShiftPeriod, string> = {
  morning: "Πρωινή",
  afternoon: "Απογευματινή",
  duty: "Βραδινή",
};

export function personWeek(week: Week | undefined, monday: IsoDate, personId: string, names: Map<string, string>): PersonDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const mine = week?.assignments.filter((a) => a.personId === personId && a.day === index) ?? [];
    const entries: DayEntry[] = mine
      .map((a) => toEntry(a, week!, names))
      .sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));
    return { index, date, entries, status: statusOf(entries) };
  });
}

function toEntry(a: Assignment, week: Week, names: Map<string, string>): DayEntry {
  const isShift = a.kind === "shift";
  const coworkers = isShift
    ? week.assignments
        .filter(
          (o) =>
            o.personId !== a.personId &&
            o.day === a.day &&
            o.kind === "shift" &&
            o.start === a.start &&
            o.end === a.end,
        )
        .map((o) => names.get(o.personId) ?? o.personId)
        .filter((name, i, all) => all.indexOf(name) === i)
        .sort((x, y) => x.localeCompare(y, "el"))
    : [];
  return {
    ...a,
    minutes: isShift ? minutesOf(a.start, a.end) : null,
    period: isShift ? periodOf(a) : undefined,
    coworkers,
  };
}

function statusOf(entries: DayEntry[]): DayStatus {
  if (entries.some((e) => e.kind === "shift")) return "work";
  if (entries.some((e) => e.kind === "off")) return "off";
  if (entries.some((e) => e.kind === "leave")) return "leave";
  if (entries.some((e) => e.kind === "note")) return "note";
  return "none";
}

export function summarize(days: PersonDay[]): WeekSummary {
  const shifts = days.flatMap((d) => d.entries.filter((e) => e.kind === "shift"));
  return {
    offDays: days.filter((d) => d.entries.some((e) => e.kind === "off")).map((d) => d.index),
    leaveDays: days.filter((d) => d.entries.some((e) => e.kind === "leave")).map((d) => d.index),
    sunday: days[6]?.entries.filter((e) => e.kind === "shift") ?? [],
    totalMinutes: shifts.reduce((sum, e) => sum + (e.minutes ?? 0), 0),
    shiftCount: shifts.length,
    totalIncomplete: shifts.some((e) => e.minutes === null),
  };
}

/** A per-day signature, used to highlight what changed after a refresh. */
export function daySignature(day: PersonDay): string {
  return day.entries
    .map((e) => [e.kind, e.start, e.end, e.label, e.tags.join("+"), e.coworkers.join("+")].join("|"))
    .join(";");
}

export type TeamRow = { person: Person; days: DayEntry[][] };

export function teamWeek(week: Week | undefined, monday: IsoDate, people: Person[]): TeamRow[] {
  if (!week) return [];
  const names = new Map(people.map((p) => [p.id, p.name]));
  const ids = new Set(week.assignments.map((a) => a.personId));
  return people
    .filter((p) => ids.has(p.id))
    .map((person) => ({
      person,
      days: personWeek(week, monday, person.id, names).map((d) => d.entries),
    }));
}

/* ---------- Formatting (deterministic, so server and client render identically) ---------- */

export function formatDayMonth(iso: IsoDate, style: "short" | "long" = "short"): string {
  const { m, d } = fromIso(iso);
  return style === "long" ? `${d} ${MONTHS_GENITIVE[m - 1]}` : `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatWeekRange(monday: IsoDate): string {
  const sunday = addDays(monday, 6);
  const a = fromIso(monday);
  const b = fromIso(sunday);
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTHS_SHORT[b.m - 1]}`;
  return `${a.d} ${MONTHS_SHORT[a.m - 1]} – ${b.d} ${MONTHS_SHORT[b.m - 1]}`;
}

export function relativeWeekLabel(monday: IsoDate, today: IsoDate): string {
  const diff = Math.round((Date.parse(monday) - Date.parse(currentMonday(today))) / (7 * 86_400_000));
  if (diff === 0) return "Αυτή την εβδομάδα";
  if (diff === 1) return "Την επόμενη εβδομάδα";
  if (diff === -1) return "Την προηγούμενη εβδομάδα";
  return diff > 0 ? `Σε ${diff} εβδομάδες` : `Πριν από ${-diff} εβδομάδες`;
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0$/, "").replace(".", ",");
  return `${text} ${hours === 1 ? "ώρα" : "ώρες"}`;
}

export function formatTimeRange(start?: string, end?: string): string {
  if (!start || !end) return "";
  return `${start} – ${end}`;
}

export function initials(name: string): string {
  const parts = name.replace(/\./g, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
