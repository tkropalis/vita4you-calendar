"use client";

import { CalendarPlus, ChevronRight, ImageDown } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
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
import { dayAlternatives, type DayAlternatives } from "@/lib/schedule/timeline";
import type { Week } from "@/lib/schedule/types";
import { NextShift, TodayLive } from "./NextShift";
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
  /** All loaded weeks (for the next-shift line) and this week's raw data (for swap candidates). */
  weeks: Week[];
  weekData: Week | undefined;
  names: Map<string, string>;
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
  const todayDay = days.find((d) => d.date === today);
  const swapDays = days.filter((d) => d.date >= today && d.entries.some((e) => e.kind === "shift")).map((d) => d.index);

  return (
    <div className="myweek">
      <div className="myweek__lead">
        {props.isCurrentWeek ? (
          <NextShift
            weeks={props.weeks}
            personId={person.id}
            todayHasShift={Boolean(todayDay?.entries.some((e) => e.kind === "shift"))}
          />
        ) : null}
        {todayDay ? (
          <TodayBox day={todayDay} live={<TodayLive weeks={props.weeks} personId={person.id} date={todayDay.date} />} />
        ) : null}
        {absent ? (
          <p className="notice-text">
            Δεν εμφανίζεσαι στο πρόγραμμα αυτής της εβδομάδας. Αν περιμένεις βάρδιες, έλεγξε το φύλλο ή ρώτα τον
            υπεύθυνο του προγράμματος.
          </p>
        ) : (
          <Facts days={days} summary={summary} />
        )}
      </div>

      <div className="myweek__table">
      <table className="roster">
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
            <DayRow
              key={day.date}
              day={day}
              today={today}
              changed={changed.has(`${week}:${day.index}`)}
              alternatives={
                swapDays.includes(day.index)
                  ? dayAlternatives(props.weekData, day.index, person.id, props.names, day.entries.find((e) => e.kind === "shift"))
                  : null
              }
            />
          ))}
        </tbody>
      </table>
      {swapDays.length ? (
        <p className="myweek__hint">Πάτα ένα ωράριο για να δεις ποιος θα μπορούσε να αλλάξει βάρδια μαζί σου.</p>
      ) : null}
      </div>

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

/** Today's hours in a ruled box, the first thing to read. */
function TodayBox({ day, live }: { day: PersonDay; live: React.ReactNode }) {
  const shifts = day.entries.filter((e) => e.kind === "shift");
  const first = day.entries[0];
  const coworkers = [...new Set(shifts.flatMap((e) => e.coworkers))];
  const duty = shifts.flatMap((e) => e.tags).find((t) => t === "Εφημερία" || t === "Ολονυχτία");

  let hours = "Χωρίς βάρδια";
  if (shifts.length) hours = shifts.map((e) => `${e.start} – ${e.end}`).join(" · ");
  else if (first?.kind === "off") hours = "Ρεπό";
  else if (first?.kind === "leave") hours = first.label ?? "Άδεια";

  return (
    <div className={cx("today-box", first?.kind === "off" && "today-box--off")}>
      <p className="today-box__label">
        Σήμερα · {DAY_NAMES[day.index]} {formatDayNumeric(day.date)}
        {duty ? ` · ${duty}` : ""}
        {live}
      </p>
      <p className="today-box__hours">{hours}</p>
      {coworkers.length ? <p className="today-box__with">με {joinNames(coworkers)}</p> : null}
    </div>
  );
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

type DayRowProps = { day: PersonDay; today: IsoDate; changed: boolean; alternatives: DayAlternatives | null };

function DayRow({ day, today, changed, alternatives }: DayRowProps) {
  const isToday = day.date === today;
  const isPast = day.date < today;
  const [swapOpen, setSwapOpen] = useState(false);
  const panelId = useId();
  const slots = day.entries.map((entry, i) => <ShiftChip key={i} entry={entry} />);
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
        ) : alternatives ? (
          <button
            type="button"
            className="swap-trigger"
            aria-expanded={swapOpen}
            aria-controls={panelId}
            onClick={() => setSwapOpen((open) => !open)}
          >
            {slots}
            <span className="visually-hidden">: ποιος θα μπορούσε να αλλάξει βάρδια</span>
          </button>
        ) : (
          slots
        )}
      </td>
      <td className="roster-row__with">
        {changed ? <span className="overprint">Άλλαξε</span> : null}
        {day.entries.map((entry, i) => (
          <EntryNotes key={i} entry={entry} />
        ))}
        {alternatives && swapOpen ? <SwapHelp id={panelId} alternatives={alternatives} /> : null}
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
        <span className="roster-row__note">≈ η ώρα λείπει στο φύλλο· πάρθηκε από τη γραμμή από πάνω</span>
      ) : null}
      {entry.timeSource === "override" ? <span className="roster-row__note">ειδικό ωράριο</span> : null}
    </>
  );
}

/** Who to ask when you need to swap this shift. */
function SwapHelp({ id, alternatives }: { id: string; alternatives: DayAlternatives }) {
  const { off, shifts, leave } = alternatives;
  const empty = !off.length && !shifts.length;
  return (
    <div className="swap" id={id}>
      <p className="swap__title">Για αλλαγή βάρδιας</p>
      <dl className="swap__list">
        {off.length ? (
          <div>
            <dt>Ρεπό</dt>
            <dd>{joinNames(off)}</dd>
          </div>
        ) : null}
        {shifts.map((s) => (
          <div key={`${s.start}-${s.end}`}>
            <dt>{compactRange(s.start, s.end)}</dt>
            <dd>{joinNames(s.names)}</dd>
          </div>
        ))}
        {leave.length ? (
          <div>
            <dt>Άδεια</dt>
            <dd>{joinNames(leave)} (μη διαθέσιμοι)</dd>
          </div>
        ) : null}
        {empty ? <p>Κανείς άλλος δεν είναι διαθέσιμος αυτή τη μέρα στο φύλλο.</p> : null}
      </dl>
    </div>
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
  // webcal:// needs the absolute host, which only the browser knows.
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => null,
  );
  const feedUrl = host ? `webcal://${host}${path}` : path;

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
        {status === "saved" ? (
          "Η εικόνα αποθηκεύτηκε στις λήψεις."
        ) : status === "failed" ? (
          "Η εικόνα δεν δημιουργήθηκε. Δοκίμασε ξανά."
        ) : (
          <>
            Ή <a href={feedUrl}>συνδρομή</a>, για ημερολόγιο που ενημερώνεται μόνο του.
          </>
        )}
      </p>
    </div>
  );
}
