import { readXlsx } from "../xlsx";
import { parseSchedule } from "./parse";
import type { Schedule, ScheduleSnapshot } from "./types";

export const DEFAULT_SHEET_ID = "1nHy_toJCbpsnTEE1aVXvF4YqZnhcmB5ay-rMPvTQs2c";

export function sheetViewUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
}

export function sheetExportUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
}

export function snapshotFromXlsx(bytes: Uint8Array, sheetId: string, fetchedAt: Date): ScheduleSnapshot {
  const schedule = parseSchedule(readXlsx(bytes));
  return {
    ...schedule,
    version: scheduleVersion(schedule),
    fetchedAt: fetchedAt.toISOString(),
    sheetUrl: sheetViewUrl(sheetId),
  };
}

/** Content hash of the parsed schedule: identical rotas give identical versions. */
export function scheduleVersion(schedule: Schedule): string {
  const text = JSON.stringify(schedule);
  // 64-bit FNV-1a over UTF-16 code units, as two 32-bit halves.
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x0100019d) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
