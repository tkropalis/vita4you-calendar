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

/** Athens "now" that re-renders every minute on the client and is null on the server. */
export function useAthensNow() {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  return minute === null ? null : nowInAthens(new Date(minute * 60_000));
}

/** Live suffix for today's box: "σε 5 ώρες" or "σε βάρδια, άλλες 3 ώρες". */
export function TodayLive({ weeks, personId, date }: { weeks: Week[]; personId: string; date: IsoDate }) {
  const now = useAthensNow();
  if (!now || now.date !== date) return null;
  const status = shiftStatus({ weeks }, personId, now);
  if (status.kind === "on") return <> · σε βάρδια, {formatLeft(status.minutesLeft)}</>;
  if (status.kind === "next" && status.shift.date === date) return <> · {formatIn(status.minutesUntil)}</>;
  return null;
}

/**
 * "Επόμενη βάρδια: αύριο 08:00 · σε 14 ώρες", shown only when the next shift is on a later day
 * (today's box already says when today's shift starts).
 */
export function NextShift({ weeks, personId, todayHasShift }: { weeks: Week[]; personId: string; todayHasShift: boolean }) {
  const now = useAthensNow();
  if (!now) return null;
  const status = shiftStatus({ weeks }, personId, now);
  const today: IsoDate = now.date;

  if (status.kind === "on") return null;
  if (status.kind === "next" && status.shift.date === today && todayHasShift) return null;
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
