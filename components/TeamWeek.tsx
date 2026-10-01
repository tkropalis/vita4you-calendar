"use client";

import { useState } from "react";
import { cx, dayNumber } from "@/lib/client/format";
import { addDays, type IsoDate } from "@/lib/schedule/dates";
import type { Person, Week } from "@/lib/schedule/types";
import { DAY_NAMES, DAY_SHORT, PERIOD_LABEL, teamWeek, type DayEntry, type TeamRow } from "@/lib/schedule/view";
import { ShiftChip } from "./ShiftChip";

type Props = {
  week: Week | undefined;
  monday: IsoDate;
  today: IsoDate;
  people: Person[];
  selectedId: string | null;
  weekStatus: "published" | "upcoming" | "missing";
};

export function TeamWeek({ week, monday, today, people, selectedId, weekStatus }: Props) {
  const todayIndex = Math.round((Date.parse(today) - Date.parse(monday)) / 86_400_000);
  const [day, setDay] = useState(todayIndex >= 0 && todayIndex < 7 ? todayIndex : 0);
  const rows = teamWeek(week, monday, people);

  if (weekStatus !== "published" || rows.length === 0) {
    return (
      <div className="empty">
        <h3 className="empty__title">
          {weekStatus === "upcoming" ? "Δεν έχει αναρτηθεί ακόμα" : "Δεν υπάρχει πρόγραμμα"}
        </h3>
        <p className="empty__text">Το φύλλο δεν έχει βάρδιες για αυτή την εβδομάδα.</p>
      </div>
    );
  }

  return (
    <div className="team">
      <Legend rows={rows} />
      <TeamMatrix rows={rows} monday={monday} today={today} selectedId={selectedId} />
      <TeamDay
        rows={rows}
        monday={monday}
        today={today}
        day={day}
        onDayChange={setDay}
        selectedId={selectedId}
      />
    </div>
  );
}

/** Colour key for the matrix, listing only what this week contains. */
function Legend({ rows }: { rows: TeamRow[] }) {
  const entries = rows.flatMap((r) => r.days.flat());
  const has = (test: (e: DayEntry) => boolean) => entries.some(test);
  const items = [
    has((e) => e.period === "morning") && { className: "chip--morning", label: PERIOD_LABEL.morning },
    has((e) => e.period === "afternoon") && { className: "chip--afternoon", label: PERIOD_LABEL.afternoon },
    has((e) => e.period === "duty") && {
      className: "chip--duty",
      label: has((e) => e.tags.includes("Εφημερία")) ? "Βραδινή / Εφημερία" : PERIOD_LABEL.duty,
    },
    has((e) => e.kind === "off") && { className: "chip--off", label: "Ρεπό" },
    has((e) => e.kind === "leave") && { className: "chip--leave", label: "Άδεια" },
  ].filter((item): item is { className: string; label: string } => Boolean(item));

  return (
    <ul className="legend" aria-label="Υπόμνημα χρωμάτων">
      {items.map((item) => (
        <li key={item.className}>
          <span className={`chip chip--compact ${item.className}`}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Wide screens: people × days, like the sheet but readable. */
function TeamMatrix({ rows, monday, today, selectedId }: { rows: TeamRow[]; monday: IsoDate; today: IsoDate; selectedId: string | null }) {
  return (
    <div className="team-matrix" tabIndex={0} role="region" aria-label="Πρόγραμμα ομάδας ανά ημέρα">
      <table>
        <thead>
          <tr>
            <th scope="col" className="team-matrix__corner">
              Όνομα
            </th>
            {DAY_SHORT.map((short, i) => {
              const date = addDays(monday, i);
              return (
                <th key={short} scope="col" className={cx(date === today && "is-today")}>
                  <span className="team-matrix__dow">{short}</span>
                  <span className="team-matrix__num">{dayNumber(date)}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.person.id} className={cx(row.person.id === selectedId && "is-selected")}>
              <th scope="row">{row.person.name}</th>
              {row.days.map((entries, i) => (
                <td key={i} className={cx(addDays(monday, i) === today && "is-today")}>
                  {entries.length ? (
                    <span className="team-matrix__cell">
                      {entries.map((entry, n) => (
                        <ShiftChip key={n} entry={entry} compact />
                      ))}
                    </span>
                  ) : (
                    <>
                      <span className="team-matrix__none" aria-hidden="true">
                        ·
                      </span>
                      <span className="visually-hidden">Χωρίς βάρδια</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Group = { key: string; title: React.ReactNode; caption: string; names: { id: string; name: string; entry: DayEntry }[] };

/** Phones: pick a day, see who works when. */
function TeamDay({
  rows,
  monday,
  today,
  day,
  onDayChange,
  selectedId,
}: {
  rows: TeamRow[];
  monday: IsoDate;
  today: IsoDate;
  day: number;
  onDayChange: (day: number) => void;
  selectedId: string | null;
}) {
  const groups = groupDay(rows, day);
  return (
    <div className="team-day">
      <div className="daypicker" role="group" aria-label="Ημέρα">
        {DAY_SHORT.map((short, i) => {
          const date = addDays(monday, i);
          return (
            <button
              key={short}
              type="button"
              className={cx("daypicker__day", date === today && "is-today")}
              aria-pressed={i === day}
              aria-label={`${DAY_NAMES[i]} ${dayNumber(date)}`}
              onClick={() => onDayChange(i)}
            >
              <span className="daypicker__dow" aria-hidden="true">{short}</span>
              <span className="daypicker__num" aria-hidden="true">{dayNumber(date)}</span>
            </button>
          );
        })}
      </div>

      <h3 className="visually-hidden">{DAY_NAMES[day]}</h3>
      {groups.length === 0 ? (
        <p className="day__empty team-day__empty">Κανείς δεν έχει βάρδια αυτή τη μέρα.</p>
      ) : (
        <div className="team-groups">
          {groups.map((group) => (
            <section key={group.key} className="team-group" aria-label={group.caption}>
              <div className="team-group__head">
                {group.title}
                <span className="team-group__caption">{group.caption}</span>
              </div>
              <ul className="team-group__names">
                {group.names.map(({ id, name }) => (
                  <li key={id} className={cx(id === selectedId && "is-selected")}>
                    {name}
                    {id === selectedId ? <span className="visually-hidden"> (εσύ)</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupDay(rows: TeamRow[], day: number): Group[] {
  const shifts = new Map<string, Group>();
  const off: Group["names"] = [];
  const leave: Group["names"] = [];
  const other: Group["names"] = [];

  for (const row of rows) {
    for (const entry of row.days[day] ?? []) {
      const item = { id: row.person.id, name: row.person.name, entry };
      if (entry.kind === "shift") {
        const key = `${entry.start}-${entry.end}`;
        if (!shifts.has(key)) {
          const duty = entry.tags.find((t) => t === "Εφημερία" || t === "Ολονυχτία");
          shifts.set(key, {
            key,
            title: <ShiftChip entry={entry} />,
            caption: duty ?? PERIOD_LABEL[entry.period ?? "morning"],
            names: [],
          });
        }
        shifts.get(key)!.names.push(item);
      } else if (entry.kind === "off") off.push(item);
      else if (entry.kind === "leave") leave.push(item);
      else other.push(item);
    }
  }

  const ordered = [...shifts.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const group of ordered) {
    group.caption = `${group.caption} · ${countLabel(group.names.length)}`;
  }
  const tail: Group[] = [];
  if (off.length) tail.push({ key: "off", title: <span className="chip chip--off">Ρεπό</span>, caption: countLabel(off.length), names: off });
  if (leave.length) tail.push({ key: "leave", title: <span className="chip chip--leave">Άδεια</span>, caption: countLabel(leave.length), names: leave });
  if (other.length) tail.push({ key: "other", title: <span className="chip chip--note">Χωρίς ώρα</span>, caption: countLabel(other.length), names: other });
  return [...ordered, ...tail];
}

function countLabel(n: number): string {
  return n === 1 ? "1 άτομο" : `${n} άτομα`;
}
