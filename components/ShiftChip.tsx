import { cx } from "@/lib/client/format";
import type { DayEntry } from "@/lib/schedule/view";

/** One entry as printed on the notice: hours for shifts, a word for days off and leave. */
export function ShiftChip({ entry, compact = false }: { entry: DayEntry; compact?: boolean }) {
  if (entry.kind === "shift") {
    const duty = entry.tags.find((t) => t === "Εφημερία" || t === "Ολονυχτία");
    return (
      <span className={cx("slot", compact && "slot--compact")}>
        {entry.timeSource === "inherited" ? (
          <span className="slot__approx" title="Η ώρα δεν γράφεται στο φύλλο· πάρθηκε από τη γραμμή από πάνω">
            ≈
          </span>
        ) : null}
        <span className="slot__time">{compactRange(entry.start, entry.end)}</span>
        {duty ? <span className="slot__duty">{duty}</span> : null}
      </span>
    );
  }
  if (entry.kind === "off") return <span className={cx("slot slot--off", compact && "slot--compact")}>Ρεπό</span>;
  if (entry.kind === "leave") {
    return (
      <span className={cx("slot slot--leave", compact && "slot--compact")}>
        {compact && entry.label === "Γονική άδεια" ? "Γον. άδεια" : (entry.label ?? "Άδεια")}
      </span>
    );
  }
  return (
    <span className={cx("slot slot--note", compact && "slot--compact")} title={entry.label}>
      Χωρίς ώρα
    </span>
  );
}

/** "08:00","16:00" → "08–16"; keeps minutes only when they matter ("08–15:30"). */
export function compactRange(start?: string, end?: string): string {
  const part = (t?: string) => (t ? (t.endsWith(":00") ? t.slice(0, 2) : t) : "");
  return `${part(start)}–${part(end)}`;
}
