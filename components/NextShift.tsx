"use client";

import { useSyncExternalStore } from "react";
import type { IsoDate } from "@/lib/schedule/dates";
import { formatIn, formatLeft, formatShiftDay, nowInAthens, shiftStatus } from "@/lib/schedule/timeline";
import type { Week } from "@/lib/schedule/types";

// A minute clock shared by every subscriber; the server renders nothing, so hydration never mismatches.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 30_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const currentMinute = () => Math.floor(Date.now() / 60_000);

/** "Σε βάρδια τώρα · έως 21:00" or "Επόμενη βάρδια: αύριο 08:00 · σε 14 ώρες". */
export function NextShift({ weeks, personId }: { weeks: Week[]; personId: string }) {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  if (minute === null) return <p className="next-shift next-shift--pending" aria-hidden="true" />;

  const now = nowInAthens(new Date(minute * 60_000));
  const status = shiftStatus({ weeks }, personId, now);
  const today: IsoDate = now.date;

  if (status.kind === "on") {
    return (
      <p className="next-shift next-shift--on" role="status">
        <strong>Σε βάρδια τώρα</strong> · έως {status.shift.end} ({formatLeft(status.minutesLeft)})
      </p>
    );
  }
  if (status.kind === "next") {
    const duty = status.shift.tags.find((t) => t === "Εφημερία" || t === "Ολονυχτία");
    return (
      <p className="next-shift" role="status">
        <strong>Επόμενη βάρδια:</strong> {formatShiftDay(status.shift.date, today)} {status.shift.start}
        {duty ? ` (${duty.toLowerCase()})` : ""} · {formatIn(status.minutesUntil)}
      </p>
    );
  }
  return (
    <p className="next-shift" role="status">
      Δεν υπάρχει επόμενη βάρδια στο φύλλο ακόμα.
    </p>
  );
}
