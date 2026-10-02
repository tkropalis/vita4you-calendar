"use client";

import { useSyncExternalStore } from "react";
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

/** Athens "now" that re-renders every minute on the client and is null on the server. */
export function useAthensNow() {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  return minute === null ? null : nowInAthens(new Date(minute * 60_000));
}

/**
 * One status line above the facts: "Σε βάρδια · άλλες 3 ώρες" or
 * "Επόμενη βάρδια: σήμερα 13:00 · σε 5 ώρες". The table's inverted row already marks today.
 */
export function NextShift({ weeks, personId }: { weeks: Week[]; personId: string }) {
  const now = useAthensNow();
  if (!now) return null;
  const status = shiftStatus({ weeks }, personId, now);

  if (status.kind === "on") {
    return (
      <p className="next-shift" role="status">
        <strong>Σε βάρδια</strong> ως {status.shift.end} · {formatLeft(status.minutesLeft)}
      </p>
    );
  }
  if (status.kind === "next") {
    const duty = status.shift.tags.find((t) => t === "Εφημερία" || t === "Ολονυχτία");
    return (
      <p className="next-shift" role="status">
        <strong>Επόμενη βάρδια:</strong> {formatShiftDay(status.shift.date, now.date)} {status.shift.start}
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
