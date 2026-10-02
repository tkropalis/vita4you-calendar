import { describe, expect, it } from "vitest";
import { sheetIssues } from "../lib/schedule/checks";
import { dayAlternatives, formatIn, formatShiftDay, localMinute, nowInAthens, shiftStatus } from "../lib/schedule/timeline";
import type { Assignment, Schedule, Week } from "../lib/schedule/types";

const a = (personId: string, day: number, kind: Assignment["kind"], start?: string, end?: string, row = 10): Assignment => ({
  personId, day, kind, start, end, tags: [], row, timeSource: start ? "row" : undefined,
});
const week = (monday: string, assignments: Assignment[], warnings: Week["warnings"] = []): Week => ({
  monday, sheet: "Sheet2", headerRow: 1, assignments, warnings,
});
const people = ["p", "q", "r"].map((id) => ({ id, name: id.toUpperCase(), lastSeen: "2026-09-28", variants: [id.toUpperCase()] }));

describe("shift status", () => {
  const schedule = {
    weeks: [
      week("2026-09-28", [a("p", 3, "shift", "08:00", "16:00"), a("p", 5, "shift", "16:00", "00:00")]),
      week("2026-10-05", [a("p", 0, "shift", "13:00", "21:00")]),
    ],
  };

  it("knows when you are on shift", () => {
    const status = shiftStatus(schedule, "p", { minute: localMinute("2026-10-01", "10:30") });
    expect(status).toMatchObject({ kind: "on", minutesLeft: 330 });
  });

  it("finds the next shift, across weeks and overnight", () => {
    expect(shiftStatus(schedule, "p", { minute: localMinute("2026-10-01", "17:00") })).toMatchObject({
      kind: "next",
      shift: { date: "2026-10-03", start: "16:00" },
    });
    expect(shiftStatus(schedule, "p", { minute: localMinute("2026-10-03", "23:30") })).toMatchObject({ kind: "on", minutesLeft: 30 });
    expect(shiftStatus(schedule, "p", { minute: localMinute("2026-10-04", "09:00") })).toMatchObject({
      kind: "next",
      shift: { date: "2026-10-05" },
    });
    expect(shiftStatus(schedule, "p", { minute: localMinute("2026-10-06", "09:00") })).toEqual({ kind: "none" });
  });

  it("reads Athens wall-clock time", () => {
    const now = nowInAthens(new Date("2026-10-01T21:15:00Z"));
    expect(now.date).toBe("2026-10-02");
    expect(now.minute).toBe(localMinute("2026-10-02", "00:15"));
  });

  it("formats relative times in Greek", () => {
    expect(formatIn(45)).toBe("σε 45 λεπτά");
    expect(formatIn(60)).toBe("σε 1 ώρα");
    expect(formatIn(14 * 60)).toBe("σε 14 ώρες");
    expect(formatIn(3 * 1440)).toBe("σε 3 μέρες");
    expect(formatShiftDay("2026-10-02", "2026-10-01")).toBe("αύριο");
    expect(formatShiftDay("2026-10-03", "2026-10-01")).toBe("Σάββατο 3/10");
  });
});

describe("swap alternatives", () => {
  it("lists who is off and who is on another shift", () => {
    const w = week("2026-09-28", [
      a("p", 1, "shift", "08:00", "16:00"),
      a("q", 1, "off"),
      a("r", 1, "shift", "13:00", "21:00"),
      a("s", 1, "shift", "08:00", "16:00"),
      a("t", 1, "leave"),
    ]);
    const names = new Map([["q", "Q"], ["r", "R"], ["s", "S"], ["t", "T"]]);
    expect(dayAlternatives(w, 1, "p", names, { start: "08:00", end: "16:00" })).toEqual({
      off: ["Q"],
      leave: ["T"],
      shifts: [{ start: "13:00", end: "21:00", names: ["R"] }],
    });
  });
});

describe("sheet checks", () => {
  const titles = (schedule: Schedule) => sheetIssues(schedule, "2026-01-01").map((i) => `${i.severity}: ${i.title}`);

  it("flags short rest, double booking, missing coverage and long runs", () => {
    const schedule: Schedule = {
      people,
      weeks: [
        week("2026-09-28", [
          // P: 16:00–00:00 then 08:00 next day = 8 hours rest
          a("p", 0, "shift", "16:00", "00:00"),
          a("p", 1, "shift", "08:00", "16:00"),
          a("p", 1, "off"),
          // Q works every day for 7 days
          ...[0, 1, 2, 3, 4, 5, 6].map((d) => a("q", d, "shift", "09:00", "17:00")),
          // Tuesday has no one after 20:00 except nobody; Monday has P until midnight
        ]),
      ],
    };
    const t = titles(schedule);
    expect(t).toContain("warning: P: 8 ώρες ανάπαυση");
    expect(t).toContain("error: P: βάρδια και ρεπό την ίδια μέρα");
    expect(t).toContain("warning: Q: 7 μέρες εργασίας");
    expect(t).toContain("warning: Q: 7 μέρες στη σειρά");
    expect(t).toContain("info: Q: 56 ώρες");
    expect(t.some((x) => x.includes("κανείς το βράδυ"))).toBe(true);
  });

  it("turns parser warnings into sheet fixes", () => {
    const schedule: Schedule = {
      people,
      weeks: [week("2026-09-28", [a("p", 0, "shift", "08:00", "21:00")], [{ type: "times-inferred", rows: [12] }, { type: "duplicate", otherRow: 3 }])],
    };
    const issues = sheetIssues(schedule, "2026-01-01");
    expect(issues[0]).toMatchObject({ severity: "error", title: "Η εβδομάδα υπάρχει δύο φορές" });
    expect(issues.some((i) => i.row === 12 && i.title === "Λείπει η ώρα")).toBe(true);
  });
});

describe("time left", async () => {
  const { formatLeft } = await import("../lib/schedule/timeline");
  it("agrees in gender and number", () => {
    expect(formatLeft(20)).toBe("άλλα 20 λεπτά");
    expect(formatLeft(60)).toBe("άλλη 1 ώρα");
    expect(formatLeft(180)).toBe("άλλες 3 ώρες");
  });
});
