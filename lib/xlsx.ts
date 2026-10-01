import { strFromU8, unzipSync } from "fflate";

/**
 * Minimal .xlsx reader: just enough of SpreadsheetML to read Google Sheets
 * exports (shared strings, inline strings, numbers, booleans and date-formatted
 * numbers). Formatting, formulas and merged cells are ignored.
 */

export type PlainDate = { y: number; m: number; d: number };

export type Cell =
  | { kind: "text"; text: string }
  | { kind: "number"; value: number }
  | { kind: "date"; date: PlainDate }
  | { kind: "bool"; value: boolean };

/** Sparse grid: grid[row][col], both 0-based. */
export type Grid = (Cell | undefined)[][];

export type Sheet = { name: string; grid: Grid };

// Built-in number formats that render as dates (ECMA-376 §18.8.30 plus common locale ids).
const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 57, 58,
]);

export function readXlsx(data: Uint8Array): Sheet[] {
  const files = unzipSync(data);
  const text = (path: string): string | null => {
    const bytes = files[path];
    return bytes ? strFromU8(bytes) : null;
  };

  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new Error("Not an xlsx file: xl/workbook.xml missing");

  const rels = parseRelationships(text("xl/_rels/workbook.xml.rels") ?? "");
  const sharedStrings = parseSharedStrings(text("xl/sharedStrings.xml") ?? "");
  const dateStyles = parseDateStyles(text("xl/styles.xml") ?? "");

  const sheets: Sheet[] = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const attrs = parseAttributes(match[1] ?? "");
    const name = attrs.name ?? `Sheet${sheets.length + 1}`;
    const relId = attrs["r:id"];
    const target = relId ? rels.get(relId) : undefined;
    if (!target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const xml = text(path);
    if (!xml) continue;
    sheets.push({ name, grid: parseSheet(xml, sharedStrings, dateStyles) });
  }
  return sheets;
}

function parseSheet(xml: string, sharedStrings: string[], dateStyles: Set<number>): Grid {
  const grid: Grid = [];
  for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = parseAttributes(match[1] ?? "");
    const ref = attrs.r;
    const body = match[2];
    if (!ref || body === undefined) continue;
    const pos = parseCellRef(ref);
    if (!pos) continue;

    const cell = parseCell(attrs, body, sharedStrings, dateStyles);
    if (!cell) continue;
    (grid[pos.row] ??= [])[pos.col] = cell;
  }
  return grid;
}

function parseCell(
  attrs: Record<string, string>,
  body: string,
  sharedStrings: string[],
  dateStyles: Set<number>,
): Cell | undefined {
  const type = attrs.t ?? "n";
  if (type === "inlineStr") {
    const value = collectText(body);
    return value === "" ? undefined : { kind: "text", text: value };
  }

  const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
  if (raw === undefined) return undefined;
  const value = decodeEntities(raw);

  switch (type) {
    case "s": {
      const str = sharedStrings[Number(value)];
      return str ? { kind: "text", text: str } : undefined;
    }
    case "str":
      return value === "" ? undefined : { kind: "text", text: value };
    case "b":
      return { kind: "bool", value: value === "1" };
    case "e":
      return undefined;
    default: {
      const num = Number(value);
      if (!Number.isFinite(num)) return undefined;
      const style = attrs.s === undefined ? 0 : Number(attrs.s);
      if (dateStyles.has(style)) return { kind: "date", date: serialToDate(num) };
      return { kind: "number", value: num };
    }
  }
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) {
    strings.push(match[1] === undefined ? "" : collectText(match[1]));
  }
  return strings;
}

/** Returns the indexes of cellXfs entries whose number format renders a date. */
function parseDateStyles(xml: string): Set<number> {
  const custom = new Map<number, string>();
  for (const match of xml.matchAll(/<numFmt\b([^>]*?)\/?>/g)) {
    const attrs = parseAttributes(match[1] ?? "");
    if (attrs.numFmtId && attrs.formatCode !== undefined) {
      custom.set(Number(attrs.numFmtId), attrs.formatCode);
    }
  }

  const result = new Set<number>();
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  let index = 0;
  for (const match of cellXfs.matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)) {
    const attrs = parseAttributes(match[1] ?? "");
    const fmtId = Number(attrs.numFmtId ?? 0);
    const code = custom.get(fmtId);
    if (BUILTIN_DATE_FORMATS.has(fmtId) || (code !== undefined && isDateFormat(code))) {
      result.add(index);
    }
    index++;
  }
  return result;
}

function isDateFormat(code: string): boolean {
  // Drop quoted literals, bracketed sections ([Red], [$-408]) and escaped characters.
  const stripped = code
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "")
    .toLowerCase();
  return /[dy]/.test(stripped);
}

function parseRelationships(xml: string): Map<string, string> {
  const rels = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const attrs = parseAttributes(match[1] ?? "");
    if (attrs.Id && attrs.Target) rels.set(attrs.Id, attrs.Target);
  }
  return rels;
}

function collectText(fragment: string): string {
  let out = "";
  for (const match of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    out += decodeEntities(match[1] ?? "");
  }
  return out;
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) {
    if (match[1]) attrs[match[1]] = decodeEntities(match[2] ?? "");
  }
  return attrs;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match?.[1] || !match[2]) return null;
  let col = 0;
  for (const ch of match[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, col: col - 1 };
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const code = lower.startsWith("#x") ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

/** Spreadsheet serial (1900 date system, as used by Google Sheets) to a calendar date. */
export function serialToDate(serial: number): PlainDate {
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  const date = new Date(ms);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}
