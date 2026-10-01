import { TIME_ZONE, type IsoDate } from "../schedule/dates";
import { DAY_SHORT, formatDayMonth } from "../schedule/view";
import { mondayOf, fromIso } from "../schedule/dates";

/** "19:42" in Athens time, independent of the device's time zone and locale data. */
export function formatClock(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

function athensDate(iso: string): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}

/** "σήμερα 19:42", "χθες 08:10" or "Δευ 28 Σεπ, 08:10". */
export function formatCheckedAt(iso: string, today: IsoDate): string {
  const date = athensDate(iso);
  const clock = formatClock(iso);
  if (date === today) return `σήμερα ${clock}`;
  const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
  if (date === yesterday) return `χθες ${clock}`;
  const weekday = DAY_SHORT[(new Date(Date.parse(date)).getUTCDay() + 6) % 7];
  return `${weekday} ${formatDayMonth(date)}, ${clock}`;
}

export function dayNumber(iso: IsoDate): number {
  return fromIso(iso).d;
}

export function isSameWeek(a: IsoDate, b: IsoDate): boolean {
  return mondayOf(a) === mondayOf(b);
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
