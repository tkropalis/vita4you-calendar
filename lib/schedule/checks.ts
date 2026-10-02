import { addDays, daysBetween, type IsoDate } from "./dates";
import { timedShifts } from "./timeline";
import type { Person, Schedule } from "./types";
import { DAY_NAMES, formatHours, minutesOf } from "./view";

/**
 * Problems worth fixing in the rota, for whoever maintains the sheet.
 * Working-time checks are indicative only: they flag patterns to look at, not legal findings.
 */

export type IssueSeverity = "error" | "warning" | "info";

export type Issue = {
  severity: IssueSeverity;
  week: IsoDate;
  /** 1-based sheet row, when one row is responsible. */
  row?: number;
  title: string;
  detail: string;
};

/** Minimum rest between two shifts, in minutes (11 hours). */
export const MIN_REST = 11 * 60;
/** More than this many working days in a row is flagged. */
export const MAX_DAYS_IN_A_ROW = 6;
/** Weekly hours above this are noted. */
export const WEEKLY_HOURS_NOTE = 40 * 60;

export function sheetIssues(schedule: Schedule, from: IsoDate): Issue[] {
  const issues: Issue[] = [];
  const weeks = schedule.weeks.filter((w) => w.monday >= from);
  const names = new Map(schedule.people.map((p) => [p.id, p.name]));
  const name = (id: string) => names.get(id) ?? id;
  const weekOf = (date: IsoDate) => addDays(date, -((new Date(Date.parse(date)).getUTCDay() + 6) % 7));
  const dayLabel = (date: IsoDate) => {
    const [, m, d] = date.split("-").map(Number);
    return `${DAY_NAMES[(new Date(Date.parse(date)).getUTCDay() + 6) % 7]} ${d}/${m}`;
  };

  for (const week of weeks) {
    // What the parser had to guess
    for (const w of week.warnings) {
      if (w.type === "duplicate") {
        issues.push({
          severity: "error",
          week: week.monday,
          row: week.headerRow,
          title: "Η εβδομάδα υπάρχει δύο φορές",
          detail: `Γραμμές ${w.otherRow} και ${week.headerRow}. Εμφανίζεται η νεότερη· σβήσε ή διόρθωσε την άλλη.`,
        });
      } else if (w.type === "times-inferred") {
        for (const row of w.rows) {
          issues.push({
            severity: "warning",
            week: week.monday,
            row,
            title: "Λείπει η ώρα",
            detail: `Η γραμμή ${row} έχει ονόματα αλλά όχι ώρα στη στήλη H. Θεωρήθηκε ίδια με τη γραμμή από πάνω.`,
          });
        }
      } else {
        issues.push({
          severity: "warning",
          week: week.monday,
          row: week.headerRow,
          title: "Οι ημερομηνίες δεν διαβάζονται",
          detail: `Οι ημερομηνίες κάτω από τη γραμμή ${week.headerRow} δεν ταιριάζουν με τις μέρες. Η εβδομάδα υπολογίστηκε από τη σειρά.`,
        });
      }
    }

    // Per person, per day
    const people = new Set(week.assignments.map((a) => a.personId));
    for (const personId of people) {
      const mine = week.assignments.filter((a) => a.personId === personId);
      const workDays = new Set(mine.filter((a) => a.kind === "shift").map((a) => a.day));
      for (let day = 0; day < 7; day++) {
        const kinds = new Set(mine.filter((a) => a.day === day).map((a) => a.kind));
        if (kinds.has("shift") && (kinds.has("off") || kinds.has("leave"))) {
          issues.push({
            severity: "error",
            week: week.monday,
            row: mine.find((a) => a.day === day && a.kind !== "shift")?.row,
            title: `${name(personId)}: βάρδια και ${kinds.has("off") ? "ρεπό" : "άδεια"} την ίδια μέρα`,
            detail: `${dayLabel(addDays(week.monday, day))}.`,
          });
        }
      }
      if (workDays.size >= 6) {
        issues.push({
          severity: "warning",
          week: week.monday,
          title: `${name(personId)}: ${workDays.size} μέρες εργασίας`,
          detail: "Δεν έχει ρεπό μέσα στην εβδομάδα.",
        });
      }
      const minutes = mine.reduce((sum, a) => sum + (a.kind === "shift" ? (minutesOf(a.start, a.end) ?? 0) : 0), 0);
      if (minutes > WEEKLY_HOURS_NOTE) {
        issues.push({
          severity: "info",
          week: week.monday,
          title: `${name(personId)}: ${formatHours(minutes)}`,
          detail: "Πάνω από 40 ώρες την εβδομάδα.",
        });
      }
    }

    // Coverage: someone opening and someone closing, Monday to Saturday
    for (let day = 0; day < 6; day++) {
      const shifts = week.assignments.filter((a) => a.day === day && a.kind === "shift" && a.start && a.end);
      if (!shifts.length) {
        if (week.assignments.length) {
          issues.push({
            severity: "info",
            week: week.monday,
            title: `${dayLabel(addDays(week.monday, day))}: καμία βάρδια`,
            detail: "Αν το κατάστημα είναι ανοιχτό, λείπει το πρόγραμμα της μέρας.",
          });
        }
        continue;
      }
      const opens = shifts.some((a) => a.start! < "12:00");
      const closes = shifts.some((a) => a.end! >= "20:00" || a.end! <= a.start!);
      if (!opens || !closes) {
        issues.push({
          severity: "warning",
          week: week.monday,
          title: `${dayLabel(addDays(week.monday, day))}: κανείς ${!opens ? "το πρωί" : "το βράδυ"}`,
          detail: !opens ? "Καμία βάρδια δεν ξεκινά πριν τις 12:00." : "Καμία βάρδια δεν τελειώνει μετά τις 20:00.",
        });
      }
    }
  }

  // Across weeks: rest between shifts, long runs of working days
  const shifts = timedShifts(weeks);
  const byPerson = new Map<string, typeof shifts>();
  for (const s of shifts) byPerson.set(s.personId, [...(byPerson.get(s.personId) ?? []), s]);
  for (const [personId, list] of byPerson) {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const next = list[i]!;
      const gap = next.startAt - prev.endAt;
      if (gap < 0) {
        issues.push({
          severity: "error",
          week: weekOf(next.date),
          title: `${name(personId)}: επικαλυπτόμενες βάρδιες`,
          detail: `${dayLabel(prev.date)} ${prev.start}–${prev.end} και ${dayLabel(next.date)} ${next.start}–${next.end}.`,
        });
      } else if (gap < MIN_REST && next.date !== prev.date) {
        issues.push({
          severity: "warning",
          week: weekOf(next.date),
          title: `${name(personId)}: ${Math.floor(gap / 60)} ώρες ανάπαυση`,
          detail: `Από ${dayLabel(prev.date)} ${prev.end} ως ${dayLabel(next.date)} ${next.start}, λιγότερο από 11 ώρες.`,
        });
      }
    }

    const dates = [...new Set(list.map((s) => s.date))].sort();
    let runStart = 0;
    for (let i = 1; i <= dates.length; i++) {
      const continues = i < dates.length && daysBetween(dates[i - 1]!, dates[i]!) === 1;
      if (continues) continue;
      const length = i - runStart;
      if (length > MAX_DAYS_IN_A_ROW) {
        issues.push({
          severity: "warning",
          week: weekOf(dates[i - 1]!),
          title: `${name(personId)}: ${length} μέρες στη σειρά`,
          detail: `Από ${dayLabel(dates[runStart]!)} ως ${dayLabel(dates[i - 1]!)} συνεχόμενα, χωρίς ελεύθερη μέρα.`,
        });
      }
      runStart = i;
    }
  }

  const order: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => a.week.localeCompare(b.week) || order[a.severity] - order[b.severity]);
}

/** People whose name is typed in more than one way: worth unifying in the sheet. */
export function spellingIssues(people: Person[]): { person: Person; variants: string[] }[] {
  return people
    .filter((p) => p.variants.length > 1)
    .map((person) => ({ person, variants: person.variants }));
}
