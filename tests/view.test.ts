import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCalendar } from "../lib/ics";
import { parseSchedule } from "../lib/schedule/parse";
import {
  currentStaff,
  formatHours,
  formatWeekRange,
  minutesOf,
  personWeek,
  summarize,
  teamWeek,
} from "../lib/schedule/view";
import { readXlsx } from "../lib/xlsx";

const schedule = parseSchedule(readXlsx(readFileSync("tests/fixtures/synthetic.xlsx")));
const names = new Map(schedule.people.map((p) => [p.id, p.name]));
const id = (name: string) => schedule.people.find((p) => p.name === name)!.id;
const sept14 = schedule.weeks.find((w) => w.monday === "2026-09-14")!;

describe("person week", () => {
  const days = personWeek(sept14, "2026-09-14", id("Αλεξίου Ν."), names);

  it("lists coworkers on the same shift", () => {
    expect(days[0]!.entries[0]!.coworkers).toEqual([]);
    expect(days[2]!.entries[0]!.coworkers).toEqual([]);
    const zaf = personWeek(sept14, "2026-09-14", id("Ζαφειρίου Θ."), names);
    expect(zaf[1]!.entries[0]!.coworkers).toEqual(["Στεφανάκη Μ."]);
  });

  it("summarizes days off, Sunday and hours", () => {
    const summary = summarize(days);
    expect(summary.offDays).toEqual([3, 5]);
    expect(summary.sunday).toEqual([]);
    expect(summary.shiftCount).toBe(4);
    expect(summary.totalMinutes).toBe(8 * 60 * 3 + 7 * 60);
  });

  it("reports Sunday shifts", () => {
    const sept21 = schedule.weeks.find((w) => w.monday === "2026-09-21")!;
    const summary = summarize(personWeek(sept21, "2026-09-21", id("Αλεξίου Ν."), names));
    expect(summary.sunday).toHaveLength(1);
    expect(summary.sunday[0]).toMatchObject({ start: "08:00", tags: ["Εφημερία"] });
  });
});

describe("helpers", () => {
  it("measures shifts, including overnight ones", () => {
    expect(minutesOf("08:00", "16:00")).toBe(480);
    expect(minutesOf("16:00", "00:00")).toBe(480);
    expect(minutesOf("16:00", "23:59")).toBe(480);
    expect(minutesOf("16:00", "12:00")).toBeNull();
  });

  it("formats Greek hours and ranges", () => {
    expect(formatHours(480)).toBe("8 ώρες");
    expect(formatHours(450)).toBe("7,5 ώρες");
    expect(formatHours(60)).toBe("1 ώρα");
    expect(formatWeekRange("2026-09-28")).toBe("28 Σεπ – 4 Οκτ");
    expect(formatWeekRange("2026-10-05")).toBe("5–11 Οκτ");
  });

  it("lists only recently seen people as current staff", () => {
    const staff = currentStaff(
      [
        { id: "a", name: "A", lastSeen: "2026-09-28", variants: [] },
        { id: "b", name: "B", lastSeen: "2026-06-01", variants: [] },
      ],
      "2026-10-01",
    );
    expect(staff.map((p) => p.id)).toEqual(["a"]);
  });

  it("builds the team grid", () => {
    const rows = teamWeek(sept14, "2026-09-14", schedule.people);
    expect(rows.length).toBe(7);
    expect(rows.every((r) => r.days.length === 7)).toBe(true);
  });
});

describe("calendar export", () => {
  it("writes valid iCalendar with overnight shifts ending the next day", () => {
    const vlachou = id("Βλάχου Ρ.");
    const ics = buildCalendar({
      personId: vlachou,
      personName: "Βλάχου Ρ.",
      weeks: [{ monday: "2026-09-14", days: personWeek(sept14, "2026-09-14", vlachou, names) }],
      now: new Date("2026-09-10T10:00:00Z"),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;TZID=Europe/Athens:20260919T160000");
    expect(ics).toContain("DTEND;TZID=Europe/Athens:20260920T000000");
    expect(ics).toContain("SUMMARY:Ρεπό");
    expect(ics).toContain("SUMMARY:Γονική άδεια");
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe("week code", async () => {
  const { ean13CheckDigit, ean13Modules, weekCode } = await import("../lib/barcode");
  const { isoWeek } = await import("../lib/schedule/dates");

  it("computes ISO weeks", () => {
    expect(isoWeek("2026-09-28")).toEqual({ year: 2026, week: 40 });
    expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 });
  });

  it("builds valid in-store EAN-13 codes", () => {
    expect(ean13CheckDigit("400638133393")).toBe(1);
    const code = weekCode("kontra-a", 2026, 40);
    expect(code).toMatch(/^202640\d{7}$/);
    expect(ean13CheckDigit(code.slice(0, 12))).toBe(Number(code[12]));
    expect(ean13Modules(code)).toHaveLength(95);
    // Known reference: 4006381333931
    expect(ean13Modules("4006381333931").slice(0, 17)).toBe("10100011010100111");
  });
});
