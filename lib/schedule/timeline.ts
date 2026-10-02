import { TIME_ZONE, addDays, daysBetween, type IsoDate } from "./dates";
import type { Schedule, Week } from "./types";
import { DAY_NAMES } from "./view";

/**
 * Shifts on one continuous timeline, measured in Athens local minutes since 2000-01-01.
 * Wall-clock arithmetic is what staff mean ("in 3 hours"), so DST is deliberately ignored.
 */

const EPOCH: IsoDate = "2000-01-01";

export type TimedShift = {
  personId: string;
  date: IsoDate;
  start: string;
  end: string;
  startAt: number;
  endAt: number;
  tags: string[];
};

export function localMinute(date: IsoDate, time: string): number {
  const [h, m] = time.split(":").map(Number);
  return daysBetween(EPOCH, date) * 1440 + (h ?? 0) * 60 + (m ?? 0);
}

/** "Now" as Athens wall-clock minutes. */
export function nowInAthens(now: Date = new Date()): { date: IsoDate; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, minute: localMinute(date, `${get("hour")}:${get("minute")}`) };
}

/** Every shift of one person (or everyone, when personId is omitted), in time order. */
export function timedShifts(weeks: Week[], personId?: string): TimedShift[] {
  const out: TimedShift[] = [];
  for (const week of weeks) {
    for (const a of week.assignments) {
      if (a.kind !== "shift" || !a.start || !a.end) continue;
      if (personId && a.personId !== personId) continue;
      const date = addDays(week.monday, a.day);
      const startAt = localMinute(date, a.start);
      let endAt = a.end === "23:59" ? localMinute(date, "24:00") : localMinute(date, a.end);
      if (endAt <= startAt) endAt += 1440;
      out.push({ personId: a.personId, date, start: a.start, end: a.end, startAt, endAt, tags: a.tags });
    }
  }
  return out.sort((a, b) => a.startAt - b.startAt);
}

export type ShiftStatus =
  | { kind: "on"; shift: TimedShift; minutesLeft: number }
  | { kind: "next"; shift: TimedShift; minutesUntil: number }
  | { kind: "none" };

export function shiftStatus(schedule: Pick<Schedule, "weeks">, personId: string, now: { minute: number }): ShiftStatus {
  const shifts = timedShifts(schedule.weeks, personId);
  const current = shifts.find((s) => s.startAt <= now.minute && now.minute < s.endAt);
  if (current) return { kind: "on", shift: current, minutesLeft: current.endAt - now.minute };
  const next = shifts.find((s) => s.startAt > now.minute);
  if (next) return { kind: "next", shift: next, minutesUntil: next.startAt - now.minute };
  return { kind: "none" };
}

/** "σε 45 λεπτά", "σε 3 ώρες", "σε 2 μέρες". */
export function formatIn(minutes: number): string {
  if (minutes < 60) return minutes <= 1 ? "σε 1 λεπτό" : `σε ${minutes} λεπτά`;
  if (minutes < 36 * 60) {
    const hours = Math.round(minutes / 60);
    return hours === 1 ? "σε 1 ώρα" : `σε ${hours} ώρες`;
  }
  const days = Math.round(minutes / 1440);
  return days === 1 ? "σε 1 μέρα" : `σε ${days} μέρες`;
}

/** Time left in a shift: "άλλα 20 λεπτά", "άλλη 1 ώρα", "άλλες 3 ώρες". */
export function formatLeft(minutes: number): string {
  if (minutes < 60) return minutes <= 1 ? "άλλο 1 λεπτό" : `άλλα ${minutes} λεπτά`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "άλλη 1 ώρα" : `άλλες ${hours} ώρες`;
}

/** "σήμερα", "αύριο", or "Σάββατο 3/10". */
export function formatShiftDay(date: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "σήμερα";
  if (diff === 1) return "αύριο";
  const [, m, d] = date.split("-").map(Number);
  const weekday = (new Date(Date.parse(date)).getUTCDay() + 6) % 7;
  return `${DAY_NAMES[weekday]} ${d}/${m}`;
}
