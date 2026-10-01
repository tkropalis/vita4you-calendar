import type { IsoDate } from "./dates";

export type AssignmentKind = "shift" | "off" | "leave" | "note";

export type Assignment = {
  personId: string;
  /** 0 = Monday … 6 = Sunday */
  day: number;
  kind: AssignmentKind;
  /** "HH:MM" for shifts */
  start?: string;
  end?: string;
  /** Leave type ("Άδεια", "Γονική άδεια", "Αναρρωτική") or the raw text of an unrecognised row. */
  label?: string;
  /** Human-readable notes from the sheet: "Εφημερία", "Ολονυχτία", "Λόγω Κυριακής"… */
  tags: string[];
  /**
   * Where the time came from: the row's time column, an inline "(08:00-15:00)"
   * override in the name cell, or the row above (time column left blank).
   */
  timeSource?: "row" | "override" | "inherited";
  /** 1-based spreadsheet row, for traceability. */
  row: number;
};

export type WeekWarning =
  | { type: "duplicate"; otherRow: number }
  | { type: "dates-inferred" }
  | { type: "times-inferred"; rows: number[] };

export type Week = {
  monday: IsoDate;
  sheet: string;
  /** 1-based row of the weekday header. */
  headerRow: number;
  assignments: Assignment[];
  warnings: WeekWarning[];
};

export type Person = {
  id: string;
  name: string;
  /** Monday of the latest week the person appears in. */
  lastSeen: IsoDate;
  /** Spellings found in the sheet, for transparency. */
  variants: string[];
};

export type Schedule = {
  weeks: Week[];
  people: Person[];
};

export type ScheduleSnapshot = Schedule & {
  /** Content hash; changes only when the parsed schedule changes. */
  version: string;
  /** ISO timestamp of the read from Google Sheets. */
  fetchedAt: string;
  sheetUrl: string;
};
