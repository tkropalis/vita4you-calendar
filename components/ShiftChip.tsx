import { cx } from "@/lib/client/format";
import type { DayEntry } from "@/lib/schedule/view";

/** One coloured chip per entry: the time for shifts, the label for days off and leave. */
export function ShiftChip({ entry, compact = false }: { entry: DayEntry; compact?: boolean }) {
  if (entry.kind === "shift") {
    const text = compact ? compactRange(entry.start, entry.end) : `${entry.start} – ${entry.end}`;
    return (
      <span className={cx("chip", `chip--${entry.period ?? "morning"}`, compact && "chip--compact")}>
        {entry.timeSource === "inherited" ? (
          <span className="chip__approx" title="Η ώρα δεν γράφεται στο φύλλο· πάρθηκε από τη γραμμή από πάνω">
            ≈
          </span>
        ) : null}
        <span className="chip__time">{text}</span>
      </span>
    );
  }
  if (entry.kind === "off") return <span className={cx("chip chip--off", compact && "chip--compact")}>Ρεπό</span>;
  if (entry.kind === "leave") {
    return (
      <span className={cx("chip chip--leave", compact && "chip--compact")}>
        {compact && entry.label === "Γονική άδεια" ? "Γον. άδεια" : (entry.label ?? "Άδεια")}
      </span>
    );
  }
  return (
    <span className={cx("chip chip--note", compact && "chip--compact")} title={entry.label}>
      {compact ? "Σημ." : "Χωρίς ώρα"}
    </span>
  );
}

/** "08:00","16:00" → "08–16"; keeps minutes only when they matter ("08–15:30"). */
export function compactRange(start?: string, end?: string): string {
  const part = (t?: string) => (t ? (t.endsWith(":00") ? t.slice(0, 2) : t) : "");
  return `${part(start)}–${part(end)}`;
}
