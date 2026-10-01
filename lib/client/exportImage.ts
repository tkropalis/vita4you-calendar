import { hex, type PaletteKey } from "../design/palette";
import { addDays, fromIso, type IsoDate } from "../schedule/dates";
import { DAY_NAMES, DAY_SHORT, formatHours, type PersonDay, type WeekSummary } from "../schedule/view";
import { formatClock } from "./format";

/**
 * Renders one person's week as a 1080×1920 PNG, printed like the duty-pharmacy notice:
 * green cross header, the name, a ruled table of days, hours and coworkers, one line of facts.
 */

const W = 1080;
const H = 1920;
const X = 72;
const RIGHT = W - X;
const FONT = '"Fira Sans Condensed", "Arial Narrow", system-ui, sans-serif';

export type WeekImageInput = {
  personName: string;
  monday: IsoDate;
  days: PersonDay[];
  summary: WeekSummary;
  checkedAt: string;
};

type TextOptions = { align?: CanvasTextAlign; caps?: boolean; maxWidth?: number };

export async function renderWeekImage(input: WeekImageInput): Promise<Blob> {
  await Promise.all(["400", "600", "800"].map((w) => document.fonts.load(`${w} 40px ${FONT}`, "Αα Ωω 0123456789")));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const font = (size: number, weight: number) => `${weight} ${size}px ${FONT}`;
  const text = (value: string, x: number, y: number, size: number, weight: number, color: PaletteKey, opts: TextOptions = {}) => {
    ctx.font = font(size, weight);
    ctx.fillStyle = hex(color);
    ctx.textAlign = opts.align ?? "left";
    setLetterSpacing(ctx, opts.caps ? `${size * 0.06}px` : "0px");
    let out = opts.caps ? upperGreek(value) : value;
    if (opts.maxWidth) out = fit(ctx, out, opts.maxWidth);
    ctx.fillText(out, x, y);
    setLetterSpacing(ctx, "0px");
    return ctx.measureText(out).width;
  };
  const rule = (y: number, weight: number, color: PaletteKey = "rule") => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(X, y, RIGHT - X, weight);
  };

  ctx.fillStyle = hex("paper");
  ctx.fillRect(0, 0, W, H);

  // Header: the cross and the notice title
  ctx.fillStyle = hex("green");
  ctx.fillRect(X + 24, 190, 24, 72);
  ctx.fillRect(X, 214, 72, 24);
  text("Πρόγραμμα εβδομάδας", X + 100, 232, 50, 800, "ink", { caps: true });
  text("Vita4you Τσιμισκή", X + 100, 268, 28, 400, "ink2", { caps: true });
  rule(310, 8);

  // Whose week, which week
  const sunday = addDays(input.monday, 6);
  const a = fromIso(input.monday);
  const b = fromIso(sunday);
  text(input.personName, X, 420, 96, 800, "ink", { maxWidth: RIGHT - X });
  text(`${a.d}/${a.m} – ${b.d}/${b.m}/${b.y}`, X, 496, 54, 800, "ink2");

  // The table
  const dayX = X;
  const hoursX = X + 230;
  const withX = X + 520;
  text("Ημέρα", dayX, 590, 26, 600, "ink", { caps: true });
  text("Ωράριο", hoursX, 590, 26, 600, "ink", { caps: true });
  text("Με", withX, 590, 26, 600, "ink", { caps: true });
  rule(606, 6);

  const top = 612;
  const rowH = 148;
  input.days.forEach((day, i) => {
    const y = top + i * rowH;
    const base = y + 70;
    text(`${DAY_SHORT[day.index]} ${fromIso(day.date).d}`, dayX, base, 44, 800, "ink", { caps: true });

    const shifts = day.entries.filter((e) => e.kind === "shift");
    const first = day.entries[0];
    if (!first) {
      text("—", hoursX, base, 56, 800, "ink2");
    } else if (shifts.length) {
      const hours = shifts.map((e) => `${e.timeSource === "inherited" ? "≈" : ""}${compact(e.start, e.end)}`).join(" · ");
      text(hours, hoursX, base, hours.length > 7 ? 46 : 60, 800, "ink", { maxWidth: withX - hoursX - 24 });
      const duty = shifts.flatMap((e) => e.tags).find((t) => t === "Εφημερία" || t === "Ολονυχτία");
      if (duty) text(duty, hoursX, base + 40, 24, 600, "ink2", { caps: true });
      const names = [...new Set(shifts.flatMap((e) => e.coworkers))];
      wrapText(ctx, names.length ? names.join(", ") : "—", withX, base - 8, RIGHT - withX, 32, font(30, 400), hex("ink"), 2);
    } else if (first.kind === "off") {
      text("Ρεπό", hoursX, base, 56, 800, "green", { caps: true });
    } else {
      text(first.kind === "leave" ? (first.label ?? "Άδεια") : "Χωρίς ώρα", hoursX, base, 44, 800, "ink2", { caps: true });
    }
    if (i < 6) rule(y + rowH - 2, 2, "hairline");
  });
  rule(top + 7 * rowH, 6);

  // Facts, as one printed line
  const s = input.summary;
  const facts: [string, string, PaletteKey][] = [
    ["Ρεπό", s.offDays.length ? s.offDays.map((d) => DAY_NAMES[d]).join(" και ") : "κανένα", s.offDays.length ? "green" : "ink"],
    ["Κυριακή", s.sunday.length ? s.sunday.map((e) => compact(e.start, e.end)).join(", ") : "όχι", "ink"],
    ["Σύνολο", `${s.totalIncomplete ? "≥ " : ""}${formatHours(s.totalMinutes)}`, "ink"],
  ];
  let x = X;
  const factsY = top + 7 * rowH + 82;
  facts.forEach(([label, value, color], i) => {
    x += text(`${label}: `, x, factsY, 36, 800, "ink");
    x += text(value, x, factsY, 36, 400, color);
    if (i < facts.length - 1) x += text("  ·  ", x, factsY, 36, 400, "ink2");
  });

  text(
    `Από το φύλλο «Πρόγραμμα Τσιμισκή» · έλεγχος ${checkedDate(input.checkedAt)}, ${formatClock(input.checkedAt)}`,
    X,
    1862,
    24,
    400,
    "ink2",
    { maxWidth: RIGHT - X },
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))), "image/png"),
  );
}

export function weekImageFilename(personId: string, monday: IsoDate): string {
  return `programma-${personId}-${monday}.png`;
}

/** Opens the share sheet where the device can share files (iOS, Android); otherwise downloads. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // NotAllowedError (gesture expired) and others fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

function compact(start?: string, end?: string): string {
  const part = (t?: string) => (t ? (t.endsWith(":00") ? t.slice(0, 2) : t) : "");
  return `${part(start)}–${part(end)}`;
}

/** "1/10/2026" in Athens time: a saved image outlives "σήμερα". */
function checkedDate(iso: string): string {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date(iso)).split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}

/** Greek capitals drop the tonos: "Ημέρα" → "ΗΜΕΡΑ". */
function upperGreek(value: string): string {
  return value.normalize("NFD").replace(/\u0301/g, "").toUpperCase().normalize("NFC");
}

function fit(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/** Word-wraps names over at most `maxLines` lines; never splits a surname from its initial. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontSpec: string,
  color: string,
  maxLines: number,
) {
  ctx.font = fontSpec;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  const words = value.replace(/ (\S{1,3}\.)/gu, "\u00a0$1").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = fit(ctx, `${shown[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, maxWidth);
  const startY = y - ((shown.length - 1) * lineHeight) / 2;
  shown.forEach((l, i) => ctx.fillText(l.replace(/\u00a0/g, " "), x, startY + i * lineHeight));
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}
