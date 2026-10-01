import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dateCandidates, todayInAthens } from "../lib/schedule/dates";
import { clusterNames, fixMixedScript, slugify } from "../lib/schedule/names";
import { classifyTimeCell, parseSchedule, parseTimeRange } from "../lib/schedule/parse";
import type { Schedule } from "../lib/schedule/types";
import { readXlsx } from "../lib/xlsx";

const synthetic = (): Schedule => parseSchedule(readXlsx(readFileSync("tests/fixtures/synthetic.xlsx")));

const idOf = (schedule: Schedule, name: string) => {
  const person = schedule.people.find((p) => p.name === name);
  if (!person) throw new Error(`no person ${name}: ${schedule.people.map((p) => p.name).join(", ")}`);
  return person.id;
};

describe("xlsx reader", () => {
  it("reads sheets, text and date-formatted cells", () => {
    const sheets = readXlsx(readFileSync("tests/fixtures/synthetic.xlsx"));
    expect(sheets.map((s) => s.name)).toEqual(["Sheet1", "Sheet2"]);
    const sheet2 = sheets[1]!.grid;
    expect(sheet2[1]?.[0]).toEqual({ kind: "text", text: "Δευτέρα" });
    const dated = sheet2.find((row) => row?.[0]?.kind === "date");
    expect(dated?.[0]).toEqual({ kind: "date", date: { y: 2026, m: 9, d: 21 } });
  });
});

describe("dates", () => {
  const cell = (text: string) => ({ kind: "text" as const, text });

  it.each([
    ["17/8/2026", { y: 2026, m: 8, d: 17 }],
    ["18/82026", { y: 2026, m: 8, d: 18 }],
    ["16/9//2026", { y: 2026, m: 9, d: 16 }],
    ["0406/2026", { y: 2026, m: 6, d: 4 }],
    ["19/052026", { y: 2026, m: 5, d: 19 }],
    ["8/2/1/2026", { y: 2026, m: 2, d: 8 }],
  ])("reads %s day-first", (text, expected) => {
    expect(dateCandidates(cell(text), [])).toContainEqual(expected);
  });

  it("uses context years when the year is missing", () => {
    expect(dateCandidates(cell("29/09"), [2025, 2026])).toEqual([
      { y: 2025, m: 9, d: 29 },
      { y: 2026, m: 9, d: 29 },
    ]);
  });

  it("offers the swapped reading of month-first date cells", () => {
    const candidates = dateCandidates({ kind: "date", date: { y: 2026, m: 1, d: 9 } }, []);
    expect(candidates).toContainEqual({ y: 2026, m: 9, d: 1 });
  });

  it("computes today in Athens, not UTC", () => {
    expect(todayInAthens(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
  });
});

describe("names", () => {
  it("replaces Latin look-alikes in Greek names", () => {
    expect(fixMixedScript("Zόγκου Ε.")).toBe("Ζόγκου Ε.");
    expect(fixMixedScript("Aνδρέου Α.")).toBe("Ανδρέου Α.");
  });

  it("merges spelling variants and picks the cleanest display name", () => {
    const { clusters, lookup } = clusterNames(
      new Map([
        ["Ανδρεου Α.", 81],
        ["Άνδρεου Α.", 57],
        ["Ανδρέου Α.", 34],
        ["Γκουγκουτούδη Δ.", 242],
        ["Γκουκουτούδη Δ.", 53],
        ["Κολύρα", 49],
        ["Κολύρα Κ.", 5],
        ["Καφεστίδης Α.", 106],
        ["ΚΑΦΕΣΤΙΔΗΣ", 1],
        ["Σέβα Α.", 147],
        ["Σεβας Α.", 7],
      ]),
    );
    expect(clusters.map((c) => c.name).sort()).toEqual(
      ["Ανδρέου Α.", "Γκουγκουτούδη Δ.", "Καφεστίδης Α.", "Κολύρα Κ.", "Σέβα Α."].sort(),
    );
    expect(lookup.get("ΚΑΦΕΣΤΙΔΗΣ")).toBe(lookup.get("Καφεστίδης Α."));
    expect(lookup.get("Γκουκουτούδη Δ.")).toBe(lookup.get("Γκουγκουτούδη Δ."));
  });

  it("keeps people with the same surname but different initials apart", () => {
    const { clusters } = clusterNames(new Map([["Παπαδάκη Μ.", 10], ["Παπαδάκη Ε.", 8]]));
    expect(clusters).toHaveLength(2);
  });

  it("makes Greeklish slugs", () => {
    expect(slugify("Χαμζαλάρι Γ.")).toBe("chamzalari-g");
    expect(slugify("Γκουγκουτούδη Δ.")).toBe("gkougkoutoudi-d");
  });
});

describe("time column", () => {
  it.each([
    ["08:00-16:00", { type: "shift", start: "08:00", end: "16:00", tags: [] }],
    ["16:00-00:00 εφημερία ", { type: "shift", start: "16:00", end: "00:00", tags: ["Εφημερία"] }],
    ["16:00-00-00", { type: "shift", start: "16:00", end: "00:00", tags: [] }],
    ["12:00-20:01", { type: "shift", start: "12:00", end: "20:00", tags: [] }],
    ["ρεπο", { type: "off" }],
    ["ΑΔΕΙΑ", { type: "leave", label: "Άδεια" }],
    ["ΓΟΝΙΚΗ ΑΔΕΙΑ", { type: "leave", label: "Γονική άδεια" }],
    ["Μέτα Κ.", { type: "other", text: "Μέτα Κ." }],
    ["", { type: "empty" }],
  ])("classifies %j", (text, expected) => {
    expect(classifyTimeCell(text)).toEqual(expected);
  });

  it("ignores text without a time range", () => {
    expect(parseTimeRange("ΕΦΗΜΕΡΙΑ")).toBeNull();
  });
});

describe("parseSchedule (synthetic rota)", () => {
  it("finds every week and resolves messy dates by weekday voting", () => {
    const schedule = synthetic();
    expect(schedule.weeks.map((w) => w.monday)).toEqual([
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ]);
    expect(schedule.weeks.every((w) => !w.warnings.some((x) => x.type === "dates-inferred"))).toBe(true);
  });

  it("merges name variants into people", () => {
    const names = synthetic().people.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(["Αλεξίου Ν.", "Βλάχου Ρ.", "Ζαφειρίου Θ.", "Δημητρίου Λ.", "Στεφανάκη Μ.", "Καραλής Π."]),
    );
    expect(names).toHaveLength(7);
  });

  it("reads one person's week", () => {
    const schedule = synthetic();
    const week = schedule.weeks.find((w) => w.monday === "2026-09-14")!;
    const alexiou = idOf(schedule, "Αλεξίου Ν.");
    const mine = week.assignments
      .filter((a) => a.personId === alexiou)
      .map((a) => [a.day, a.kind, a.start, a.end, a.timeSource]);
    expect(mine).toEqual(
      expect.arrayContaining([
        [0, "shift", "08:00", "16:00", "row"],
        [1, "shift", "08:00", "16:00", "row"],
        [2, "shift", "13:00", "21:00", "row"],
        [3, "off", undefined, undefined, undefined],
        [4, "shift", "08:00", "15:00", "override"],
        [5, "off", undefined, undefined, undefined],
      ]),
    );
    expect(mine).toHaveLength(6);
  });

  it("inherits the time of the row above when the time cell is blank", () => {
    const schedule = synthetic();
    const week = schedule.weeks.find((w) => w.monday === "2026-09-14")!;
    const stefanaki = idOf(schedule, "Στεφανάκη Μ.");
    const monday = week.assignments.find((a) => a.personId === stefanaki && a.day === 0)!;
    expect(monday).toMatchObject({ kind: "shift", start: "13:00", end: "21:00", timeSource: "inherited" });
    expect(week.warnings).toContainEqual({ type: "times-inferred", rows: [6] });
  });

  it("keeps notes, duty tags and leave types", () => {
    const schedule = synthetic();
    const week = schedule.weeks.find((w) => w.monday === "2026-09-14")!;
    const vlachou = idOf(schedule, "Βλάχου Ρ.");
    expect(week.assignments.find((a) => a.personId === vlachou && a.day === 5)).toMatchObject({
      kind: "shift",
      start: "16:00",
      end: "00:00",
      tags: ["Εφημερία"],
    });
    expect(week.assignments.find((a) => a.personId === vlachou && a.day === 4)).toMatchObject({
      kind: "leave",
      label: "Γονική άδεια",
    });
    const orfanou = idOf(schedule, "Ορφανού Ε.");
    expect(week.assignments.find((a) => a.personId === orfanou && a.day === 0)).toMatchObject({
      kind: "leave",
      label: "Άδεια",
      tags: [],
    });
  });

  it("skips staff roster rows", () => {
    const schedule = synthetic();
    const sept21 = schedule.weeks.find((w) => w.monday === "2026-09-21")!;
    expect(sept21.assignments.every((a) => a.row < 30)).toBe(true);
    expect(sept21.assignments).toHaveLength(4);
  });

  it("lets a later block replace an earlier one for the same week", () => {
    const schedule = synthetic();
    const oct5 = schedule.weeks.find((w) => w.monday === "2026-10-05")!;
    expect(oct5.assignments).toHaveLength(1);
    expect(oct5.assignments[0]).toMatchObject({ start: "13:00", end: "21:00" });
    expect(oct5.warnings.some((w) => w.type === "duplicate")).toBe(true);
  });

  it("prefers Sheet2 over the stale Sheet1 draft", () => {
    const schedule = synthetic();
    const sept14 = schedule.weeks.find((w) => w.monday === "2026-09-14")!;
    expect(sept14.sheet).toBe("Sheet2");
  });
});
