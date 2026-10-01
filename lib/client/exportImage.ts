import { ean13Modules, isGuardModule, weekCode } from "../barcode";
import { hex, type PaletteKey } from "../design/palette";
import { addDays, fromIso, isoWeek, type IsoDate } from "../schedule/dates";
import { DAY_SHORT, PERIOD_LABEL, formatHours, type PersonDay, type WeekSummary } from "../schedule/view";
import { formatClock } from "./format";

/**
 * Renders one person's week as a 1080×1920 PNG in the page's visual system:
 * a medicine-box front with the seven-day dosage table and the authenticity strip.
 */

const W = 1080;
const H = 1920;
const X = 80;
const RIGHT = W - X;
const FONT = '"Commissioner Variable", "Commissioner", system-ui, sans-serif';
const MONTHS_LONG = [
  "Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου",
  "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου",
];

export type WeekImageInput = {
  personId: string;
  personName: string;
  monday: IsoDate;
  today: IsoDate;
  days: PersonDay[];
  summary: WeekSummary;
  checkedAt: string;
};

export async function renderWeekImage(input: WeekImageInput): Promise<Blob> {
  await Promise.all(
    ["500", "600", "700", "800"].map((w) => document.fonts.load(`${w} 40px ${FONT}`, "Αα Ωω 0123456789")),
  );

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const text = (value: string, x: number, y: number, size: number, weight: number, color: PaletteKey, opts: { align?: CanvasTextAlign; caps?: boolean; maxWidth?: number } = {}) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = hex(color);
    ctx.textAlign = opts.align ?? "left";
    setLetterSpacing(ctx, opts.caps ? `${size * 0.08}px` : "0px");
    let out = opts.caps ? upperGreek(value) : value;
    if (opts.maxWidth) out = fit(ctx, out, opts.maxWidth);
    ctx.fillText(out, x, y);
    setLetterSpacing(ctx, "0px");
  };
  const rule = (y: number, weight: number, color: PaletteKey) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(X, y, RIGHT - X, weight);
  };

  // Board
  ctx.fillStyle = hex("board");
  ctx.fillRect(0, 0, W, H);

  // Head: whose week, which week
  const { year, week } = isoWeek(input.monday);
  const sunday = addDays(input.monday, 6);
  text("Vita4you Τσιμισκή · Πρόγραμμα βαρδιών", X, 236, 26, 600, "ink2", { caps: true });
  text(input.personName, X, 338, 96, 800, "ink", { maxWidth: RIGHT - X });
  text(`Εβδομάδα ${week} · ${longRange(input.monday, sunday)}`, X, 398, 34, 500, "ink2", { maxWidth: RIGHT - X });
  rule(432, 4, "ink");

  // Facts, as on a box's side panel
  const s = input.summary;
  const facts: { label: string; value: string; color: PaletteKey }[] = [
    {
      label: "Ρεπό",
      value: s.offDays.length ? s.offDays.map((d) => `${DAY_SHORT[d]} ${fromIso(input.days[d]!.date).d}`).join(", ") : "Κανένα",
      color: s.offDays.length ? "off" : "ink2",
    },
    {
      label: "Κυριακή",
      value: s.sunday.length ? s.sunday.map((e) => `${e.start}–${e.end}`).join(", ") : "Όχι",
      color: "ink",
    },
    {
      label: "Σύνολο",
      value: `${s.totalIncomplete ? "≥ " : ""}${formatHours(s.totalMinutes)}`,
      color: "ink",
    },
  ];
  const colW = (RIGHT - X) / 3;
  facts.forEach((fact, i) => {
    const x = X + i * colW;
    text(fact.label, x, 488, 24, 600, "ink2", { caps: true });
    text(fact.value, x, 540, 40, 700, fact.color, { maxWidth: colW - 24 });
  });
  rule(580, 2, "rule");

  // Dosage table
  const top = 600;
  const rowH = 142;
  input.days.forEach((day, i) => {
    const y = top + i * rowH;
    const isToday = day.date === input.today;
    if (isToday) {
      ctx.fillStyle = hex("ink");
      ctx.fillRect(X - 16, y + 14, 150, rowH - 28);
    }
    text(DAY_SHORT[day.index]!, X + 4, y + 56, 26, 700, isToday ? "board" : "ink2", { caps: true });
    text(String(fromIso(day.date).d), X + 4, y + 114, 58, 800, isToday ? "board" : "ink");

    const shifts = day.entries.filter((e) => e.kind === "shift");
    const blockX = 260;
    const blockY = y + 24;
    const blockW = 500;
    const blockH = 76;
    const first = day.entries[0];
    if (!first) {
      text("Χωρίς βάρδια", blockX, blockY + 52, 32, 500, "ink2");
    } else {
      const color: PaletteKey =
        first.kind === "shift" ? (first.period ?? "morning") : first.kind === "off" ? "off" : first.kind === "leave" ? "leave" : "ink2";
      const label =
        shifts.length > 0
          ? shifts.map((e) => `${e.timeSource === "inherited" ? "≈ " : ""}${e.start} – ${e.end}`).join(" · ")
          : first.kind === "off"
            ? "Ρεπό"
            : first.kind === "leave"
              ? (first.label ?? "Άδεια")
              : "Χωρίς ώρα";
      if (first.kind === "note") {
        ctx.strokeStyle = hex("ink2");
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.strokeRect(blockX, blockY, blockW, blockH);
        ctx.setLineDash([]);
        text(label, blockX + 26, blockY + 52, 40, 700, "ink2");
      } else {
        ctx.fillStyle = hex(color);
        ctx.fillRect(blockX, blockY, blockW, blockH);
        ctx.font = `700 46px ${FONT}`;
        const size = ctx.measureText(label).width > blockW - 52 ? 34 : 46;
        text(label, blockX + 26, blockY + (size === 46 ? 55 : 51), size, 700, "board", { maxWidth: blockW - 52 });
      }
      const minutes = shifts.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
      if (shifts.length) {
        const duty = shifts.flatMap((e) => e.tags).find((t) => t === "Εφημερία" || t === "Ολονυχτία");
        text(formatHours(minutes), RIGHT, blockY + 36, 30, 700, "ink", { align: "right" });
        text(duty ?? PERIOD_LABEL[shifts[0]!.period ?? "morning"], RIGHT, blockY + 72, 24, 500, "ink2", { align: "right" });
        const coworkers = [...new Set(shifts.flatMap((e) => e.coworkers))];
        if (coworkers.length) {
          text(`με ${coworkers.join(", ")}`, blockX, blockY + blockH + 34, 26, 500, "ink2", { maxWidth: RIGHT - blockX });
        }
      }
    }
    if (i < 6) rule(y + rowH - 1, 2, "rule");
  });
  rule(top + 7 * rowH, 4, "ink");

  // Authenticity strip
  const stripY = 1636;
  const stripH = 176;
  ctx.fillStyle = hex("strip");
  ctx.fillRect(X, stripY, RIGHT - X, stripH);
  ctx.strokeStyle = hex("ink2");
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(X + 1, stripY + 1, RIGHT - X - 2, stripH - 2);
  ctx.setLineDash([]);

  const code = weekCode(input.personId, year, week);
  const modules = ean13Modules(code);
  const unit = 4;
  const barX = X + 40;
  ctx.fillStyle = hex("ink");
  for (let m = 0; m < modules.length; m++) {
    if (modules[m] === "1") ctx.fillRect(barX + m * unit, stripY + 28, unit, isGuardModule(m) ? 104 : 92);
  }
  text(`${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`, barX, stripY + 160, 24, 600, "ink");

  const infoX = barX + 95 * unit + 48;
  text(input.personName, infoX, stripY + 52, 32, 800, "ink", { maxWidth: RIGHT - infoX - 24 });
  text(`Εβδ. ${week}/${year}`, infoX, stripY + 94, 26, 600, "ink2");
  text(`${formatHours(s.totalMinutes)} · ${s.shiftCount === 1 ? "1 βάρδια" : `${s.shiftCount} βάρδιες`}`, infoX, stripY + 132, 26, 600, "ink2", {
    maxWidth: RIGHT - infoX - 24,
  });

  text(
    `Από το φύλλο «Πρόγραμμα Τσιμισκή» · έλεγχος ${checkedDate(input.checkedAt)}, ${formatClock(input.checkedAt)}`,
    X,
    1866,
    22,
    500,
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

/** Shares the image where the device supports it (iOS/Android sheet), otherwise downloads it. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // NotAllowedError (gesture expired) and others fall through to a download.
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

/** "1/10/2026" in Athens time: an image outlives "σήμερα". */
function checkedDate(iso: string): string {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date(iso)).split("-");
  return `${Number(d)}/${Number(m)}/${y}`;
}

function longRange(monday: IsoDate, sunday: IsoDate): string {
  const a = fromIso(monday);
  const b = fromIso(sunday);
  if (a.m === b.m) return `${a.d}–${b.d} ${MONTHS_LONG[b.m - 1]} ${b.y}`;
  return `${a.d} ${MONTHS_LONG[a.m - 1]} – ${b.d} ${MONTHS_LONG[b.m - 1]} ${b.y}`;
}

/** Greek capitals drop the tonos: "Πρόγραμμα" → "ΠΡΟΓΡΑΜΜΑ". */
function upperGreek(value: string): string {
  return value.normalize("NFD").replace(/\u0301/g, "").toUpperCase().normalize("NFC");
}

function fit(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}
