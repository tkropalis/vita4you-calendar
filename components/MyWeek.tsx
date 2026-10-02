"use client";

import { CalendarPlus, ChevronRight, ImageDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { renderWeekImage, shareOrDownload, weekImageFilename } from "@/lib/client/exportImage";
import { cx, dayNumber } from "@/lib/client/format";
import type { IsoDate } from "@/lib/schedule/dates";
import type { Person } from "@/lib/schedule/types";
import {
  DAY_NAMES,
  DAY_SHORT,
  formatDayMonth,
  formatHours,
  joinNames,
  type DayEntry,
  type PersonDay,
  type WeekSummary,
} from "@/lib/schedule/view";
import type { Week } from "@/lib/schedule/types";
import { NextShift } from "./NextShift";
import { ShiftChip, compactRange } from "./ShiftChip";

type Props = {
  staff: Person[];
  onSelectPerson: (id: string) => void;
  person: Person | null;
  week: IsoDate;
  today: IsoDate;
  days: PersonDay[] | null;
  summary: WeekSummary | null;
  weekStatus: "published" | "upcoming" | "missing";
  changed: Set<string>;
  checkedAt: string;
  /** All loaded weeks, for the next-shift line. */
  weeks: Week[];
  isCurrentWeek: boolean;
  onGoToCurrentWeek: () => void;
  onRefresh: () => void;
};

export function MyWeek(props: Props) {
  const { staff, onSelectPerson, person, week, today, days, summary, weekStatus, changed } = props;

  if (!person || !days || !summary) {
    return (
      <div className="empty empty--pick">
        <h3 className="empty__title">Ποιο είναι το όνομά σου;</h3>
        <p className="empty__text">
          Θα δεις τις βάρδιές σου, το ρεπό σου και αν δουλεύεις Κυριακή. Η επιλογή μένει σε αυτή τη συσκευή.
        </p>
        <ul className="pick-list">
          {staff.map((p) => (
            <li key={p.id}>
              <button type="button" className="pick-list__item" onClick={() => onSelectPerson(p.id)}>
                <span className="pick-list__name">{p.name}</span>
                <ChevronRight aria-hidden="true" className="icon pick-list__chevron" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (weekStatus !== "published") {
    return (
      <div className="empty">
        <h3 className="empty__title">
          {weekStatus === "upcoming" ? "Δεν έχει αναρτηθεί ακόμα" : "Η εβδομάδα λείπει από το φύλλο"}
        </h3>
        <p className="empty__text">
          {weekStatus === "upcoming"
            ? "Το πρόγραμμα αυτής της εβδομάδας δεν υπάρχει ακόμα στο φύλλο. Πάτα «Ανανέωση» για να δεις αν ανέβηκε."
            : "Το φύλλο δεν έχει πρόγραμμα για αυτή την εβδομάδα."}
        </p>
        <div className="empty__actions">
          {weekStatus === "upcoming" ? (
            <button type="button" className="button button--primary" onClick={props.onRefresh}>
              Ανανέωση
            </button>
          ) : null}
          <button type="button" className="button" onClick={props.onGoToCurrentWeek}>
            Τρέχουσα εβδομάδα
          </button>
        </div>
      </div>
    );
  }

  const absent = days.every((d) => d.entries.length === 0);

  return (
    <div className="myweek">
      <div className="myweek__lead">
        {props.isCurrentWeek ? <NextShift weeks={props.weeks} personId={person.id} /> : null}
        {absent ? (
          <p className="notice-text">
            Δεν εμφανίζεσαι στο πρόγραμμα αυτής της εβδομάδας. Αν περιμένεις βάρδιες, έλεγξε το φύλλο ή ρώτα τον
            υπεύθυνο του προγράμματος.
          </p>
        ) : (
          <Facts days={days} summary={summary} />
        )}
      </div>

      <table className="roster myweek__table">
        <caption className="visually-hidden">
          Πρόγραμμα για {person.name}, εβδομάδα από {formatDayMonth(week, "long")}
        </caption>
        <thead>
          <tr>
            <th scope="col">Ημέρα</th>
            <th scope="col">Ωράριο</th>
            <th scope="col">Με</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <DayRow key={day.date} day={day} today={today} changed={changed.has(`${week}:${day.index}`)} />
          ))}
        </tbody>
      </table>

      {!absent ? (
        <Actions person={person} week={week} days={days} summary={summary} checkedAt={props.checkedAt} />
      ) : null}
    </div>
  );
}

function formatDayNumeric(iso: IsoDate): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${m}`;
}

/**
 * Ρεπό, Κυριακή and total hours as one printed sentence, the same line the exported image carries.
 * It sits above the table on purpose: the answers come first (PRODUCT.md, principle 1).
 */
function Facts({ days, summary }: { days: PersonDay[]; summary: WeekSummary }) {
  const off = summary.offDays.map((i) => `${DAY_NAMES[i]} ${formatDayNumeric(days[i]!.date)}`).join(" και ");
  const sunday = summary.sunday.length ? summary.sunday.map((e) => compactRange(e.start, e.end)).join(", ") : "όχι";
  const total = `${summary.totalIncomplete ? "τουλάχιστον " : ""}${formatHours(summary.totalMinutes)}`;
  return (
    <p className="facts">
      <b>Ρεπό:</b> <span className={summary.offDays.length ? "facts__off" : undefined}>{off || "κανένα"}</span>
      <span className="facts__sep"> · </span>
      <b>Κυριακή:</b> {sunday}
      <span className="facts__sep"> · </span>
      <b>Σύνολο:</b> {total}
      {summary.leaveDays.length ? (
        <>
          <span className="facts__sep"> · </span>
          <b>Άδεια:</b> {summary.leaveDays.map((i) => DAY_SHORT[i]).join(", ")}
        </>
      ) : null}
    </p>
  );
}

type DayRowProps = { day: PersonDay; today: IsoDate; changed: boolean };

function DayRow({ day, today, changed }: DayRowProps) {
  const isToday = day.date === today;
  const isPast = day.date < today;
  return (
    <tr
      className={cx("roster-row", isToday && "roster-row--today", isPast && "roster-row--past")}
      aria-current={isToday ? "date" : undefined}
    >
      <th scope="row" className="roster-row__day">
        <span aria-hidden="true">
          {DAY_SHORT[day.index]} {dayNumber(day.date)}
        </span>
        <span className="visually-hidden">
          {DAY_NAMES[day.index]} {formatDayMonth(day.date, "long")}
          {isToday ? " (σήμερα)" : ""}
        </span>
      </th>
      <td className="roster-row__hours">
        {day.entries.length === 0 ? (
          <span className="slot slot--none">—</span>
        ) : (
          day.entries.map((entry, i) => <ShiftChip key={i} entry={entry} />)
        )}
      </td>
      <td className="roster-row__with">
        {changed ? <span className="overprint">Άλλαξε</span> : null}
        {day.entries.map((entry, i) => (
          <EntryNotes key={i} entry={entry} />
        ))}
      </td>
    </tr>
  );
}

function EntryNotes({ entry }: { entry: DayEntry }) {
  const extra = entry.tags.filter((t) => t !== "Εφημερία" && t !== "Ολονυχτία" && t !== entry.label);
  return (
    <>
      {entry.kind === "shift" ? (
        <span className="roster-row__names">{entry.coworkers.length ? joinNames(entry.coworkers) : "—"}</span>
      ) : null}
      {entry.kind === "note" && entry.label ? <span className="roster-row__note">{entry.label}</span> : null}
      {extra.map((tag) => (
        <span key={tag} className="roster-row__note">
          {tag}
        </span>
      ))}
      {entry.timeSource === "inherited" ? (
        <span className="roster-row__note">≈ η ώρα λείπει στο φύλλο</span>
      ) : null}
      {entry.timeSource === "override" ? <span className="roster-row__note">ειδικό ωράριο</span> : null}
    </>
  );
}

type ActionsProps = {
  person: Person;
  week: IsoDate;
  days: PersonDay[];
  summary: WeekSummary;
  checkedAt: string;
};

function Actions({ person, week, days, summary, checkedAt }: ActionsProps) {
  const path = `/api/calendar/${encodeURIComponent(person.id)}.ics`;

  // Render the image before the tap, so the share sheet opens inside the user's gesture (iOS requires it).
  const imageRef = useRef<Promise<Blob> | null>(null);
  useEffect(() => {
    const pending = renderWeekImage({ personName: person.name, monday: week, days, summary, checkedAt });
    pending.catch(() => undefined);
    imageRef.current = pending;
  }, [person, week, days, summary, checkedAt]);

  const [status, setStatus] = useState<"idle" | "busy" | "saved" | "failed">("idle");
  const saveImage = async () => {
    setStatus("busy");
    try {
      const blob = await (imageRef.current ?? renderWeekImage({ personName: person.name, monday: week, days, summary, checkedAt }));
      const result = await shareOrDownload(blob, weekImageFilename(person.id, week), `Πρόγραμμα · ${person.name}`);
      setStatus(result === "downloaded" ? "saved" : "idle");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="actions myweek__actions">
      <button type="button" className="button button--primary" onClick={() => void saveImage()} disabled={status === "busy"}>
        <ImageDown aria-hidden="true" className="icon" />
        <span>{status === "busy" ? "Ετοιμάζεται…" : "Εικόνα της εβδομάδας"}</span>
      </button>
      <a className="button" href={`${path}?week=${week}`}>
        <CalendarPlus aria-hidden="true" className="icon" />
        <span>Στο ημερολόγιο</span>
      </a>
      <p className="actions__hint" aria-live="polite">
        {status === "saved" ? "Η εικόνα αποθηκεύτηκε στις λήψεις." : status === "failed" ? "Η εικόνα δεν δημιουργήθηκε. Δοκίμασε ξανά." : null}
      </p>
    </div>
  );
}
