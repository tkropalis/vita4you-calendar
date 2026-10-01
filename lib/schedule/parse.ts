import type { Cell, Grid, Sheet } from "../xlsx";
import {
  addDays,
  cellHasExplicitYear,
  dateCandidates,
  daysBetween,
  fromIso,
  toIso,
  weekdayIndex,
  type IsoDate,
} from "./dates";
import { clusterNames, foldGreek, parseName, surnamesMatch } from "./names";
import type { Assignment, Person, Schedule, Week, WeekWarning } from "./types";

/**
 * Interprets the rota spreadsheet.
 *
 * Layout (Sheet2, repeated once per week, appended downwards):
 *
 *   Δευτέρα | Τρίτη | … | Κυριακή |              ← weekday header (columns A–G)
 *   28/9    | 29/9  | … | 4/10    |              ← dates, typed by hand
 *   name    | name  | … |         | 08:00-16:00  ← one row per shift slot, time in H
 *   name    |       | … |         | 16:00-00:00 | ΕΦΗΜΕΡΙΑ   ← notes in I
 *   name    | name  | … |         | ρεπο        ← day off
 *   name    | …     |   |         | ΑΔΕΙΑ       ← leave
 *
 * Every week is located by its header row, so blank rows, staff roster rows
 * and other notes between weeks are tolerated.
 */

const WEEKDAY_PREFIXES = ["δευ", "τρι", "τετ", "πεμ", "παρ", "σαβ", "κυρ"];
const WEEKDAY_NAMES = ["δευτερα", "τριτη", "τεταρτη", "πεμπτη", "παρασκευη", "σαββατο", "κυριακη"];

type Header = { sheet: string; grid: Grid; row: number; col: number; endRow: number };

type TimeCell =
  | { type: "empty" }
  | { type: "shift"; start: string; end: string; tags: string[] }
  | { type: "off" }
  | { type: "leave"; label: string }
  | { type: "other"; text: string };

type RowClass = Exclude<TimeCell, { type: "empty" } | { type: "other" }>;

export function parseSchedule(sheets: Sheet[]): Schedule {
  const headers = sheets.flatMap(findHeaders);

  // Pass 1: every name-like cell inside a week, to learn who the people are.
  const occurrences = new Map<string, number>();
  for (const header of headers) {
    for (let r = bodyStart(header); r < header.endRow; r++) {
      for (let d = 0; d < 7; d++) {
        const parsed = readNameCell(header.grid[r]?.[header.col + d]);
        if (parsed) occurrences.set(parsed.name, (occurrences.get(parsed.name) ?? 0) + 1);
      }
    }
  }
  const { clusters, lookup } = clusterNames(occurrences);
  const surnameKeys = clusters.map((c) => foldGreek(c.name).split(" ")[0] ?? "");

  // Pass 2: resolve each block's week and read its assignments.
  const mondays = resolveMondays(headers);
  const weeksByMonday = new Map<IsoDate, Week>();

  headers.forEach((header, index) => {
    const resolved = mondays[index];
    if (!resolved) return;
    const { assignments, inferredRows } = readAssignments(header, lookup, surnameKeys);

    const warnings: WeekWarning[] = [];
    if (resolved.inferred) warnings.push({ type: "dates-inferred" });
    if (inferredRows.length) warnings.push({ type: "times-inferred", rows: inferredRows });

    const previous = weeksByMonday.get(resolved.monday);
    if (previous) warnings.push({ type: "duplicate", otherRow: previous.headerRow });

    // A later block for the same week replaces the earlier one (the sheet is append-only).
    weeksByMonday.set(resolved.monday, {
      monday: resolved.monday,
      sheet: header.sheet,
      headerRow: header.row + 1,
      assignments,
      warnings,
    });
  });

  const weeks = [...weeksByMonday.values()].sort((a, b) => a.monday.localeCompare(b.monday));

  const lastSeen = new Map<string, IsoDate>();
  for (const week of weeks) {
    for (const a of week.assignments) lastSeen.set(a.personId, week.monday);
  }
  const people: Person[] = clusters
    .filter((c) => lastSeen.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      lastSeen: lastSeen.get(c.id)!,
      variants: [...c.variants.keys()],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "el"));

  return { weeks, people };
}

function findHeaders(sheet: Sheet): Header[] {
  const found: Omit<Header, "endRow">[] = [];
  sheet.grid.forEach((row, r) => {
    if (!row) return;
    for (let c = 0; c + 6 < Math.max(row.length, 7); c++) {
      let matches = 0;
      for (let d = 0; d < 7; d++) {
        const text = cellText(row[c + d]);
        if (text && foldGreek(text).startsWith(WEEKDAY_PREFIXES[d]!)) matches++;
      }
      if (matches >= 5) {
        found.push({ sheet: sheet.name, grid: sheet.grid, row: r, col: c });
        return;
      }
    }
  });
  return found.map((h, i) => ({ ...h, endRow: found[i + 1]?.row ?? sheet.grid.length }));
}

/** The dates row is the first row under the header holding at least two date-like cells. */
function dateRowOf(header: Header): number | null {
  for (let r = header.row + 1; r <= header.row + 2 && r < header.endRow; r++) {
    let dateLike = 0;
    for (let d = 0; d < 7; d++) {
      if (dateCandidates(header.grid[r]?.[header.col + d], [2026]).length) dateLike++;
    }
    if (dateLike >= 2) return r;
  }
  return null;
}

function bodyStart(header: Header): number {
  return (dateRowOf(header) ?? header.row) + 1;
}

type ResolvedMonday = { monday: IsoDate; inferred: boolean };

/**
 * Picks each block's Monday by letting every date cell vote: a reading only
 * counts when it falls on its column's weekday. Year-less dates borrow the
 * year from neighbouring blocks.
 */
function resolveMondays(headers: Header[]): (ResolvedMonday | null)[] {
  const result: (ResolvedMonday | null)[] = headers.map(() => null);
  const dateCells = headers.map((h) => {
    const row = dateRowOf(h);
    return Array.from({ length: 7 }, (_, d) => (row === null ? undefined : h.grid[row]?.[h.col + d]));
  });

  const vote = (index: number, years: number[], expected: IsoDate | null): IsoDate | null => {
    const tally = new Map<IsoDate, number>();
    dateCells[index]!.forEach((cell, day) => {
      const seen = new Set<IsoDate>();
      for (const candidate of dateCandidates(cell, years)) {
        if (weekdayIndex(candidate) !== day) continue;
        const monday = addDays(toIso(candidate), -day);
        if (seen.has(monday)) continue;
        seen.add(monday);
        tally.set(monday, (tally.get(monday) ?? 0) + 1);
      }
    });
    let best: IsoDate | null = null;
    let bestVotes = 0;
    for (const [monday, votes] of tally) {
      const closer =
        expected !== null &&
        best !== null &&
        Math.abs(daysBetween(expected, monday)) < Math.abs(daysBetween(expected, best));
      if (votes > bestVotes || (votes === bestVotes && closer)) {
        best = monday;
        bestVotes = votes;
      }
    }
    return best;
  };

  // Pass A: blocks with at least one explicit year.
  headers.forEach((_, i) => {
    const cells = dateCells[i]!;
    if (!cells.some(cellHasExplicitYear)) return;
    const years = explicitYears(cells);
    const monday = vote(i, years, null);
    if (monday) result[i] = { monday, inferred: false };
  });

  // Pass B: year-less blocks borrow the nearest resolved neighbour's year.
  headers.forEach((_, i) => {
    if (result[i]) return;
    const neighbour = nearestResolved(result, headers, i);
    const baseYear = neighbour ? fromIso(neighbour.monday).y : new Date().getUTCFullYear();
    const expected = neighbour ? addDays(neighbour.monday, 7 * neighbour.offset) : null;
    const monday = vote(i, [baseYear - 1, baseYear, baseYear + 1], expected);
    if (monday) result[i] = { monday, inferred: false };
    else if (expected) result[i] = { monday: expected, inferred: true };
  });

  return result;
}

function explicitYears(cells: (Cell | undefined)[]): number[] {
  const years = new Set<number>();
  for (const cell of cells) {
    if (cell?.kind === "date") years.add(cell.date.y);
    if (cell?.kind === "text") for (const m of cell.text.matchAll(/20\d\d/g)) years.add(Number(m[0]));
  }
  return [...years];
}

function nearestResolved(
  result: (ResolvedMonday | null)[],
  headers: Header[],
  index: number,
): { monday: IsoDate; offset: number } | null {
  for (let distance = 1; distance < headers.length; distance++) {
    for (const j of [index - distance, index + distance]) {
      const found = result[j];
      if (found && headers[j]!.sheet === headers[index]!.sheet) {
        return { monday: found.monday, offset: index - j };
      }
    }
  }
  return null;
}

function readAssignments(
  header: Header,
  lookup: Map<string, string>,
  surnameKeys: string[],
): { assignments: Assignment[]; inferredRows: number[] } {
  const assignments: Assignment[] = [];
  const inferredRows: number[] = [];
  const timeCol = header.col + 7;
  let previous: { row: number; cls: RowClass } | null = null;

  for (let r = bodyStart(header); r < header.endRow; r++) {
    const row = header.grid[r];
    if (!row) continue;

    const names = Array.from({ length: 7 }, (_, d) => readNameCell(row[header.col + d]));
    const hasNames = names.some(Boolean);
    const timeCell = classifyTimeCell(cellText(row[timeCol]) ?? "");

    let cls: RowClass | null = null;
    let label: string | undefined;
    let inherited = false;

    if (timeCell.type === "empty") {
      if (!hasNames) continue;
      if (previous && previous.row === r - 1) {
        cls = previous.cls;
        inherited = true;
        inferredRows.push(r + 1);
      }
    } else if (timeCell.type === "other") {
      // A staff roster line (a name where the time should be) is not a shift row.
      if (isPersonName(timeCell.text, surnameKeys)) continue;
      label = normalizeTag(timeCell.text) ?? timeCell.text;
    } else {
      cls = timeCell;
    }

    const tags = [
      ...(cls?.type === "shift" ? cls.tags : []),
      ...noteTags(row.slice(timeCol + 1, timeCol + 4)),
    ].filter((tag, i, all) => all.indexOf(tag) === i);

    names.forEach((entry, day) => {
      if (!entry) return;
      const personId = lookup.get(entry.name);
      if (!personId) return;
      const base = { personId, day, row: r + 1, tags };

      if (entry.override) {
        assignments.push({ ...base, kind: "shift", ...entry.override, timeSource: "override" });
      } else if (cls?.type === "shift") {
        assignments.push({
          ...base,
          kind: "shift",
          start: cls.start,
          end: cls.end,
          timeSource: inherited ? "inherited" : "row",
        });
      } else if (cls?.type === "off") {
        assignments.push({ ...base, kind: "off" });
      } else if (cls?.type === "leave") {
        assignments.push({ ...base, kind: "leave", label: cls.label });
      } else {
        assignments.push({ ...base, kind: "note", label });
      }
    });

    if (cls) previous = { row: r, cls };
    else previous = null;
  }

  return { assignments, inferredRows };
}

function isPersonName(text: string, surnameKeys: string[]): boolean {
  const parsed = parseName(text);
  if (!parsed) return false;
  return surnameKeys.some((key) => surnamesMatch(key, parsed.surnameKey));
}

type NameCell = { name: string; override?: { start: string; end: string } };

function readNameCell(cell: Cell | undefined): NameCell | null {
  const text = cellText(cell);
  if (!text) return null;
  let nameText = text;
  let override: NameCell["override"];
  const paren = /\(([^)]*)\)/.exec(text);
  if (paren) {
    const range = parseTimeRange(paren[1] ?? "");
    if (range) override = { start: range.start, end: range.end };
    nameText = text.replace(paren[0], " ");
  }
  const parsed = parseName(nameText);
  if (!parsed) return null;
  // Weekday names never count as people (e.g. a header pasted one row off).
  if (WEEKDAY_NAMES.includes(parsed.surnameKey)) return null;
  return { name: parsed.text, override };
}

export function classifyTimeCell(text: string): TimeCell {
  const folded = foldGreek(text);
  if (!folded) return { type: "empty" };
  if (folded.startsWith("ρεπ")) return { type: "off" };
  if (/αδει|αναρρωτ/.test(folded)) {
    const label = folded.includes("γονικ")
      ? "Γονική άδεια"
      : folded.includes("αναρρωτ")
        ? "Αναρρωτική"
        : "Άδεια";
    return { type: "leave", label };
  }
  const range = parseTimeRange(text);
  if (range) {
    const tag = normalizeTag(range.rest);
    return { type: "shift", start: range.start, end: range.end, tags: tag ? [tag] : [] };
  }
  return { type: "other", text: text.trim() };
}

export function parseTimeRange(text: string): { start: string; end: string; rest: string } | null {
  const match = /(\d{1,2})(?:[:.](\d{2}))?\s*[-–—]\s*(\d{1,2})(?:[:.-](\d{2}))?/.exec(text);
  if (!match) return null;
  const [whole, h1, m1 = "00", h2, m2Raw = "00"] = match;
  const startH = Number(h1);
  const endH = Number(h2);
  let m2 = m2Raw;
  if (startH > 24 || endH > 24 || Number(m1) > 59 || Number(m2) > 59) return null;
  // "12:00-20:01", "16:00-00:02": fill-handle drag artefacts in the sheet.
  if (m1 === "00" && (m2 === "01" || m2 === "02")) m2 = "00";
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${pad(startH)}:${m1}`,
    end: `${pad(endH)}:${m2}`,
    rest: text.replace(whole, " ").trim(),
  };
}

function noteTags(cells: (Cell | undefined)[]): string[] {
  const tags: string[] = [];
  for (const cell of cells) {
    const tag = normalizeTag(cellText(cell) ?? "");
    if (tag) tags.push(tag);
  }
  return tags;
}

export function normalizeTag(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const folded = foldGreek(trimmed);
  if (!folded || /^[\d.,\s]+$/.test(folded)) return null;
  if (folded.includes("εφημερ")) return "Εφημερία";
  if (folded.includes("ολονυχτ")) return "Ολονυχτία";
  if (folded.includes("λογω κυριακ")) return "Λόγω Κυριακής";
  if (folded.includes("αναρρωτ")) return "Αναρρωτική";
  if (folded.includes("γονικ")) return "Γονική άδεια";
  const range = parseTimeRange(trimmed);
  if (range && !range.rest) return `${range.start}–${range.end}`;
  const isUpper = trimmed === trimmed.toUpperCase();
  const base = isUpper ? trimmed.toLowerCase() : trimmed;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function cellText(cell: Cell | undefined): string | null {
  if (!cell || cell.kind !== "text") return null;
  const text = cell.text.trim();
  return text === "" ? null : text;
}
