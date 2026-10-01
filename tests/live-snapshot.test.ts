import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSchedule } from "../lib/schedule/parse";
import { personWeek, summarize } from "../lib/schedule/view";
import { readXlsx } from "../lib/xlsx";

/**
 * Regression test against a real export of the rota. The file holds staff
 * names, so it is not committed: download it with `npm run snapshot` (see
 * tests/README.md) to run these tests locally.
 */
const FILE = "tests/fixtures/live-snapshot.xlsx";

describe.skipIf(!existsSync(FILE))("live snapshot (2026-10-01 export)", () => {
  const schedule = existsSync(FILE) ? parseSchedule(readXlsx(readFileSync(FILE))) : { weeks: [], people: [] };

  it("resolves every week block from 29/9/2025 to 5/10/2026", () => {
    expect(schedule.weeks[0]?.monday).toBe("2025-09-29");
    expect(schedule.weeks.at(-1)?.monday).toBe("2026-10-05");
    expect(schedule.weeks.length).toBeGreaterThanOrEqual(53);
    expect(schedule.weeks.some((w) => w.warnings.some((x) => x.type === "dates-inferred"))).toBe(false);
  });

  it("merges every spelling of a person", () => {
    expect(schedule.people.map((p) => p.name)).toEqual(
      expect.arrayContaining(["Ζόγκου Ε.", "Ανδρέου Α.", "Γκουγκουτούδη Δ.", "Κολύρα Κ.", "Καφεστίδης Α.", "Σέβα Α."]),
    );
    expect(schedule.people).toHaveLength(12);
  });

  it("reads Κόντρα Α.'s week of 28/9/2026 exactly as the sheet shows it", () => {
    const kontra = schedule.people.find((p) => p.name === "Κόντρα Α.")!;
    const week = schedule.weeks.find((w) => w.monday === "2026-09-28");
    const names = new Map(schedule.people.map((p) => [p.id, p.name]));
    const days = personWeek(week, "2026-09-28", kontra.id, names);
    const shape = days.map((d) => d.entries.map((e) => (e.kind === "shift" ? `${e.start}-${e.end}` : e.kind)).join(","));
    expect(shape).toEqual(["off", "09:00-17:00", "13:00-21:00", "08:00-16:00", "13:00-21:00", "08:00-16:00", ""]);
    const summary = summarize(days);
    expect(summary.offDays).toEqual([0]);
    expect(summary.sunday).toEqual([]);
    expect(summary.totalMinutes).toBe(5 * 8 * 60);
    expect(days[3]!.entries[0]!.coworkers).toEqual(["Παπακώστα Β."]);
  });
});
