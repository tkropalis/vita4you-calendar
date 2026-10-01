import "server-only";
import { readFile } from "node:fs/promises";
import { DEFAULT_SHEET_ID, sheetExportUrl, snapshotFromXlsx } from "./snapshot";
import type { ScheduleSnapshot } from "./types";

/**
 * Reads the rota from Google Sheets. The sheet is shared as "anyone with the
 * link can view", so its xlsx export needs no credentials.
 *
 * Results are kept in memory for a few minutes so ordinary page views don't
 * hit Google; the refresh button bypasses that cache.
 */

const SHEET_ID = process.env.SHEET_ID || DEFAULT_SHEET_ID;
/** Local .xlsx to read instead of Google (offline development and tests). */
const SHEET_FILE = process.env.SHEET_FILE;
const TTL_MS = Number(process.env.SHEET_CACHE_SECONDS ?? 300) * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export type ScheduleResult = {
  snapshot: ScheduleSnapshot;
  /** Set when Google could not be reached and an older copy is served instead. */
  staleReason?: string;
};

let cached: { snapshot: ScheduleSnapshot; at: number } | null = null;
let inflight: Promise<ScheduleSnapshot> | null = null;

export async function getSchedule(options: { fresh?: boolean } = {}): Promise<ScheduleResult> {
  const now = Date.now();
  if (!options.fresh && cached && now - cached.at < TTL_MS) {
    return { snapshot: cached.snapshot };
  }

  try {
    inflight ??= load().finally(() => {
      inflight = null;
    });
    const snapshot = await inflight;
    cached = { snapshot, at: Date.now() };
    return { snapshot };
  } catch (error) {
    if (cached) {
      console.error("[schedule] refresh failed, serving cached copy", error);
      return { snapshot: cached.snapshot, staleReason: describe(error) };
    }
    throw error;
  }
}

async function load(): Promise<ScheduleSnapshot> {
  const fetchedAt = new Date();
  if (SHEET_FILE) {
    const bytes = await readFile(SHEET_FILE);
    return snapshotFromXlsx(new Uint8Array(bytes), SHEET_ID, fetchedAt);
  }

  const response = await fetch(sheetExportUrl(SHEET_ID), {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Sheets export failed: HTTP ${response.status}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/html")) {
    // Google answers with a sign-in page when the sheet stops being public.
    throw new Error("Google Sheets returned a web page instead of the file. Is the sheet still shared publicly?");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return snapshotFromXlsx(bytes, SHEET_ID, fetchedAt);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
