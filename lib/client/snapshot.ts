import type { IsoDate } from "../schedule/dates";
import type { ScheduleSnapshot } from "../schedule/types";
import { windowWeeks } from "../schedule/view";

/** The slice of the schedule sent to the browser: recent and upcoming weeks only. */
export type ClientSnapshot = ScheduleSnapshot;

export function toClientSnapshot(snapshot: ScheduleSnapshot, today: IsoDate): ClientSnapshot {
  return { ...snapshot, ...windowWeeks(snapshot, today) };
}

export const PERSON_COOKIE = "v4y-person";
